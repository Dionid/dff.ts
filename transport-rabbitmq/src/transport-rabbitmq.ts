import { EventEmitter } from 'events'

import {
  CallsRecord,
  Call,
  CallRequest,
  RequestFromCall,
  ResponseFromCall,
  CallResponse,
  DefaultCallResponseResultFailure
} from '@distributed-functions/core/call'
import { CallHandler, CallHandlerRun } from '@distributed-functions/core/call-handler'
import { EventsRecord, Event, EventMessage, MessageFromEvent } from '@distributed-functions/core/event'
import { PersistenceLevel, EventHandler, EventHandlerRun } from '@distributed-functions/core/event-handler'
import { Logger } from '@distributed-functions/core/logger'
import { Transport, bindTransportToCalls, bindTransportToEvents } from '@distributed-functions/core/transport'
import { InMemoryTransport } from '@distributed-functions/core/transport-in-memory'
import { Sleep } from '@fapfop/core/sleep'
import { Switch } from '@fapfop/core/switch'
import { WaitGroup } from '@fapfop/core/wait-group'
import { retry } from '@fddf-ts/core'
import { TooManyRetries } from '@fddf-ts/core/retry'
import { BaseError, ValidationError } from '@fddf-ts/core/typed-errors'
import { Channel, Connection, ConsumeMessage, Message, Options } from 'amqplib'
import { v4 } from 'uuid'

import { checkConnectionReady, createChannel, getQueueFullName, initConnection, RabbitMqClientConfig } from './utils'

export const REPLY_QUEUE = 'amq.rabbitmq.reply-to' as const

export type RabbitMQTransport<
  Ctx extends Record<any, any>,
  ER extends EventsRecord,
  CR extends CallsRecord
> = Transport<Ctx, ER, CR> & {
  name: 'RabbitMQTransport'
  connection: () => Connection
  checkCallHandlerExist: (callName: string) => Promise<boolean>
}

export const RabbitMQTransport = <
  Ctx extends Record<any, any>,
  ER extends EventsRecord,
  CR extends CallsRecord
>(props: {
  config: RabbitMqClientConfig
  appName: string
  waitGroup?: WaitGroup
  ctx?: () => Ctx
  fromErrorToFailureMessage?: (err: any) => Record<any, any>
  strategy?: 'local-first' | 'remote-first'
  globalEventExchangeName?: string
  defaultEventPersistance?: PersistenceLevel
  reconnect?: boolean
  defaultPrefetch?: number
  timeout?: number
  mandatory?: boolean
  onConnectCallback?: () => any
  logger?: Logger
  callsToPublish?: CR
  eventsToPublish?: ER
}) => {
  const {
    appName,
    config,
    onConnectCallback,
    waitGroup,
    // defaultPrefetch,
    globalEventExchangeName = 'distributed-functions-global-events-exchange',
    strategy = 'local-first',
    reconnect = true,
    timeout: defaultTimeout = 30000,
    mandatory: defaultMandatory = true,
    defaultEventPersistance = 'none',
    callsToPublish,
    eventsToPublish,
    fromErrorToFailureMessage = (err: any, correlationId: string) => {
      let failure: DefaultCallResponseResultFailure

      if (err instanceof BaseError) {
        failure = {
          code: `${err.statusCode}`,
          message: err.message
        }
      } else {
        failure = {
          code: `${500}`,
          message: 'Internal Server Error'
        }
      }

      return {
        id: correlationId,
        result: failure
      }
    }
  } = props

  const ctx = () => {
    return props.ctx ? props.ctx() : ({} as Ctx)
  }

  // # Logger
  let logger: Logger = props.logger ?? {
    info: console.log,
    error: console.error,
    warn: console.warn,
    child: () => {
      return console
    }
  }

  if (logger.child) {
    logger = logger.child({
      dfTransport: 'RabbitMQTransport'
    })
  }

  // # Create in-memory transport for local strategy
  const inMemoryTransport = InMemoryTransport<Ctx, ER, CR>({
    ctx,
    logger
  })

  // # Response emitter
  const responseEmitter = new EventEmitter()
  responseEmitter.setMaxListeners(0)

  // # Reconnecting counter
  const connectionNotReady = WaitGroup.new(1)

  // # Global variables
  const channelsWithTags: Array<[Channel, string]> = []
  let isInitialized = false
  let connection: Connection
  let globalChannel: Channel
  let appExchangeName: string

  // # PUBLISH CALL

  const publishCall = async <C extends Call<any, CallRequest<string, any, any>, any, any>>(
    callRequest: RequestFromCall<C>,
    options: {
      timeout?: number
      mandatory?: boolean
    } = {}
  ): Promise<ResponseFromCall<C>> => {
    const { timeout = defaultTimeout, mandatory } = options
    const localSub = inMemoryTransport.getCallSub(callRequest.name)

    if (localSub && strategy === 'local-first') {
      return inMemoryTransport.call.publish(
        callRequest,
        options,
        bindTransportToCalls(publishCall, localSub.callsToPublish || {}),
        bindTransportToEvents(publishEvent, localSub.eventsToPublish || {})
      )
    }

    // # Wait until connection established
    await connectionNotReady.wait(0)

    return new Promise((resolve) => {
      const dataToSend: Buffer = Buffer.from(JSON.stringify(callRequest))

      const correlationId = callRequest.id
      // # Add response timeout
      const tid = setTimeout(() => {
        // waitGroup.decrement();
        responseEmitter.removeAllListeners(correlationId)
        resolve({
          id: callRequest.id,
          result: {
            $case: 'failure',
            failure: {
              code: '408',
              message: 'Request timeout'
            }
          }
        } as ResponseFromCall<C>)
      }, timeout)
      // # Listen for the content emitted on the correlationId event
      responseEmitter.once(correlationId, (data: ConsumeMessage) => {
        clearTimeout(tid)

        const result = JSON.parse(data.content.toString()) as ResponseFromCall<C>

        resolve(result)
      })
      globalChannel.sendToQueue(getQueueFullName(callRequest.name, config.prefix, config.postfix), dataToSend, {
        correlationId,
        replyTo: REPLY_QUEUE,
        contentType: 'application/json',
        mandatory: mandatory ?? defaultMandatory
      })
    })
  }

  // # PUBLISH EVENT

  const publishEvent = async <E extends Event<string, EventMessage<string, any, any>>>(
    message: MessageFromEvent<E>,
    options: {
      mandatory?: boolean
    } = {}
  ): Promise<void> => {
    // # Wait until connection established
    await connectionNotReady.wait(0)

    // # Deserialize from JSON (in future will be protobuf)
    const dataToSend = Buffer.from(JSON.stringify(message))

    // # Publish event
    globalChannel.publish(globalEventExchangeName, `events.${message.name}`, dataToSend, {
      contentType: 'application/json',
      mandatory: options.mandatory ?? defaultMandatory
    })

    // # Sleep just to be sure that it was published
    await Sleep.run(100)
  }

  // # SUBSCRIBE CALL

  const callSubs: Record<string, CallHandler<any, Ctx, any, any>> = {}

  const subscribeCallHandlerOnTransport = async (
    callHandler: CallHandler<Call<string, any, CallRequest<any, any, any>, CallResponse<any, any>>, Ctx, any, any>
  ) => {
    const { call } = callHandler

    // # Wait until connection
    await connectionNotReady.wait(0)

    // # Create rmq channel
    const consumerTag = v4()
    const channel = await createChannel(connection)
    channel.on('connect', () => {
      logger.info('channel connected')
    })
    channel.on('error', (err: Error) => {
      logger.error({ err }, 'error in channel')
    })
    channel.on('close', () => {
      logger.info('local channel close')
    })

    channelsWithTags.push([channel, consumerTag])

    // # Add prefetch
    const prefetch = callHandler.parallel

    if (prefetch) {
      await channel.prefetch(prefetch)
    }

    // # Check queue exist
    const q = await channel.assertQueue(
      getQueueFullName(call.name, config.prefix, config.postfix),
      // We must delete queue on all consumers death
      {
        autoDelete: true,
        durable: false
      }
    )

    // # Start consume
    await channel.consume(
      q.queue,
      (msg) => {
        // eslint-disable-next-line no-extra-semi
        ;(async () => {
          if (msg) {
            let localLogger = logger

            try {
              const parsed = JSON.parse(msg.content.toString()) as RequestFromCall<typeof call>

              if (localLogger.child) {
                localLogger = localLogger.child({
                  callId: parsed.id
                })
              }

              if (waitGroup) {
                waitGroup.add()
              }

              const res = await callHandler.run(parsed, ctx(), {
                call: bindTransportToCalls(publishCall, callHandler.callsToPublish || {}),
                event: bindTransportToEvents(publishEvent, callHandler.callsToPublish || {})
              })

              const encodedRes: string | Uint8Array = JSON.stringify(res)

              channel.publish(
                '', // Default exchange in RabbitMQ called ""
                msg.properties.replyTo as string,
                Buffer.from(encodedRes),
                {
                  correlationId: msg.properties.correlationId as string,
                  contentType: 'application/json'
                }
              )
            } catch (err: any) {
              localLogger.error(err)

              const errMessage = fromErrorToFailureMessage(err, msg.properties.correlationId)
              const errResp: string | Uint8Array = JSON.stringify(errMessage)

              channel.publish(
                '', // Default exchange in RabbitMQ called ""
                msg.properties.replyTo as string,
                Buffer.from(errResp),
                {
                  correlationId: msg.properties.correlationId as string,
                  contentType: 'application/json'
                }
              )
            } finally {
              if (waitGroup) {
                waitGroup.done()
              }

              channel.ack(msg)
            }
          }
        })().catch((err) => {
          throw err
        })
      },
      {
        consumerTag
      }
    )

    await inMemoryTransport.call.subscribeHandler(callHandler)
  }

  const subscribeCallHandler = async (
    callHandler: CallHandler<Call<string, any, CallRequest<any, any, any>, CallResponse<any, any>>, Ctx, any, any>
  ): Promise<void> => {
    const { call } = callHandler

    if (callSubs[call.name]) {
      throw new ValidationError(`There must be only one CallHandler per call (${call.name})`)
    }

    // # Add to call Subs
    callSubs[call.name] = callHandler

    if (isInitialized) {
      await subscribeCallHandlerOnTransport(callHandler)
    }
  }

  const subscribeCall = async <C extends Call<string, any, CallRequest<any, any, any>, CallResponse<any, any>>>(
    call: C,
    run: CallHandlerRun<C, Ctx, ER, CR>,
    options?: {
      parallel?: number
    }
  ): Promise<void> => {
    return subscribeCallHandler(
      CallHandler({
        call,
        run,
        parallel: options?.parallel,
        eventsToPublish,
        callsToPublish,
        handlerName: `${call.name}CallHandler`
      })
    )
  }

  // # SUBSCRIBE EVENT

  const eventSubs: Record<string, Array<EventHandler<any, Ctx, any, any>>> = {}

  const subscribeEventHandlerToTransport = async (
    eventHandler: EventHandler<Event<string, EventMessage<string, any, any>>, Ctx, any, any>
  ): Promise<void> => {
    const { event } = eventHandler

    await connectionNotReady.wait(0)

    // # Create channel
    const consumerTag = v4()
    const channel = await createChannel(connection)
    channel.on('connect', () => {
      logger.info('channel connected')
    })
    channel.on('error', (err: Error) => {
      logger.error({ err }, 'error in channel')
    })
    channel.on('close', () => {
      logger.info('local channel close')
    })

    channelsWithTags.push([channel, consumerTag])

    // # Configure prefetch
    const prefetch = eventHandler.parallel

    if (prefetch) {
      await channel.prefetch(prefetch)
    }

    const { persistent = defaultEventPersistance } = eventHandler
    const channelQueueOptions: Options.AssertQueue = {
      autoDelete: eventHandler.persistent === 'none', // If NO Hot Reload, than auto-delete it
      durable: eventHandler.persistent === 'single-node'
    }

    switch (persistent) {
      case 'none':
        channelQueueOptions.autoDelete = true
        channelQueueOptions.durable = false
        break
      case 'single-node':
        channelQueueOptions.autoDelete = false
        channelQueueOptions.durable = true
        break
      case 'replication':
        channelQueueOptions.autoDelete = false
        channelQueueOptions.durable = true
        channelQueueOptions.arguments = {
          'x-queue-type': 'quorum'
        }
        break
      default:
        Switch.safeGuard(persistent)
        break
    }

    // # Check queue exist
    const q = await channel.assertQueue(`events.${appName}.${event.eventName}`, channelQueueOptions)
    await channel.bindQueue(q.queue, appExchangeName, `events.${event.eventName}`)
    await channel.consume(
      q.queue,
      (msg) => {
        // eslint-disable-next-line no-extra-semi
        ;(async () => {
          if (msg) {
            let localLogger = logger

            if (waitGroup) {
              waitGroup.add()
            }

            try {
              const parsed = JSON.parse(msg.content.toString()) as MessageFromEvent<typeof event>

              if (localLogger.child) {
                localLogger = localLogger.child({
                  callId: parsed.id
                })
              }

              await eventHandler.run(parsed, ctx(), {
                call: bindTransportToCalls(publishCall, eventHandler.callsToPublish || {}),
                event: bindTransportToEvents(publishEvent, eventHandler.eventsToPublish || {})
              })
            } catch (e: any) {
              localLogger.error(e)
            } finally {
              if (waitGroup) {
                waitGroup.done()
              }

              channel.ack(msg)
            }
          }
        })().catch((err) => {
          throw err
        })
      },
      {
        consumerTag
      }
    )
  }

  const subscribeEventHandler = async (
    eventHandler: EventHandler<Event<string, EventMessage<string, any, any>>, Ctx, any, any>
  ): Promise<void> => {
    const { event } = eventHandler

    // # Add to subs
    const es = eventSubs[event.eventName]

    if (es) {
      es.push(eventHandler)
    } else {
      eventSubs[event.eventName] = [eventHandler]
    }

    if (isInitialized) {
      await subscribeEventHandlerToTransport(eventHandler)
    }
  }

  const subscribeEvent = async <E extends Event<string, EventMessage<string, any, any>>>(
    event: E,
    run: EventHandlerRun<E, Ctx, ER, CR>,
    options?: {
      persistent?: PersistenceLevel
      parallel?: number
    }
  ) => {
    return subscribeEventHandler(
      EventHandler({
        event,
        run,
        callsToPublish,
        eventsToPublish,
        handlerName: `${event.eventName}EventHandler`,
        parallel: options?.parallel,
        persistent: options?.persistent
      })
    )
  }

  // # INIT

  const init = async () => {
    appExchangeName = `events-${appName}`

    // Create connection
    try {
      const _initC = retry.onErrorWrapper(initConnection, {
        total: 8,
        errorLog: logger.error.bind(logger),
        timeoutBetweenCalls: retry.exponentialTimeoutBetweenCalls
      })
      connection = await _initC(logger, config, onConnectCallback)
    } catch (err) {
      if (err instanceof TooManyRetries) {
        process.emit('SIGINT', 'SIGINT')

        return
      }

      throw err
    }

    connection.on('error', (err: Error) => {
      if (err instanceof Error && err.message.includes('404')) {
        logger.warn({ err }, 'connection on error callback (404)')
      } else {
        logger.error({ err }, 'connection on error callback')
      }
    })

    if (reconnect) {
      connection.on('close', () => {
        logger.warn({ config }, 'reconnecting')
        connectionNotReady.add()
        // . Create new connection on close and repeat forever
        setTimeout(() => {
          responseEmitter.removeAllListeners()
          init()
            .then(() => {
              connectionNotReady.done()
            })
            .catch((err) => {
              throw err
            })
        }, 1000)
      })
    }

    // # Create channel
    globalChannel = await createChannel(connection)
    globalChannel.on('connect', () => {
      logger.info('Channel connected')
    })
    globalChannel.on('error', (err: Error) => {
      logger.error({ err }, 'Error in globalChannel')
    })
    globalChannel.on('close', () => {
      logger.info('Global channel close')
    })
    globalChannel.on('return', (message: Message) => {
      logger.error(
        { message: { ...message, content: message.content.toString() } },
        'Message was not routed (no queue found)'
      )
    })
    // # Subscribe on reply queues
    await globalChannel.consume(
      REPLY_QUEUE,
      (msg) => {
        if (msg) {
          responseEmitter.emit(msg.properties.correlationId as string, msg)
        }
      },
      { noAck: true }
    )
    await globalChannel.assertExchange(globalEventExchangeName, 'fanout', {
      durable: true
    })
    await globalChannel.assertExchange(appExchangeName, 'topic', {
      durable: true
    })
    await globalChannel.bindExchange(appExchangeName, globalEventExchangeName, '')

    connectionNotReady.done()

    await Promise.all([
      ...Object.values(callSubs).map(async (sub) => {
        await subscribeCallHandlerOnTransport(sub)
      }),
      ...Object.values(eventSubs).map(async (subs) => {
        for (const sub of subs) {
          await subscribeEventHandlerToTransport(sub)
        }
      })
    ])
    await inMemoryTransport.init()

    isInitialized = true
  }

  return {
    // # INIT
    name: 'RabbitMQTransport',
    connection: () => connection,
    init,
    ctx,
    restart: async () => {
      return
    },
    destroy: async () => {
      try {
        await connection.removeAllListeners().close()
      } catch (err) {
        if (!(err instanceof Error) || !err.message.includes('Connection closed')) {
          throw err
        }
      }

      await inMemoryTransport.destroy()
    },

    stop: async () => {
      for (const [channel, consumerTag] of channelsWithTags) {
        try {
          await channel.cancel(consumerTag)
        } catch (err) {
          logger.warn(err)
        }
      }

      // channelsWithTags = [];
    },

    call: {
      subscribe: subscribeCall,
      subscribeHandler: subscribeCallHandler,
      publish: publishCall,
      ...bindTransportToCalls(publishCall, callsToPublish ?? ({} as CR))
    },

    event: {
      subscribe: subscribeEvent,
      subscribeHandler: subscribeEventHandler,
      publish: publishEvent,
      ...bindTransportToEvents(publishEvent, eventsToPublish ?? ({} as ER))
    },

    // # UTILS
    checkCallHandlerExist: checkConnectionReady(connectionNotReady)(async (callName: string): Promise<boolean> => {
      if (inMemoryTransport.checkCallHandlerExist(callName)) {
        return true
      }

      try {
        const channel = await createChannel(connection)
        const res = !!(await channel.checkQueue(callName))
        await channel.close()

        return res
      } catch (e) {
        if (e instanceof Error) {
          if (e.message.includes('404') || e.message.includes('no reply will be forthcoming')) {
            return false
          }
        }

        throw e
      }
    })
  }
}

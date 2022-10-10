import { EventEmitter } from 'events'

import {
  InmemoryTransport,
  CallErrorResponseErrorBase,
  Call,
  CallHandler,
  DependantCalls,
  Logger,
  RequestParser
} from '@distributed-functions/core'
import { BaseError, ValidationError } from '@fddf-ts/core/categorized-errors'
import { JSONObject } from '@fddf-ts/core/jsonvalue'
import { ReactiveCounter } from '@fddf-ts/core/reactive-counter'
import amqplib, { Channel, Connection, ConsumeMessage, Options } from 'amqplib'

export type RabbitMqClientConfig = {
  host: string
  port: number
  username: string
  password: string
  heartbeat?: number
  vhost?: string
  prefix?: string
  postfix?: string
}

export const getQueueFullName = (queueName: string, prefix?: string, postfix?: string): string => {
  if (queueName === '') {
    return ''
  }

  return [prefix, queueName, postfix].filter((_) => !!_).join('-')
}

// TODO. Fix this
const requestParserValidate = (requestParser: RequestParser<any>, asJson: JSONObject) => {
  Object.keys(requestParser).map((key) => {
    const val = requestParser[key]
    const jsonVal = asJson[key]

    if (!jsonVal || !val) {
      throw new ValidationError(`Param ${key} is required`)
    }

    if (val instanceof Function) {
      val(key, jsonVal)
    } else {
      requestParserValidate(val, jsonVal as JSONObject)
    }
  })
}

const initConnection = async (logger: Logger, config: RabbitMqClientConfig, onConnectCallback?: () => any) => {
  const connectionOptions: Options.Connect = {
    hostname: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    heartbeat: config.heartbeat || 10
  }

  if (config.vhost) {
    connectionOptions.vhost = config.vhost
  }

  logger.info(`try to connection to rabbit host: ${connectionOptions.hostname}, port: ${connectionOptions.port}`)

  const connection = await amqplib.connect(connectionOptions)

  connection.on('error', () => {
    logger.error('connection on error callback: %o')
  })

  logger.info(`connected`)

  if (onConnectCallback) {
    logger.info('_onConnectCallback running...')

    try {
      await onConnectCallback()
    } catch (e) {
      logger.error('error in _onConnectCallback')
      throw e
    }

    logger.info('_onConnectCallback finished success')
  }

  return connection
}

export const REPLY_QUEUE = 'amq.rabbitmq.reply-to' as const

export const RabbitMQTransport = {
  type: 'RabbitMQTransport',
  new: (props: {
    config: RabbitMqClientConfig
    reactiveCounter?: ReactiveCounter
    strategy?: 'local-first' | 'remote-first'
    reconnect?: boolean
    deafultPrefetch?: number
    timeout?: number
    onConnectCallback?: () => any
    logger?: Logger
  }) => {
    const {
      config,
      onConnectCallback,
      reactiveCounter,
      strategy = 'local-first',
      reconnect = true,
      deafultPrefetch,
      timeout = 30000
    } = props

    const logger: Logger = props?.logger || {
      info: console.log,
      error: console.error,
      warn: console.warn
    }

    const inmemoryTransport = InmemoryTransport.new({
      reactiveCounter,
      logger
    })

    const responseEmitter = new EventEmitter()
    responseEmitter.setMaxListeners(0)

    let connection: Connection
    let globalChannel: Channel

    const subs: Array<{
      df: CallHandler<any, any, any>
      ctx: () => any
    }> = []

    const publish = async <C extends Call<any, any, any, any>>(
      requestData: ReturnType<C['request']>
    ): Promise<ReturnType<C['result']> | ReturnType<C['error']>> => {
      const localSub = inmemoryTransport.getSub(requestData.name)

      if (localSub && strategy === 'local-first' && !localSub.df.persistent && !localSub.df.call.sideEffects) {
        return inmemoryTransport.publish(requestData)
      }

      return new Promise((resolve) => {
        // QUESTION. Do we need to wait till response
        // reactiveCounter.increment();

        let dataToSend: Buffer

        if (!requestData) {
          throw new Error(`Data is required`)
        } else if (typeof requestData === 'string') {
          dataToSend = Buffer.from(requestData)
        } else {
          dataToSend = Buffer.from(JSON.stringify(requestData))
        }

        const correlationId = requestData.id

        // # Add request timeout
        const tid = setTimeout(() => {
          // reactiveCounter.decrement();
          responseEmitter.removeAllListeners(correlationId)
          resolve({
            id: requestData.id,
            error: {
              code: 408,
              message: 'Request timeout'
            }
          } as ReturnType<C['error']>)
          // reject(new ReplyTimeoutError(correlationId, requestData))
        }, timeout)

        // # Listen for the content emitted on the correlationId event
        responseEmitter.once(correlationId, (data: ConsumeMessage) => {
          // reactiveCounter.decrement();
          clearTimeout(tid)
          resolve(
            JSON.parse(data.content.toString()) // TODO. Add Response parser
          )
        })

        globalChannel.sendToQueue(getQueueFullName(requestData.name, config.prefix, config.postfix), dataToSend, {
          correlationId,
          replyTo: REPLY_QUEUE,
          contentType: 'application/json'
        })
      })
    }

    const subscribe = async <
      Ctx extends Record<any, any>,
      Deps extends Record<string, Call<any, any, any, any>>,
      Cl extends Call<any, any, any, any>
    >(
      df: CallHandler<Ctx, Deps, Cl>,
      ctx: () => Ctx
    ) => {
      subs.push({
        df,
        ctx
      })

      const { depCalls: depCallsRaw, call, handler, persistent } = df

      // TODO. Add prefetch in DF
      const prefetch = deafultPrefetch

      const depCalls = {} as DependantCalls<Deps>

      for (const key of Object.keys(depCallsRaw)) {
        // # Publish dep call and return result
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        depCalls[key] = async (request: ReturnType<C['request']>) => {
          return publish(request)
        }
      }

      const channel = await connection.createChannel()

      channel.on('connect', () => {
        logger.info('channel connected')
      })

      channel.on('error', (err) => {
        logger.error(err)
      })

      channel.on('close', () => {
        logger.info('local channel close')
      })

      if (prefetch) {
        await channel.prefetch(prefetch)
      }

      // # Check queue exist
      const q = await channel.assertQueue(
        getQueueFullName(call.name, config.prefix, config.postfix),
        {
          autoDelete: !persistent, // If NO Hot Reaload, than auto-delete it
          durable: persistent
        }
        // TODO. # Turn back
        // {
        //   ...rmqc.defaultAssertQueueOptions,
        //   ...assertQueueOptions,
        // }
      )

      channel.consume(
        q.queue,
        async (msg) => {
          if (msg) {
            try {
              const asJson = JSON.parse(msg.content.toString()) as ReturnType<Cl['request']>

              const { requestParser } = call

              if (requestParser) {
                requestParserValidate(requestParser, asJson.params)
              }

              if (reactiveCounter) {
                reactiveCounter.increment()
              }

              try {
                const res = await handler(asJson, ctx(), depCalls)

                channel.publish(
                  '', // Default exchange in RabbitMQ called ""
                  msg.properties.replyTo,
                  Buffer.from(JSON.stringify(res)),
                  {
                    correlationId: msg.properties.correlationId,
                    contentType: 'application/json'
                    // TODO. # Turn back
                    //   ...rmqChannel.defaultPublishOptions,
                  }
                )
              } finally {
                if (reactiveCounter) {
                  reactiveCounter.decrement()
                }
              }
            } catch (e: any) {
              let errorResponseData: CallErrorResponseErrorBase

              logger.error(e)

              if (e instanceof BaseError) {
                errorResponseData = {
                  code: e.statusCode,
                  message: e.message
                }
              } else {
                errorResponseData = {
                  code: 500,
                  message: 'Internal Server Error'
                }
              }

              channel.publish(
                '', // Default exchange in RabbitMQ called ""
                msg.properties.replyTo,
                Buffer.from(
                  JSON.stringify({
                    id: msg.properties.correlationId,
                    error: errorResponseData
                  })
                ),
                {
                  correlationId: msg.properties.correlationId,
                  contentType: 'application/json'
                  // TODO. # Turn back
                  //   ...rmqChannel.defaultPublishOptions,
                }
              )
            } finally {
              channel.ack(msg)
            }
          }
        }
        // TODO. # Turn back
        // consumeOptions
      )

      await inmemoryTransport.subscribe(df, ctx)
    }

    const init = async () => {
      // Create connection
      connection = await initConnection(logger, config, onConnectCallback)

      if (reconnect) {
        connection.on('close', () => {
          logger.warn('reconnecting')

          // . Create new connection on close and repeat forever
          return setTimeout(async () => {
            responseEmitter.removeAllListeners()
            init()
          }, 1000)
        })
      }

      // # Create channel
      globalChannel = await connection.createChannel()

      globalChannel.on('connect', () => {
        logger.info('channel connected')
      })

      globalChannel.on('error', (err) => {
        logger.error(err)
      })

      globalChannel.on('close', () => {
        logger.info('global channel close')
      })

      // # Subscribe on reply queues
      await globalChannel.consume(
        REPLY_QUEUE,
        (msg) => {
          if (msg) {
            responseEmitter.emit(msg.properties.correlationId, msg)
          }
        },
        { noAck: true }
      )

      await Promise.all(
        subs.map((sub) => {
          subscribe(sub.df, sub.ctx)
        })
      )

      await inmemoryTransport.init()
    }

    return {
      init,
      subscribe,
      publish,
      destroy: async () => {
        await connection.removeAllListeners().close()
        await inmemoryTransport.destroy()
      },
      checkDfExistence: async (dfCallName: string): Promise<boolean | undefined> => {
        if (await inmemoryTransport.checkDfExistence(dfCallName)) {
          return true
        }

        try {
          const channel = await connection.createChannel()

          return !!(await channel.checkQueue(dfCallName))
        } catch (e) {
          if (e instanceof Error) {
            if (e.message.includes('404')) {
              return false
            }
          }

          throw e
        }
      }
    }
  }
}

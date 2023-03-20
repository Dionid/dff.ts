import { CallsRecord, Call, CallRequest, RequestFromCall, ResponseFromCall } from './call'
import { CallHandler, CallHandlerRun } from './call-handler'
import { CallSubscriberNotFoundError, EventSubscriberNotFoundError } from './errors'
import { EventsRecord, Event, EventMessage, MessageFromEvent } from './event'
import { EventHandler, EventHandlerRun, PersistenceLevel } from './event-handler'
import { Logger } from './logger'
import { CallsToPublish, EventsToPublish } from './publishers'
import { Transport, bindTransportToCalls, bindTransportToEvents } from './transport'

export const InMemoryTransportName = 'InMemoryTransport'

export type InMemoryTransport<
  Ctx extends Record<any, any>,
  ER extends EventsRecord,
  CR extends CallsRecord
> = Transport<Ctx, ER, CR> & {
  checkCallHandlerExist: (callName: string) => boolean
  getCallSub: (callName: string) => CallHandler<any, any, any, any> | undefined
}

export const InMemoryTransport = <Ctx extends Record<any, any>, ER extends EventsRecord, CR extends CallsRecord>(
  props: {
    ctx?: () => Ctx
    logger?: Logger
    callsToPublish?: CR
    eventsToPublish?: ER
  } = {}
): InMemoryTransport<Ctx, ER, CR> => {
  const ctx = () => {
    return props.ctx ? props.ctx() : ({} as Ctx)
  }

  const { callsToPublish, eventsToPublish } = props

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
      dfTransport: InMemoryTransportName
    })
  }

  // # Subscribe maps
  let callSubscribersMap: Record<string, CallHandler<any, Ctx, any, any>> = {}
  let eventSubscribersMap: Record<string, Array<EventHandler<any, Ctx, any, any>>> = {}

  // # PUBLISH CALL

  const publishCall = async <C extends Call<any, any, CallRequest<string, any, any>, any>>(
    callRequest: RequestFromCall<C>,
    _?: { timeout?: number; mandatory?: boolean },
    assignedCalls?: CallsToPublish<any>, // # This needed to send other here some assignedCalls from external Transport
    assignedEvents?: EventsToPublish<any>
  ): Promise<ResponseFromCall<C>> => {
    const callSubscriber = callSubscribersMap[callRequest.name] as CallHandler<C, Ctx, any, any> | undefined

    if (!callSubscriber) {
      throw new CallSubscriberNotFoundError(callRequest.name)
    }

    return callSubscriber.run(callRequest, ctx(), {
      call: assignedCalls ?? bindTransportToCalls(publishCall, callSubscriber.callsToPublish || {}),
      event: assignedEvents ?? bindTransportToEvents(publishEvent, callSubscriber.eventsToPublish || {})
    })
  }

  const transportAssignedCalls: CallsToPublish<CR> = bindTransportToCalls(
    publishCall,
    props.callsToPublish ?? ({} as CR)
  )

  // # PUBLISH EVENTS

  const publishEvent = async <E extends Event<string, EventMessage<string, any, any>>>(
    event: MessageFromEvent<E>,
    _?: { mandatory?: boolean },
    assignedCalls?: CallsToPublish<any>, // # This needed to send other here some assignedCalls from external Transport
    assignedEvents?: EventsToPublish<any>
  ): Promise<void> => {
    const eventSubscriberList = eventSubscribersMap[event.name] as Array<EventHandler<E, Ctx, any, any>> | undefined

    if (!eventSubscriberList) {
      throw new EventSubscriberNotFoundError(event.name)
    }

    eventSubscriberList.map(async (eventSubscriber) => {
      await eventSubscriber.run(event, ctx(), {
        call: assignedCalls ?? bindTransportToCalls(publishCall, eventSubscriber.callsToPublish || {}),
        event: assignedEvents ?? bindTransportToEvents(publishEvent, eventSubscriber.eventsToPublish || {})
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const transportAssignedEvents: EventsToPublish<ER> = bindTransportToEvents(
    publishEvent,
    props.eventsToPublish ?? ({} as ER)
  )

  return {
    // # INIT
    init: async () => {
      return
    },
    stop: async () => {
      return
    },
    restart: async () => {
      return
    },
    destroy: async () => {
      callSubscribersMap = {}
      eventSubscribersMap = {}
    },

    ctx,

    // UTILS

    checkCallHandlerExist: (callName: string) => {
      return !!callSubscribersMap[callName]
    },
    getCallSub: (callName: string) => {
      return callSubscribersMap[callName]
    },

    // # CALL
    call: {
      publish: publishCall,
      subscribe: async <C extends Call<string, any, any, any>>(
        call: C,
        run: CallHandlerRun<C, Ctx, ER, CR>,
        options?: {
          parallel?: number
        }
      ): Promise<void> => {
        callSubscribersMap[call.name] = CallHandler({
          run,
          call,
          parallel: options?.parallel,
          callsToPublish,
          eventsToPublish
        })
      },
      subscribeHandler: async (callHandler: CallHandler<Call<string, any, any, any>, Ctx, any, any>) => {
        callSubscribersMap[callHandler.call.name] = callHandler

        return
      },
      ...transportAssignedCalls
    },

    // # EVENT
    event: {
      publish: publishEvent,
      subscribe: async <E extends Event<string, any>>(
        event: E,
        run: EventHandlerRun<E, Ctx, ER, CR>,
        options?: {
          parallel?: number
          persistent?: PersistenceLevel
        }
      ): Promise<void> => {
        const es = eventSubscribersMap[event.eventName]
        const eventHandler = EventHandler({
          event,
          run,
          parallel: options?.parallel,
          persistent: options?.persistent
        })

        if (es) {
          es.push(eventHandler)
        } else {
          eventSubscribersMap[event.eventName] = [eventHandler]
        }
      },
      subscribeHandler: async (eventHandler: EventHandler<Event<string, any>, Ctx, ER, CR>): Promise<void> => {
        const es = eventSubscribersMap[eventHandler.event.eventName]

        if (es) {
          es.push(eventHandler)
        } else {
          eventSubscribersMap[eventHandler.event.eventName] = [eventHandler]
        }

        return
      },
      ...transportAssignedEvents
    }
  }
}

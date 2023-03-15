import { CallsRecord, Call, RequestFromCall, ResponseFromCall } from './call'
import { CallHandler, CallHandlerRun } from './call-handler'
import { EventsRecord, Event, MessageFromEvent } from './event'
import { EventHandler, EventHandlerRun } from './event-handler'
import { CallsPublisher, EventsPublisher, CallsToPublish, EventsToPublish } from './publishers'

// # SUBSCRIBER
export type CallSubscriber<Ctx extends Record<any, any>, ER extends EventsRecord, CR extends CallsRecord> = {
  subscribe: <C extends Call<any, any, any>>(
    call: C,
    run: CallHandlerRun<C, Ctx, ER, CR>,
    options?: {
      parallel?: number
    }
  ) => Promise<void>

  subscribeHandler: (callHandler: CallHandler<Call<string, any, any>, Ctx, any, any>) => Promise<void>
}

export type EventSubscriber<Ctx extends Record<any, any>, ER extends EventsRecord, CR extends CallsRecord> = {
  subscribe: <E extends Event<any, any>>(
    event: E,
    run: EventHandlerRun<E, Ctx, ER, CR>,
    options?: {
      parallel?: number
      mandatory?: boolean
    }
  ) => Promise<void>

  subscribeHandler: (eventHandler: EventHandler<any, Ctx, any, any>) => Promise<void>
}

// # PUBSUB

export type TransportPubSub<Ctx extends Record<any, any>, ER extends EventsRecord, CR extends CallsRecord> = {
  call: CallsPublisher<CR> & CallSubscriber<Ctx, ER, CR>
  event: EventsPublisher<ER> & EventSubscriber<Ctx, ER, CR>
}

export type TransportInitializer<Ctx extends Record<any, any>> = {
  init: () => Promise<void>
  stop: () => Promise<void>
  restart: () => Promise<void>
  destroy: () => Promise<void>
  ctx: () => Ctx
}

export type Transport<Ctx extends Record<any, any>, ER extends EventsRecord, CR extends CallsRecord> = TransportPubSub<
  Ctx,
  ER,
  CR
> &
  TransportInitializer<Ctx>

export const bindTransportToCalls = <CR extends CallsRecord>(
  publishCall: <C extends Call<any, any, any>>(
    request: RequestFromCall<C>,
    options?: { timeout?: number; mandatory?: boolean },
    assignedCalls?: CallsToPublish<any>, // # This needed to send other here some assignedCalls from external Transport
    assignedEvents?: EventsToPublish<any>
  ) => Promise<ResponseFromCall<C>>,
  callsRecord: CR
): CallsToPublish<CR> => {
  return Object.keys(callsRecord).reduce<CallsToPublish<CR>>(
    (acc, cur) => {
      const callName = cur as keyof CR

      acc[callName] = (callRequest, options, assignedCalls, assignedEvents) => {
        return publishCall(callRequest, options, assignedCalls, assignedEvents)
      }

      return acc
    },
    // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
    {} as CallsToPublish<CR>
  )
}

export const bindTransportToEvents = <ER extends EventsRecord>(
  publishEvent: <E extends Event<any, any>>(
    event: MessageFromEvent<E>,
    options?: { mandatory?: boolean },
    assignedCalls?: CallsToPublish<any>, // # This needed to send other here some assignedCalls from external Transport
    assignedEvents?: EventsToPublish<any>
  ) => Promise<void>,
  callsRecord: ER
): EventsToPublish<ER> => {
  return Object.keys(callsRecord).reduce<EventsToPublish<ER>>(
    (acc, cur) => {
      const callName = cur as keyof ER

      acc[callName] = (callRequest, options, assignedCalls, assignedEvents) => {
        return publishEvent(callRequest, options, assignedCalls, assignedEvents)
      }

      return acc
    },
    // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
    {} as EventsToPublish<ER>
  )
}

export const Transport = {
  bindTransportToCalls,
  bindTransportToEvents
}

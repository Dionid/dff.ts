import { Call, RequestFromCall, ResponseFromCall, CallsRecord } from './call'
import { Event, MessageFromEvent, EventsRecord } from './event'

export type PublishCall<C extends Call<any, any, any, any>> = (
  request: RequestFromCall<C>,
  options?: { timeout?: number; mandatory?: boolean },
  assignedCalls?: CallsPublisher<any>, // # This needed to send other here some assignedCalls from external Transport
  assignedEvents?: EventsPublisher<any>
) => Promise<ResponseFromCall<C>>

export type CallsToPublish<CR extends CallsRecord> = {
  [K in keyof CR]: PublishCall<CR[K]>
}

export type CallsPublisher<CR extends CallsRecord> = {
  publish: <C extends Call<any, any, any, any>>(
    request: RequestFromCall<C>,
    options?: { timeout?: number; mandatory?: boolean },
    assignedCalls?: CallsToPublish<any>, // # This needed to send other here some assignedCalls from external Transport
    assignedEvents?: EventsToPublish<any>
  ) => Promise<ResponseFromCall<C>>
} & CallsToPublish<CR>

export type PublishEvent<E extends Event<any, any>> = (
  event: MessageFromEvent<E>,
  options?: { mandatory?: boolean },
  assignedCalls?: CallsPublisher<any>, // # This needed to send other here some assignedCalls from external Transport
  assignedEvents?: EventsPublisher<any>
) => Promise<void>

export type EventsToPublish<BEs extends EventsRecord> = {
  [K in keyof BEs]: PublishEvent<BEs[K]>
}

export type EventsPublisher<ER extends EventsRecord> = {
  publish: <E extends Event<any, any>>(
    event: MessageFromEvent<E>,
    options?: { mandatory?: boolean },
    assignedCalls?: CallsPublisher<any>, // # This needed to send other here some assignedCalls from external Transport
    assignedEvents?: EventsPublisher<any>
  ) => Promise<void>
} & EventsToPublish<ER>

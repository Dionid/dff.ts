export type EventMessage<Name extends string, Payload extends Record<any, any>, Meta extends Record<any, any>> = {
  id: string
  name: Name
  payload: Payload
  meta: Meta
}

export type Event<Name extends string, EM extends EventMessage<Name, any, any>> = {
  (...args: any[]): EM
  eventName: Name
}

export type MessageFromEvent<E extends Event<any, any>> = E extends Event<any, infer EM> ? EM : never

export type MessagePayloadFromEvent<E extends Event<any, any>> = E extends Event<any, infer EM> ? EM['payload'] : never

export type EventsRecord = Record<string, Event<string, any>>

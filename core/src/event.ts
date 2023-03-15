export type EventMessage<Name extends string, Payload extends Record<any, any>> = {
  id: string
  name: Name
  payload: Payload
}

export type Event<Name extends string, EM extends EventMessage<Name, any>> = {
  (...args: any[]): EM
  eventName: Name
}

export type MessageFromEvent<E extends Event<any, any>> = E extends Event<any, infer EM> ? EM : never

export type EventsRecord = Record<string, Event<string, any>>

// # EVENT WITH META

export type EventMessageWithMeta<
  Name extends string,
  Payload extends Record<any, any>,
  Meta extends Record<any, any>
> = EventMessage<Name, Payload> & {
  meta: Meta
}

export type EventWithMeta<Name extends string, EWM extends EventMessageWithMeta<Name, any, any>> = {
  (...args: any[]): EWM
  eventName: Name
}

export type MessageFromEventWithMeta<E extends EventWithMeta<any, any>> = E extends EventWithMeta<any, infer Message>
  ? Message
  : never

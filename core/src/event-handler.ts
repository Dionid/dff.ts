import { CallsRecord } from './call'
import { MessageFromEvent, Event, EventsRecord } from './event'
import { CallsToPublish, EventsToPublish } from './publishers'

export type PersistenceLevel = 'none' | 'single-node' | 'replication'

export type EventHandlerRun<
  E extends Event<any, any>,
  Ctx extends Record<any, any>,
  ER extends EventsRecord | undefined,
  CR extends CallsRecord | undefined
> = (
  event: MessageFromEvent<E>,
  ctx: Ctx,
  transport: {
    call: CallsToPublish<CR extends CallsRecord ? CR : any>
    event: EventsToPublish<ER extends EventsRecord ? ER : any>
  }
) => Promise<void>

export type EventHandler<
  E extends Event<any, any>,
  Ctx extends Record<any, any>,
  ER extends EventsRecord | undefined,
  CR extends CallsRecord | undefined
> = {
  event: E
  run: EventHandlerRun<E, Ctx, ER, CR>
  handlerName: string
  persistent?: PersistenceLevel
  callsToPublish?: CR
  eventsToPublish?: ER
  isEventHandler: true
  parallel?: number
}

export const EventHandler = <
  E extends Event<any, any>,
  Ctx extends Record<any, any>,
  ER extends EventsRecord | undefined,
  CR extends CallsRecord | undefined
>(props: {
  event: E
  callsToPublish?: CR
  eventsToPublish?: ER
  handlerName?: string
  parallel?: number
  persistent?: PersistenceLevel
  run: EventHandlerRun<E, Ctx, ER, CR>
}): EventHandler<E, Ctx, ER, CR> => {
  return {
    run: props.run,
    event: props.event,
    isEventHandler: true as const,
    callsToPublish: props.callsToPublish,
    eventsToPublish: props.eventsToPublish,
    handlerName: props.handlerName ?? `${props.event.name}EventHandler`,
    parallel: props.parallel,
    persistent: props.persistent
  }
}

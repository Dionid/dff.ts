import { Call, CallsRecord, RequestFromCall, ResponseFromCall } from './call'
import { EventsRecord } from './event'
import { CallsToPublish, EventsToPublish } from './publishers'

export type CallHandlerRun<
  C extends Call<any, any, any, any>, // 100% because need to define Call
  Ctx extends Record<any, any>, // 100% because need to define Ctx from outside
  ER extends EventsRecord | undefined,
  CR extends CallsRecord | undefined
> = (
  request: RequestFromCall<C>,
  ctx: Ctx,
  transport: {
    call: CR extends CallsRecord ? CallsToPublish<CR> : unknown
    event: ER extends EventsRecord ? EventsToPublish<ER> : unknown
  }
) => Promise<ResponseFromCall<C>>

export type CallHandler<
  C extends Call<any, any, any, any>,
  Ctx extends Record<any, any>,
  ER extends EventsRecord | undefined,
  CR extends CallsRecord | undefined
> = {
  run: CallHandlerRun<C, Ctx, ER, CR>
  isCallHandler: true
  call: C
  handlerName: string
  callsToPublish?: CR
  eventsToPublish?: ER
  parallel?: number
}

export const CallHandler = <
  C extends Call<string, any, any, any>,
  Ctx extends Record<any, any>,
  ER extends EventsRecord | undefined = undefined,
  CR extends CallsRecord | undefined = undefined
>(props: {
  call: C
  callsToPublish?: CR
  eventsToPublish?: ER
  handlerName?: string
  parallel?: number
  run: CallHandlerRun<C, Ctx, ER, CR>
}): CallHandler<C, Ctx, ER, CR> => {
  return {
    run: props.run,
    call: props.call,
    isCallHandler: true as const,
    callsToPublish: props.callsToPublish,
    eventsToPublish: props.eventsToPublish,
    parallel: props.parallel,
    handlerName: props.handlerName ?? `${props.call.name}CallHandler`
  }
}

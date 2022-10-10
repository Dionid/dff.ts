import { ReactiveCounter } from '@fddf-ts/core/reactive-counter'

import { Call, DependantCalls } from './call'

export type CallHandler<
  Ctx extends Record<any, any>,
  Deps extends Record<string, Call<any, any, any, any>>,
  Cl extends Call<any, any, any, any>
> = {
  call: Cl
  depCalls: Deps
  persistent: boolean
  handler: (
    req: ReturnType<Cl['request']>,
    ctx: Ctx,
    depCalls: DependantCalls<Deps>
  ) => Promise<ReturnType<Cl['result']>>
}

export const CallHandler = <
  Ctx extends Record<any, any>,
  Deps extends Record<string, Call<any, any, any, any>>,
  Cl extends Call<any, any, any, any>
>(props: {
  call: Cl
  depCalls: Deps
  persistent?: boolean
  reactiveCounter?: ReactiveCounter
  handler: (
    req: ReturnType<Cl['request']>,
    ctx: Ctx,
    depCalls: DependantCalls<Deps>
  ) => Promise<ReturnType<Cl['result']>>
}): CallHandler<Ctx, Deps, Cl> => {
  const { reactiveCounter } = props

  return {
    ...props,
    persistent: props.persistent === undefined ? false : props.persistent,
    handler: reactiveCounter
      ? async (req, ctx, depCalls) => {
          reactiveCounter.increment()

          try {
            return props.handler(req, ctx, depCalls)
          } finally {
            reactiveCounter.decrement()
          }
        }
      : props.handler
  }
}

import { Call } from './call'
import { CallHandler } from './call-handler'

export type Transport = {
  init: () => Promise<void>
  subscribe: <
    Ctx extends Record<any, any>,
    Deps extends Record<string, Call<any, any, any, any>>,
    Cl extends Call<any, any, any, any> = Call
  >(
    df: CallHandler<Ctx, Deps, Cl>,
    ctx: () => Ctx
  ) => Promise<void>
  destroy: () => Promise<void>
  publish: <C extends Call<any, any, any, any>>(
    data: ReturnType<C['request']>
  ) => Promise<ReturnType<C['result']> | ReturnType<C['error']>>
  checkDfExistence: (dfCallName: string) => Promise<boolean | undefined>
}

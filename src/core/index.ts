import { v4 } from 'uuid'
import { JSONObject, JSONValue } from '@fddf-ts/core/jsonvalue'
import { ReactiveCounter } from '@fddf-ts/core/reactive-counter'
import { InmemoryTransport } from '../transport-inmemory'
import { CallErrorResponse, CallErrorResponseError, CallErrorResponseErrorBase } from './call-response-errors'

// LIB

export type CallRequest<Name extends string = string, ReqParams extends JSONObject = JSONObject> = {
  id: string
  name: Name
  params: ReqParams
}

export type CallResponseResult<RespResult extends JSONObject = JSONObject> = {
  id: string
  result: RespResult
}

export type CallResponse<
  RespResult extends JSONObject = JSONObject,
  RespError extends CallErrorResponseErrorBase = CallErrorResponseError
> = CallResponseResult<RespResult> | CallErrorResponse<RespError>

export type Call<
  Name extends string = string,
  ReqParams extends JSONObject = JSONObject,
  RespResult extends JSONObject = JSONObject,
  RespError extends CallErrorResponseErrorBase = CallErrorResponseError
> = {
  name: Name
  requestParser?: RequestParser<ReqParams>
  request: (params: ReqParams, id?: string) => CallRequest<Name, ReqParams>
  result: (
    props: { id: string; result: RespResult } | { req: CallRequest<Name, ReqParams>; result: RespResult }
  ) => CallResponseResult<RespResult>
  error: (
    props: { id: string; error: RespError } | { req: CallRequest<Name, ReqParams>; error: RespError }
  ) => CallErrorResponse<RespError>
}

type RPF = (propName: string, val: JSONValue) => Promise<JSONValue> | JSONValue

// TODO. Create from ReqParams
// export type RequestParser<ReqParams extends JSONObject> = Record<
//   keyof ReqParams,
//   ReqParams[keyof ReqParams] extends JSONObject
//     ? RequestParser<ReqParams[keyof ReqParams]>
//     : RPF
// >;

export type RequestParser<ReqParams extends JSONObject> = {
  [K in keyof ReqParams]: ReqParams[K] extends JSONObject ? RequestParser<ReqParams[K]> : RPF
}

export const Call = <
  Name extends string = string,
  ReqParams extends JSONObject = JSONObject,
  RespResult extends JSONObject = JSONObject,
  RespError extends CallErrorResponseErrorBase = CallErrorResponseError
>(
  name: Name,
  requestParser?: RequestParser<ReqParams> // TODO. Create from ReqParams
): Call<Name, ReqParams, RespResult, RespError> => {
  return {
    name,
    requestParser,
    request: (params: ReqParams, id?: string) => {
      return {
        id: id || v4(),
        name,
        params
      }
    },
    result: (props: { id: string; result: RespResult } | { req: CallRequest<Name, ReqParams>; result: RespResult }) => {
      const { result } = props
      if ('req' in props) {
        return {
          id: props.req.id,
          result
        }
      } else {
        return {
          id: props.id,
          result
        }
      }
    },
    error: (props: { id: string; error: RespError } | { req: CallRequest<Name, ReqParams>; error: RespError }) => {
      const { error } = props
      if ('req' in props) {
        return {
          id: props.req.id,
          error
        }
      } else {
        return {
          id: props.id,
          error
        }
      }
    }
  }
}

export type DependantCalls<Deps extends Record<string, Call<any, any, any, any>>> = {
  [K in keyof Deps]: (request: ReturnType<Deps[K]['request']>) => Promise<ReturnType<Deps[K]['result']>>
}

export type DependantCallsOfTrigger<T extends Trigger<any>> = T extends Trigger<infer Deps>
  ? DependantCalls<Deps>
  : unknown

export type DistributedFunction<
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

export const DistributedFunction = <
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
}): DistributedFunction<Ctx, Deps, Cl> => {
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

export type Trigger<Deps extends Record<string, Call<any, any, any, any>>> = {
  name?: string
  depCalls: Deps
  init: (depCalls: DependantCalls<Deps>) => Promise<void>
  destroy: () => Promise<void>
}

export const Trigger = <Deps extends Record<string, Call<any, any, any, any>>>(props: {
  depCalls: Deps
  init: (depCalls: DependantCalls<Deps>) => Promise<void>
  destroy: () => Promise<void>
  name?: string
}) => {
  return props
}

export type Logger = {
  info: (str: string) => any
  warn: (str: string) => any
  error: (str: string) => any
}

export type Transport = {
  init: () => Promise<void>
  subscribe: <
    Ctx extends Record<any, any>,
    Deps extends Record<string, Call<any, any, any, any>>,
    Cl extends Call<any, any, any, any> = Call
  >(
    df: DistributedFunction<Ctx, Deps, Cl>,
    ctx: () => Ctx
  ) => Promise<void>
  destroy: () => Promise<void>
  publish: <C extends Call<any, any, any, any>>(data: ReturnType<C['request']>) => Promise<ReturnType<C['result']>>
  checkDfExistence: (dfCallName: string) => Promise<boolean | undefined>
}

export type UnitedCtx<T extends any[]> = T extends [infer DF, ...infer Rest]
  ? DF extends DistributedFunction<infer Ctx, any, any>
    ? Ctx & UnitedCtx<Rest>
    : unknown
  : unknown

export const App = <DFs extends Array<DistributedFunction<any, any, any>>>(props: {
  name: string
  dfs: DFs
  ctx: () => UnitedCtx<DFs>
  transport?: Transport
  discovery?: {
    host: string
  }
  triggers?: Trigger<any>[]
  logger?: Logger
}) => {
  const { name, dfs, triggers, discovery, ctx } = props

  let logger: Logger = props.logger || {
    info: console.log,
    error: console.error,
    warn: console.warn
  }

  const { transport = InmemoryTransport.new({ logger }) } = props

  const depsDistributedFunctions: Record<string, string[]> = {}

  return {
    name,
    start: async () => {
      // # Init transport
      await transport.init()

      // # Subscribe dfs
      await Promise.all(
        dfs.map(async (df) => {
          const { depCalls } = df

          // # Map throw Dep Calls to register dependencies
          depsDistributedFunctions[df.call.name] = []

          if (depCalls) {
            Object.values(depCalls).map((depCallRaw) => {
              const depCall = depCallRaw as Call
              depsDistributedFunctions[df.call.name]!.push(depCall.name)
            })
          }

          // # Sub call on transaport
          await transport.subscribe(df, ctx as () => Record<any, any>)
        })
      )

      // # Init triggers
      await Promise.all(
        triggers?.map(async <T extends Trigger<Record<string, Call<any, any, any, any>>>>(tr: T) => {
          const { depCalls, name = 'Trigger' } = tr
          // # Map throw Dep Calls to register dependencies
          if (depCalls) {
            Object.values(depCalls).map((depCall) => {
              if (depsDistributedFunctions[name]) {
                depsDistributedFunctions[name].push(depCall.name)
              } else {
                depsDistributedFunctions[name] = [depCall.name]
              }
            })
          } else {
            depsDistributedFunctions[name] = []
          }

          let depCallsAsFn = {} as DependantCallsOfTrigger<T>

          for (const key in depCalls) {
            // # Publish dep call and return result
            // @ts-ignore
            depCallsAsFn[key] = async (request: CallRequest) => {
              return transport.publish(request)
            }
          }

          await tr.init(depCallsAsFn)
        }) || []
      )

      // # Check all deps
      for (const callName in depsDistributedFunctions) {
        await Promise.all(
          depsDistributedFunctions[callName]!.map(async (depName) => {
            if (depsDistributedFunctions[depName]) {
              logger.info(`DistributedFunction ${callName} is dependednt on ${depName} tart IS presented localy`)
            } else {
              if (!discovery) {
                const exist = await transport.checkDfExistence(depName)
                if (exist === true) {
                  console.warn(
                    `DistributedFunction ${callName} is dependednt on ${depName} that IS presented in transport`
                  )
                } else if (exist === false) {
                  console.warn(
                    `DistributedFunction ${callName} is dependednt on ${depName} that IS NOT presented in transport`
                  )
                } else {
                  console.warn(`DistributedFunction ${callName} is dependednt on ${depName} that CAN'T be dicovered`)
                }
              }
            }
          })
        )
      }

      logger.info(`App ${name} has started!`)
    },
    destroy: async () => {
      if (triggers) {
        await Promise.all(triggers.map((tr) => tr.destroy()))
      }
      await transport.destroy()
    }
  }
}

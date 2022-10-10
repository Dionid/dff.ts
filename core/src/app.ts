import { Call } from './call'
import { CallHandler } from './call-handler'
import { Logger } from './logger'
import { Transport } from './transport'
import { InmemoryTransport } from './transport-inmemory'
import { DependantCallsOfTrigger, Trigger } from './trigger'

export type UnitedCtx<T extends any[]> = T extends [infer DF, ...infer Rest]
  ? DF extends CallHandler<infer Ctx, any, any>
    ? Ctx & UnitedCtx<Rest>
    : unknown
  : unknown

export const App = <DFs extends Array<CallHandler<any, any, any>>>(props: {
  name: string
  dfs: DFs
  ctx: () => UnitedCtx<DFs>
  transport?: Transport
  discovery?: {
    host: string
  }
  triggers?: Array<Trigger<any>>
  logger?: Logger
}) => {
  const { name, dfs, triggers, discovery, ctx } = props

  const logger: Logger = props.logger || {
    info: console.log,
    error: console.error,
    warn: console.warn
  }

  const { transport = InmemoryTransport.new({ logger }) } = props

  const depsCallHandlers: Record<string, string[]> = {}

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
          depsCallHandlers[df.call.name] = []

          if (depCalls) {
            Object.values(depCalls).map((depCallRaw) => {
              const depCall = depCallRaw as Call
              depsCallHandlers[df.call.name]!.push(depCall.name)
            })
          }

          // # Sub call on transaport
          await transport.subscribe(df, ctx as () => Record<any, any>)
        })
      )

      // # Init triggers
      await Promise.all(
        triggers?.map(async <T extends Trigger<Record<string, Call<any, any, any, any>>>>(tr: T) => {
          const { depCalls, name: triggerName = 'Trigger' } = tr

          // # Map throw Dep Calls to register dependencies
          if (depCalls) {
            Object.values(depCalls).map((depCall) => {
              if (depsCallHandlers[triggerName]) {
                depsCallHandlers[triggerName].push(depCall.name)
              } else {
                depsCallHandlers[triggerName] = [depCall.name]
              }
            })
          } else {
            depsCallHandlers[name] = []
          }

          const depCallsAsFn = {} as DependantCallsOfTrigger<T>

          for (const key of Object.keys(depCalls)) {
            // # Publish dep call and return result
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            depCallsAsFn[key] = async (request: CallRequest) => {
              return transport.publish(request)
            }
          }

          await tr.init(depCallsAsFn)
        }) || []
      )

      // # Check all deps
      for (const callName of Object.keys(depsCallHandlers)) {
        await Promise.all(
          depsCallHandlers[callName]!.map(async (depName) => {
            if (depsCallHandlers[depName]) {
              logger.info(`CallHandler ${callName} is dependednt on ${depName} tart IS presented localy`)
            } else {
              if (!discovery) {
                const exist = await transport.checkDfExistence(depName)

                if (exist === true) {
                  logger.warn(`CallHandler ${callName} is dependednt on ${depName} that IS presented in transport`)
                } else if (exist === false) {
                  logger.warn(`CallHandler ${callName} is dependednt on ${depName} that IS NOT presented in transport`)
                } else {
                  logger.warn(`CallHandler ${callName} is dependednt on ${depName} that CAN'T be dicovered`)
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

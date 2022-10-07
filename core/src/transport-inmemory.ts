import { ReactiveCounter } from '@fddf-ts/core/reactive-counter'

import { Call, CallHandler, DependantCalls, Logger } from './core'
import { SubscriberNotFoundError } from './errors'

export const InmemoryTransport = {
  name: 'InmemoryTransaport',
  new: (props: { logger?: Logger; reactiveCounter?: ReactiveCounter } = {}) => {
    const { reactiveCounter } = props

    // let logger: Logger = props?.logger || {
    //   info: console.log,
    //   error: console.error,
    //   warn: console.warn
    // }

    let subs: Record<
      string,
      {
        df: CallHandler<any, any, any>
        handler: (callRequest: any) => Promise<any>
      }
    > = {}

    const publish = async <C extends Call<any, any, any, any>>(
      callRequest: ReturnType<C['request']>
    ): Promise<ReturnType<C['result']>> => {
      const sub = subs[callRequest.name]

      if (sub) {
        return await sub.handler(callRequest)
      }

      throw new SubscriberNotFoundError(`No handler for: ${callRequest.name}`)
    }

    return {
      init: async () => {
        return
      },

      getSub: (callName: string) => {
        return subs[callName]
      },

      destroy: async () => {
        subs = {}
      },

      checkDfExistence: async (callName: string) => {
        return !!subs[callName]
      },

      subscribe: async <
        Ctx extends Record<any, any>,
        Deps extends Record<string, Call<any, any, any, any>>,
        Cl extends Call<any, any, any, any>
      >(
        df: CallHandler<Ctx, Deps, Cl>,
        ctx: () => Ctx
      ): Promise<void> => {
        const { depCalls: depCallsRaw, call, handler } = df

        const depCalls = {} as DependantCalls<Deps>

        for (const key of Object.keys(depCallsRaw)) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          depCalls[key] = async (request: ReturnType<C['request']>) => {
            // # Publish dep call and return result
            return publish(request)
          }
        }

        // # Subscribe
        subs[call.name] = {
          df,
          handler: async (callRequest: ReturnType<Cl['request']>): Promise<ReturnType<Cl['result']>> => {
            if (reactiveCounter) {
              reactiveCounter.increment()
            }

            try {
              return await handler(callRequest, ctx(), depCalls)
            } finally {
              if (reactiveCounter) {
                reactiveCounter.decrement()
              }
            }
          }
        }
      },

      publish
    }
  }
}

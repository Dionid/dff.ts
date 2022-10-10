import { CallHandler } from '@distributed-functions/core'

import { DynamicCall } from '../../../libs/calls'

export type Dynamic = ReturnType<typeof Dynamic>
export const Dynamic = (id: string) =>
  CallHandler({
    call: DynamicCall(id),
    depCalls: {},
    handler: async (req, ctx: { dynamicDep: string }, calls) => {
      return DynamicCall(id).result({
        req,
        result: {
          someResp: 'OK'
        }
      })
    }
  })

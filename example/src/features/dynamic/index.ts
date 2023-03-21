import { CallHandler } from '@distributed-functions/core'

import { DynamicCall } from '../../libs/calls'

export const DynamicCallHandler = (id: string) =>
  CallHandler({
    call: DynamicCall(id),
    run: async (req, ctx: { dynamicDep: string }) => {
      return DynamicCall(id).success(req, {
        someResp: 'OK'
      })
    }
  })

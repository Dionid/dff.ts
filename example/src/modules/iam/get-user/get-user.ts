import { CallHandler } from '@distributed-functions/core'

import { GetUserCall } from '../../../libs/calls'

export type GetUser = typeof GetUser
export const GetUser = CallHandler({
  call: GetUserCall,
  depCalls: {},
  handler: async (req, ctx, calls) => {
    return GetUserCall.result({
      req,
      result: {
        email: 'some@mail.com'
      }
    })
  }
})

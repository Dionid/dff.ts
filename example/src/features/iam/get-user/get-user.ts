import { CallHandler } from '@distributed-functions/core/call-handler'

import { GetUserCall } from '../../../libs/calls'

export const GetUserCallHandler = CallHandler({
  call: GetUserCall,
  run: async (req, ctx, calls) => {
    return GetUserCall.success(req, {
      email: 'some@mail.com'
    })
  }
})

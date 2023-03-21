import { CallHandler } from '@distributed-functions/core'
import { InternalError } from '@fddf-ts/core/typed-errors'

import { GetUserCall, WithdrawMoneyCall } from '../../../libs/calls'

export const WithdrawMoneyCallHandler = CallHandler({
  call: WithdrawMoneyCall,
  callsToPublish: {
    GetUserCall
  },
  run: async (req, ctx: { some: number }, { call }) => {
    const res = await call.GetUserCall(
      GetUserCall.request({
        userId: '1234'
      })
    )

    if (res.result.$case === 'failure') {
      throw new InternalError(`Failed call request`)
    }

    return WithdrawMoneyCall.success(req, {
      email: res.result.success.email,
      address: req.params.address,
      amount: req.params.amount
    })
  }
})

import { CallHandler } from '@distributed-functions/core'
import { InternalError } from '@fddf-ts/core/categorized-errors'

import { GetUserCall, WithdrawMoneyCall } from '../../../libs/calls'

export type WithdrawMoney = typeof WithdrawMoney
export const WithdrawMoney = CallHandler({
  call: WithdrawMoneyCall,
  depCalls: {
    getUser: GetUserCall
  },
  persistent: true,
  handler: async (req, ctx: { some: number }, calls) => {
    const res = await calls.getUser(
      GetUserCall.request({
        userId: '1234'
      })
    )

    if ('error' in res) {
      throw new InternalError(`...`)
    }

    return WithdrawMoneyCall.result({
      req,
      result: {
        email: res.result.email,
        address: req.params.address,
        amount: req.params.amount
      }
    })
  }
})

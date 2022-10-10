import { Call } from '@distributed-functions/core'
import { JSONValue } from '@fddf-ts/core/jsonvalue'

export type GetUserCall = typeof GetUserCall
export const GetUserCall = Call<
  'GetUser',
  {
    userId: string
  },
  {
    email: string
  }
>('GetUser')

export type WithdrawMoneyCall = typeof WithdrawMoneyCall
export const WithdrawMoneyCall = Call<
  'WithdrawMoney',
  {
    amount: number
    address: string
    test: {
      foo: string
    }
  },
  {
    email: string
    amount: number
    address: string
  },
  {
    code: 100
    message: 'Shiiiit'
  }
>('WithdrawMoney', {
  requestParser: {
    amount: JSONValue.toNumber,
    address: JSONValue.toString,
    test: {
      foo: JSONValue.toString
    }
  }
})

export type DynamicCall = ReturnType<typeof DynamicCall>

export const DynamicCall = (id: string) => {
  return Call<
    `Dinamic_${typeof id}`,
    {
      amount: number
      address: string
    },
    {
      someResp: string
    },
    {
      code: 100
      message: 'Shiiiit'
    }
  >(`Dinamic_${id}`)
}

import { DefaultCallResponseResultFailure } from '@distributed-functions/core/call'
import { CustomEitherCall } from '@distributed-functions/core/custom-either-call'
import { v4 } from 'uuid'

// # Specify your own call
export type ExampleCustomEitherCallMeta = {
  traceId: string
  ts: number
}

export type ExampleCustomEitherCall<
  Name extends string,
  RequestParams extends Record<any, any>,
  Success extends Record<any, any>,
  Failure extends DefaultCallResponseResultFailure = DefaultCallResponseResultFailure
> = CustomEitherCall<Name, ExampleCustomEitherCallMeta, RequestParams, Success, Failure>

export const ExampleCustomEitherCall = <
  Name extends string,
  Params extends Record<any, any>,
  Success extends Record<any, any>,
  Failure extends DefaultCallResponseResultFailure = DefaultCallResponseResultFailure
>(
  name: Name
) => {
  return CustomEitherCall<Name, ExampleCustomEitherCallMeta, Params, Success, Failure>(name, (meta) => {
    return {
      traceId: meta?.traceId ?? v4(),
      ts: meta?.ts ?? Date.now()
    }
  })
}

export type GetUserCall = typeof GetUserCall
export const GetUserCall = ExampleCustomEitherCall<
  'GetUser',
  {
    userId: string
  },
  {
    email: string
  }
>('GetUser')

export type WithdrawMoneyCall = typeof WithdrawMoneyCall
export const WithdrawMoneyCall = ExampleCustomEitherCall<
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
  }
>('WithdrawMoney')

export type DynamicCall = ReturnType<typeof DynamicCall>

export const DynamicCall = (id: string) => {
  return ExampleCustomEitherCall<
    `Dynamic.${typeof id}`,
    {
      amount: number
      address: string
    },
    {
      someResp: string
    }
  >(`Dynamic.${id}`)
}

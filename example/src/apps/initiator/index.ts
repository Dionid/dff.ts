// CALLS
import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'

import { DynamicCall, WithdrawMoneyCall } from '../../libs/calls'

// ORGANISM

const main = async () => {
  // const logger = pino({})

  const transport = RabbitMQTransport.new({
    config: {
      host: 'localhost',
      port: 5674,
      username: 'ff-user',
      password: 'ff-password',
      heartbeat: 10,
      vhost: 'ff'
    },
    timeout: 1000
  })

  await transport.init()

  const res = await transport.publish<WithdrawMoneyCall>(
    WithdrawMoneyCall.request({
      address: 'qweqwe',
      amount: 1,
      test: {
        foo: 'oefko'
      }
    })
  )

  // eslint-disable-next-line no-restricted-syntax
  console.log('res', res)

  const dRes = await transport.publish<DynamicCall>(
    DynamicCall('12345').request({
      address: 'asdasdqwe',
      amount: 0
    })
  )

  // eslint-disable-next-line no-restricted-syntax
  console.log('dRes', dRes)

  transport.destroy()
}

main()

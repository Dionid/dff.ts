import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'

import { WithdrawMoneyCallHandler } from '../../features/money/withdraw'

const main = async () => {
  const transport = RabbitMQTransport({
    appName: 'money',
    ctx: () => {
      return {
        some: 1000
      }
    },
    config: {
      hostname: 'localhost',
      port: 5674,
      username: 'ff-user',
      password: 'ff-password',
      heartbeat: 10,
      vhost: 'ff'
    }
  })

  transport.call.subscribeHandler(WithdrawMoneyCallHandler)

  await transport.init()
}

main()

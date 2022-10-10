import { App } from '@distributed-functions/core'
import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'

import { GetUser } from '../../modules/iam/get-user/get-user'
import { WithdrawMoney } from '../../modules/money/withdraw'

const main = async () => {
  const transport = RabbitMQTransport.new({
    config: {
      host: 'localhost',
      port: 5674,
      username: 'ff-user',
      password: 'ff-password',
      heartbeat: 10,
      vhost: 'ff'
    }
  })

  const app = App<[WithdrawMoney, GetUser]>({
    name: 'money',
    dfs: [WithdrawMoney, GetUser],
    transport,
    ctx: () => {
      return {
        some: 1
      }
    }
  })

  await app.start()
}

main()

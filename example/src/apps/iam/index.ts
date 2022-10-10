import { App } from '@distributed-functions/core'
import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'

import { GetUser } from '../../modules/iam/get-user/get-user'

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

  const app = App<[GetUser]>({
    name: 'iam',
    dfs: [GetUser],
    transport,
    ctx: () => {
      return {}
    }
  })

  await app.start()
}

main()

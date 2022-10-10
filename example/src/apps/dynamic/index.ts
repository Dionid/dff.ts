import { App } from '@distributed-functions/core'
import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'

import { Dynamic } from '../../modules/some/dynamic'

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

  const app = App<[Dynamic]>({
    name: 'iam',
    dfs: [Dynamic('12345')],
    transport,
    ctx: () => {
      return {
        dynamicDep: 'YESSS'
      }
    }
  })

  await app.start()
}

main()

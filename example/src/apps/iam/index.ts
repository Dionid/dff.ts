import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'

import { GetUserCallHandler } from '../../features/iam/get-user/get-user'

const main = async () => {
  const transport = RabbitMQTransport({
    appName: 'iam',
    config: {
      hostname: 'localhost',
      port: 5674,
      username: 'ff-user',
      password: 'ff-password',
      heartbeat: 10,
      vhost: 'ff'
    }
  })

  transport.call.subscribeHandler(GetUserCallHandler)

  await transport.init()
}

main()

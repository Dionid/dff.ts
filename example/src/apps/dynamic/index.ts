import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'

import { DynamicCallHandler } from '../../features/dynamic'

const main = async () => {
  const transport = RabbitMQTransport({
    appName: 'dynamic',
    ctx: () => {
      return {
        dynamicDep: 'some_dep'
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

  transport.call.subscribeHandler(DynamicCallHandler('12345'))

  await transport.init()
}

main()

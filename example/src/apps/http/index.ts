import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'
import fastify, { FastifyRequest } from 'fastify'
import { v4 } from 'uuid'

import { WithdrawMoneyCall } from '../../libs/calls'

export const main = async () => {
  const transport = RabbitMQTransport({
    appName: 'http',
    config: {
      hostname: 'localhost',
      port: 5674,
      username: 'ff-user',
      password: 'ff-password',
      heartbeat: 10,
      vhost: 'ff'
    },
    callsToPublish: {
      WithdrawMoneyCall
    }
  })

  const http = fastify({
    logger: true,
    genReqId: () => v4()
  })

  http.get('/', async (req: FastifyRequest<{ Querystring: { amount: string; address: string } }>, res) => {
    const response = await transport.call.WithdrawMoneyCall(
      WithdrawMoneyCall.request({
        amount: parseInt(req.query.amount),
        address: req.query.address,
        test: {
          foo: 'test'
        }
      })
    )

    res.send(response)
  })

  await transport.init()
  await http.listen({ port: 3000 })
}

main()

import { App, Trigger } from '@distributed-functions/core'
import { RabbitMQTransport } from '@distributed-functions/transport-rabbitmq'
import fastify, { FastifyRequest } from 'fastify'
import { v4 } from 'uuid'

import { WithdrawMoneyCall } from '../../libs/calls'

const httpTrigger = () => {
  const http = fastify({
    logger: true,
    genReqId: () => v4()
  })

  return Trigger({
    depCalls: {
      withdrawMoneyCall: WithdrawMoneyCall
    },
    destroy: async () => {
      await http.close()
    },
    init: async (depCalls) => {
      http.get('/', async (req: FastifyRequest<{ Querystring: { amount: string; address: string } }>, res) => {
        const response = await depCalls.withdrawMoneyCall(
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

      await http.listen({ port: 3000 })
    }
  })
}

export const main = async () => {
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

  const app = App({
    name: 'iam',
    dfs: [],
    triggers: [httpTrigger()],
    transport,
    ctx: () => {
      return {}
    }
  })

  await app.start()
}

main()

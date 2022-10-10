import { Call, CallRequest, Trigger } from '@distributed-functions/core'
import fastify, { FastifyInstance, FastifyRequest } from 'fastify'
import { v4 } from 'uuid'

export const HttpTrigger = {
  new: <Deps extends Record<string, Call<any, any, any, any>>>(props: {
    calls: Array<Call<any, any, any, any>>
    config?: {
      port?: number
      path?: string
    }
  }): Trigger<Deps> & { fastifyApp: FastifyInstance } => {
    const { calls, config = {} } = props

    const { port = 3000, path = '/call' } = config

    const depCalls = calls.reduce((acc, cur) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      acc[cur.name] = cur

      return acc
    }, {} as Deps)

    const fastifyApp = fastify({
      logger: true,
      genReqId: () => v4()
    })

    return {
      fastifyApp,
      ...Trigger<Deps>({
        name: 'HttpFastifyTrigger',
        depCalls,
        destroy: async () => {
          await fastifyApp.close()
        },
        init: async (initDepCalls) => {
          fastifyApp.post(path, async (req: FastifyRequest<{ Body: CallRequest }>, res) => {
            const call = initDepCalls[req.body.name]

            if (call) {
              const response = await call(req.body as ReturnType<Deps[string]['request']>)

              res.send(response)
            } else {
              res.status(404).send({
                id: req.body.id,
                error: {
                  code: 404,
                  message: "Haven't found call"
                }
              })
            }
          })

          await fastifyApp.listen({ port })
        }
      })
    }
  }
}

import { Logger } from '@distributed-functions/core'
import { WaitGroup } from '@fapfop/core/wait-group'
import { connect, Connection, Options } from 'amqplib'

export const getQueueFullName = (queueName: string, prefix?: string, postfix?: string): string => {
  if (queueName === '') {
    return ''
  }

  return [prefix, queueName, postfix].filter((_) => !!_).join('-')
}

export const createChannel = async (connection: Connection) => {
  try {
    return await connection.createChannel()
  } catch (err) {
    if (err instanceof Error) {
      // # If there is problem with allocation, than shut down application
      if (err.message.includes('allocate')) {
        process.emit('SIGINT', 'SIGINT')
      }
    }

    throw err
  }
}

export type RabbitMqClientConfig = {
  hostname: string
  port: number
  username: string
  password: string
  heartbeat?: number
  vhost?: string
  prefix?: string
  postfix?: string
}

export const initConnection = async (logger: Logger, config: RabbitMqClientConfig, onConnectCallback?: () => any) => {
  const connectionOptions: Options.Connect = {
    hostname: config.hostname,
    port: config.port,
    username: config.username,
    password: config.password,
    heartbeat: config.heartbeat ?? 10
  }

  if (config.vhost) {
    connectionOptions.vhost = config.vhost
  }

  logger.info(
    `try to connection to rabbit host: ${connectionOptions.hostname ?? 'default'}, port: ${connectionOptions.port ?? 0}`
  )

  const connection = await connect(connectionOptions)

  logger.info('connected')

  if (onConnectCallback) {
    logger.info('_onConnectCallback running...')

    try {
      await onConnectCallback()
    } catch (e) {
      logger.error('error in _onConnectCallback')
      throw e
    }

    logger.info('_onConnectCallback finished success')
  }

  return connection
}

export const checkConnectionReady =
  (isReconnecting: WaitGroup) =>
  <Args extends any[], Res>(fn: (...props: Args) => Promise<Res>) =>
  async (...props: Args): Promise<Res> => {
    await isReconnecting.waitUntilOrLess(0)

    return fn(...props)
  }

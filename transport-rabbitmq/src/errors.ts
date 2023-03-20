import { JSONValue } from '@fddf-ts/core/typed-json'

export class ReplyTimeoutError extends Error {
  constructor(correlationId: string, data: JSONValue) {
    super(`Timeout for ${correlationId} with ${data}`)
  }
}

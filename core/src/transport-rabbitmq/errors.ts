import { JSONValue } from '@fddf-ts/core/jsonvalue'

export class ReplyTimeoutError extends Error {
  constructor(correlationId: string, data: JSONValue) {
    super(`Timeout for ${correlationId} with ${data}`)
  }
}

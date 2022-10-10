export type CallErrorResponseErrorBase<
  Code extends number = number,
  Message extends string = string,
  Data extends Record<any, any> | undefined = undefined
> = {
  code: Code
  message: Message
  data?: Data
}

export type CallServerErrorResponseError = CallErrorResponseErrorBase<500, 'Internal Server Error'>
export type CallRequestTimeoutErrorResponseError = CallErrorResponseErrorBase<408, 'Request timeout'>
export type CallNotFoundErrorResponseError = CallErrorResponseErrorBase<404>
export type CallForbiddenErrorResponseError = CallErrorResponseErrorBase<403>
export type CallBadRequestErrorResponseError = CallErrorResponseErrorBase<422>

export type CallErrorResponseError =
  | CallServerErrorResponseError
  | CallNotFoundErrorResponseError
  | CallForbiddenErrorResponseError
  | CallBadRequestErrorResponseError
  | CallRequestTimeoutErrorResponseError

export type CallErrorResponse<RespError extends CallErrorResponseErrorBase = CallErrorResponseError> = {
  id: string
  error: RespError
}

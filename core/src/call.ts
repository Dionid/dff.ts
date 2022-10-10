import { JSONObject, JSONValue } from '@fddf-ts/core/jsonvalue'
import { v4 } from 'uuid'

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

export type CallRequest<Name extends string = string, ReqParams extends JSONObject = JSONObject> = {
  id: string
  name: Name
  params: ReqParams
}

export type CallResponseResult<RespResult extends JSONObject = JSONObject> = {
  id: string
  result: RespResult
}

export type CallResponse<
  RespResult extends JSONObject = JSONObject,
  RespError extends CallErrorResponseErrorBase = CallErrorResponseError
> = CallResponseResult<RespResult> | CallErrorResponse<RespError>

export type Call<
  Name extends string = string,
  ReqParams extends JSONObject = JSONObject,
  RespResult extends JSONObject = JSONObject,
  RespError extends CallErrorResponseErrorBase = CallErrorResponseError
> = {
  name: Name
  requestParser?: RequestParser<ReqParams>
  sideEffects?: boolean
  request: (params: ReqParams, id?: string) => CallRequest<Name, ReqParams>
  result: (
    props: { id: string; result: RespResult } | { req: CallRequest<Name, ReqParams>; result: RespResult }
  ) => CallResponseResult<RespResult>
  error: (
    props: { id: string; error: RespError } | { req: CallRequest<Name, ReqParams>; error: RespError }
  ) => CallErrorResponse<RespError>
}

type RPF = (propName: string, val: JSONValue) => Promise<JSONValue> | JSONValue

export type RequestParser<ReqParams extends JSONObject> = {
  [K in keyof ReqParams]: ReqParams[K] extends JSONObject ? RequestParser<ReqParams[K]> : RPF
}

export const Call = <
  Name extends string = string,
  ReqParams extends JSONObject = JSONObject,
  RespResult extends JSONObject = JSONObject,
  RespError extends CallErrorResponseErrorBase = CallErrorResponseError
>(
  name: Name,
  props: {
    sideEffects?: boolean
    requestParser?: RequestParser<ReqParams> // TODO. Create from ReqParams
  } = {}
): Call<Name, ReqParams, RespResult, RespError> => {
  const { sideEffects = false, requestParser } = props

  return {
    name,
    requestParser,
    sideEffects,
    request: (params: ReqParams, id?: string) => {
      return {
        id: id || v4(),
        name,
        params
      }
    },
    result: (props: { id: string; result: RespResult } | { req: CallRequest<Name, ReqParams>; result: RespResult }) => {
      const { result } = props

      if ('req' in props) {
        return {
          id: props.req.id,
          result
        }
      } else {
        return {
          id: props.id,
          result
        }
      }
    },
    error: (props: { id: string; error: RespError } | { req: CallRequest<Name, ReqParams>; error: RespError }) => {
      const { error } = props

      if ('req' in props) {
        return {
          id: props.req.id,
          error
        }
      } else {
        return {
          id: props.id,
          error
        }
      }
    }
  }
}

export type DependantCalls<Deps extends Record<string, Call<any, any, any, any>>> = {
  [K in keyof Deps]: (request: ReturnType<Deps[K]['request']>) => Promise<ReturnType<Deps[K]['result']>>
}

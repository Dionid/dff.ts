import { v4 } from 'uuid'

export type Empty = Record<string, never>

export type CallRequest<Name extends string, Params extends Record<any, any>> = {
  id: string
  name: Name
  params: Params
}

export type CallResponse<Result extends Record<any, any>> = {
  id: string
  result: Result
}

export type Call<Name extends string, Request extends CallRequest<Name, any>, Response extends CallResponse<any>> = {
  name: Name
  request: (...args: any[]) => Request
  response: (...args: any[]) => Response
}

// # CONSTRUCTOR

export const Call = <Name extends string, Request extends CallRequest<Name, any>, Response extends CallResponse<any>>(
  name: Name
) => {
  return {
    name,
    request: (request: Omit<Request, 'id' | 'name'>) => {
      return {
        id: v4(),
        name,
        ...request
      } as Request
    },
    response: (idOrRequest: string | Request, response: Omit<Response, 'id'>) => {
      return {
        id: typeof idOrRequest === 'string' ? idOrRequest : idOrRequest.id,
        ...response
      } as Response
    }
  }
}

// # UTILS

export type RequestFromCall<C extends Call<any, any, any>> = ReturnType<C['request']>
export type ResponseFromCall<C extends Call<any, any, any>> = ReturnType<C['response']>

export type CallsRecord = Record<string, Call<string, any, any>>

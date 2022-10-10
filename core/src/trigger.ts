import { Call, DependantCalls } from './call'

export type DependantCallsOfTrigger<T extends Trigger<any>> = T extends Trigger<infer Deps>
  ? DependantCalls<Deps>
  : unknown

export type Trigger<Deps extends Record<string, Call<any, any, any, any>>> = {
  name?: string
  depCalls: Deps
  init: (depCalls: DependantCalls<Deps>) => Promise<void>
  destroy: () => Promise<void>
}

export const Trigger = <Deps extends Record<string, Call<any, any, any, any>>>(props: {
  depCalls: Deps
  init: (depCalls: DependantCalls<Deps>) => Promise<void>
  destroy: () => Promise<void>
  name?: string
}) => {
  return props
}

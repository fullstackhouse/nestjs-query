import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { Class, Filter } from '@ptc-org/nestjs-query-core'

import { Authorizer } from '../auth'
import { InjectAuthorizer } from '../decorators'

export type ClientFilterReferences<DTO> = (field: keyof DTO & string) => boolean

export type AuthorizerContext<DTO> = {
  authorizer: Authorizer<DTO>
  clientFilter?: Filter<DTO>
  clientFilterReferences?: ClientFilterReferences<DTO>
}

export function filterReferencesField<DTO>(filter: Filter<DTO> | undefined, field: keyof DTO & string): boolean {
  if (!filter) return false
  for (const key of Object.keys(filter) as (keyof Filter<DTO>)[]) {
    if (key === field) return true
    if (key === 'and' || key === 'or') {
      const group = filter[key] as Filter<DTO>[] | undefined
      if (group?.some((sub) => filterReferencesField(sub, field))) return true
    }
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractClientFilter<DTO>(args: Record<string, any> | undefined): Filter<DTO> | undefined {
  if (!args) return undefined
  if (args.filter) return args.filter as Filter<DTO>
  if (args.input?.filter) return args.input.filter as Filter<DTO>
  return undefined
}

export function AuthorizerInterceptor<DTO>(DTOClass: Class<DTO>): Class<NestInterceptor> {
  @Injectable()
  class Interceptor implements NestInterceptor {
    constructor(@InjectAuthorizer(DTOClass) readonly authorizer: Authorizer<DTO>) {}

    intercept(context: ExecutionContext, next: CallHandler) {
      const gqlContext = GqlExecutionContext.create(context)
      const ctx = gqlContext.getContext<AuthorizerContext<DTO>>()
      ctx.authorizer = this.authorizer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const args = gqlContext.getArgs<Record<string, any>>()
      const clientFilter = extractClientFilter<DTO>(args)
      ctx.clientFilter = clientFilter
      ctx.clientFilterReferences = (field) => filterReferencesField<DTO>(clientFilter, field)
      return next.handle()
    }
  }

  Object.defineProperty(Interceptor, 'name', {
    writable: false,
    // set a unique name otherwise DI does not inject a unique one for each request
    value: `${DTOClass.name}AuthorizerInterceptor`
  })

  return Interceptor
}

import { ExecutionContext } from '@nestjs/common'
import { Filter } from '@ptc-org/nestjs-query-core'

import { Authorizer } from '../../src/auth'
import {
  AuthorizerContext,
  AuthorizerInterceptor,
  filterReferencesField
} from '../../src/interceptors/authorizer.interceptor'

describe('filterReferencesField', () => {
  type Row = { id: number; deletedAt: Date | null; name: string }

  it('returns true when the field is a direct key', () => {
    const filter: Filter<Row> = { deletedAt: { isNot: null } }
    expect(filterReferencesField(filter, 'deletedAt')).toBe(true)
  })

  it('returns false when the field is absent', () => {
    const filter: Filter<Row> = { name: { eq: 'x' } }
    expect(filterReferencesField(filter, 'deletedAt')).toBe(false)
  })

  it('descends into and groups', () => {
    const filter: Filter<Row> = {
      and: [{ name: { eq: 'x' } }, { deletedAt: { isNot: null } }]
    }
    expect(filterReferencesField(filter, 'deletedAt')).toBe(true)
  })

  it('descends into or groups', () => {
    const filter: Filter<Row> = {
      or: [{ name: { eq: 'x' } }, { and: [{ deletedAt: { isNot: null } }] }]
    }
    expect(filterReferencesField(filter, 'deletedAt')).toBe(true)
  })

  it('returns false for undefined filter', () => {
    expect(filterReferencesField<Row>(undefined, 'deletedAt')).toBe(false)
  })
})

describe('AuthorizerInterceptor', () => {
  type Row = { id: number; deletedAt: Date | null }

  class TestDTO {
    id!: number

    deletedAt!: Date | null
  }

  const fakeAuthorizer = {} as Authorizer<TestDTO>

  const createExecutionContext = (args: Record<string, unknown>, ctx: Record<string, unknown> = {}): ExecutionContext => {
    const gqlArgs = [null, args, ctx, null] as const
    return {
      getType: () => 'graphql',
      getArgs: () => gqlArgs,
      getArgByIndex: (i: number) => gqlArgs[i],
      switchToHttp: () => ({}),
      switchToRpc: () => ({}),
      switchToWs: () => ({}),
      getClass: () => undefined,
      getHandler: () => undefined
    } as unknown as ExecutionContext
  }

  it('populates authorizer, clientFilter, and clientFilterReferences on the gql context', async () => {
    const InterceptorClass = AuthorizerInterceptor(TestDTO)
    const interceptor = new InterceptorClass(fakeAuthorizer)
    const gqlContext: AuthorizerContext<Row> = {} as AuthorizerContext<Row>
    const filter: Filter<Row> = { deletedAt: { isNot: null } }
    const execContext = createExecutionContext({ filter }, gqlContext)

    await interceptor.intercept(execContext, { handle: () => ({ subscribe: () => undefined }) as never })

    expect(gqlContext.authorizer).toBe(fakeAuthorizer)
    expect(gqlContext.clientFilter).toEqual(filter)
    expect(gqlContext.clientFilterReferences?.('deletedAt')).toBe(true)
    expect(gqlContext.clientFilterReferences?.('id')).toBe(false)
  })

  it('extracts filter from args.input.filter when top-level filter is missing', async () => {
    const InterceptorClass = AuthorizerInterceptor(TestDTO)
    const interceptor = new InterceptorClass(fakeAuthorizer)
    const gqlContext: AuthorizerContext<Row> = {} as AuthorizerContext<Row>
    const filter: Filter<Row> = { id: { eq: 1 } }
    const execContext = createExecutionContext({ input: { filter } }, gqlContext)

    await interceptor.intercept(execContext, { handle: () => ({ subscribe: () => undefined }) as never })

    expect(gqlContext.clientFilter).toEqual(filter)
    expect(gqlContext.clientFilterReferences?.('id')).toBe(true)
  })

  it('leaves clientFilter undefined when no filter is provided', async () => {
    const InterceptorClass = AuthorizerInterceptor(TestDTO)
    const interceptor = new InterceptorClass(fakeAuthorizer)
    const gqlContext: AuthorizerContext<Row> = {} as AuthorizerContext<Row>
    const execContext = createExecutionContext({}, gqlContext)

    await interceptor.intercept(execContext, { handle: () => ({ subscribe: () => undefined }) as never })

    expect(gqlContext.clientFilter).toBeUndefined()
    expect(gqlContext.clientFilterReferences?.('deletedAt')).toBe(false)
  })
})

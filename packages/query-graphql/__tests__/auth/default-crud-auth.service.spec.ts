// eslint-disable-next-line max-classes-per-file
import { Injectable } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Filter } from '@ptc-org/nestjs-query-core'
import { Authorize, Authorizer, Relation, UnPagedRelation } from '@ptc-org/nestjs-query-graphql'

import {
  AuthorizationContext,
  CustomAuthorizer,
  getAuthorizerToken,
  getCustomAuthorizerToken,
  OperationGroup
} from '../../src/auth'
import { createAuthorizerProviders } from '../../src/providers'

describe('createDefaultAuthorizer', () => {
  let testingModule: TestingModule

  type UserContext = { user: { id: number } }

  class TestRelation {
    relationOwnerId!: number
  }

  @Injectable()
  class RelationAuthorizer implements CustomAuthorizer<RelationWithAuthorizer> {
    authorize(context: UserContext): Promise<Filter<RelationWithAuthorizer>> {
      return Promise.resolve({ authorizerOwnerId: { eq: context.user.id } })
    }

    authorizeRelation(): Promise<Filter<unknown> | undefined> {
      return Promise.reject(new Error('should not have called'))
    }
  }

  @Authorize(RelationAuthorizer)
  class RelationWithAuthorizer {
    authorizerOwnerId!: number
  }

  @Authorize({
    authorize: (ctx: UserContext) => ({
      decoratorOwnerId: { eq: ctx.user.id }
    })
  })
  class TestDecoratorRelation {
    decoratorOwnerId!: number
  }

  @Authorize({
    authorize: (ctx: UserContext, authorizationContext?: AuthorizationContext) =>
      authorizationContext?.operationName === 'other' ? { ownerId: { neq: ctx.user.id } } : { ownerId: { eq: ctx.user.id } }
  })
  @Relation('relations', () => TestRelation, {
    auth: {
      authorize: (ctx: UserContext, authorizationContext?: AuthorizationContext) =>
        authorizationContext?.operationName === 'other'
          ? { relationOwnerId: { neq: ctx.user.id } }
          : { relationOwnerId: { eq: ctx.user.id } }
    }
  })
  @UnPagedRelation('unPagedDecoratorRelations', () => TestDecoratorRelation)
  @Relation('authorizerRelation', () => RelationWithAuthorizer)
  class TestDTO {
    ownerId!: number
  }

  class TestNoAuthDTO {
    ownerId!: number
  }

  @Injectable()
  class TestWithAuthorizerAuthorizer implements CustomAuthorizer<TestWithAuthorizerDTO> {
    authorize(context: UserContext): Promise<Filter<TestWithAuthorizerDTO>> {
      return Promise.resolve({ ownerId: { eq: context.user.id } })
    }

    authorizeRelation(): Promise<Filter<unknown> | undefined> {
      return Promise.resolve<undefined>(undefined)
    }
  }

  @Authorize(TestWithAuthorizerAuthorizer)
  @Relation('relations', () => TestRelation, {
    auth: {
      authorize: (ctx: UserContext, authorizationContext?: AuthorizationContext) =>
        authorizationContext?.operationName === 'other'
          ? { relationOwnerId: { neq: ctx.user.id } }
          : { relationOwnerId: { eq: ctx.user.id } }
    }
  })
  @UnPagedRelation('unPagedDecoratorRelations', () => TestDecoratorRelation)
  @Relation('authorizerRelation', () => RelationWithAuthorizer)
  class TestWithAuthorizerDTO {
    ownerId!: number
  }

  @Injectable()
  class TestMutationHooksAuthorizer implements CustomAuthorizer<TestMutationHooksDTO> {
    authorize(context: UserContext): Promise<Filter<TestMutationHooksDTO>> {
      return Promise.resolve({ ownerId: { eq: context.user.id } })
    }

    authorizeUpdate(context: UserContext): Promise<Filter<TestMutationHooksDTO>> {
      return Promise.resolve({ ownerId: { eq: context.user.id }, canUpdate: { is: true } })
    }

    authorizeDelete(context: UserContext): Promise<Filter<TestMutationHooksDTO>> {
      return Promise.resolve({ ownerId: { eq: context.user.id }, canDelete: { is: true } })
    }
  }

  @Authorize(TestMutationHooksAuthorizer)
  class TestMutationHooksDTO {
    ownerId!: number

    canUpdate!: boolean

    canDelete!: boolean
  }

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        ...createAuthorizerProviders([
          TestDecoratorRelation,
          TestRelation,
          RelationWithAuthorizer,
          TestDTO,
          TestNoAuthDTO,
          TestWithAuthorizerDTO,
          TestMutationHooksDTO
        ])
      ]
    }).compile()
  })

  afterAll(() => testingModule.close())

  it('should create an auth filter', async () => {
    const authorizer = testingModule.get<Authorizer<TestDTO>>(getAuthorizerToken(TestDTO))
    const filter = await authorizer.authorize(
      { user: { id: 2 } },
      {
        operationName: 'queryMany',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({ ownerId: { eq: 2 } })
  })

  it('should create an auth filter that depends on the passed operation name', async () => {
    const authorizer = testingModule.get<Authorizer<TestDTO>>(getAuthorizerToken(TestDTO))
    const filter = await authorizer.authorize(
      { user: { id: 2 } },
      {
        operationName: 'other',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({ ownerId: { neq: 2 } })
  })

  it('should return an empty filter if auth not found', async () => {
    const authorizer = testingModule.get<Authorizer<TestNoAuthDTO>>(getAuthorizerToken(TestNoAuthDTO))
    const filter = await authorizer.authorize(
      { user: { id: 2 } },
      {
        operationName: 'queryMany',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({})
  })

  it('should create an auth filter for relations using the default auth decorator', async () => {
    const authorizer = testingModule.get<Authorizer<TestDTO>>(getAuthorizerToken(TestDTO))
    const filter = await authorizer.authorizeRelation(
      'unPagedDecoratorRelations',
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({ decoratorOwnerId: { eq: 2 } })
  })

  it('should create an auth filter for relations using the relation options', async () => {
    const authorizer = testingModule.get<Authorizer<TestDTO>>(getAuthorizerToken(TestDTO))
    const filter = await authorizer.authorizeRelation(
      'relations',
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({ relationOwnerId: { eq: 2 } })
  })

  it('should create an auth filter that depends on the passed operation name for relations using the relation options', async () => {
    const authorizer = testingModule.get<Authorizer<TestDTO>>(getAuthorizerToken(TestDTO))
    const filter = await authorizer.authorizeRelation(
      'relations',
      { user: { id: 2 } },
      {
        operationName: 'other',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({ relationOwnerId: { neq: 2 } })
  })

  it('should create an auth filter for relations using the relation authorizer', async () => {
    const authorizer = testingModule.get<Authorizer<TestDTO>>(getAuthorizerToken(TestDTO))
    const filter = await authorizer.authorizeRelation(
      'authorizerRelation',
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({ authorizerOwnerId: { eq: 2 } })
  })

  it('should return an empty object for an unknown relation', async () => {
    const authorizer = testingModule.get<Authorizer<TestDTO>>(getAuthorizerToken(TestDTO))
    const filter = await authorizer.authorizeRelation(
      'unknownRelations',
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({})
  })

  it('should call authorizeRelation of authorizer and fallback to authorize decorator', async () => {
    const authorizer = testingModule.get<Authorizer<TestWithAuthorizerDTO>>(getAuthorizerToken(TestWithAuthorizerDTO))
    jest.spyOn(authorizer, 'authorizeRelation')
    const customAuthorizer = testingModule.get<CustomAuthorizer<TestWithAuthorizerDTO>>(
      getCustomAuthorizerToken(TestWithAuthorizerDTO)
    )
    jest.spyOn(customAuthorizer, 'authorizeRelation')
    expect(customAuthorizer).toBeDefined()
    const filter = await authorizer.authorizeRelation(
      'unPagedDecoratorRelations',
      { user: { id: 2 } },
      {
        operationName: 'queryMany',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({
      decoratorOwnerId: { eq: 2 }
    })
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(customAuthorizer.authorizeRelation).toHaveBeenCalledWith(
      'unPagedDecoratorRelations',
      { user: { id: 2 } },
      {
        operationName: 'queryMany',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(authorizer.authorizeRelation).toHaveBeenCalledWith(
      'unPagedDecoratorRelations',
      { user: { id: 2 } },
      {
        operationName: 'queryMany',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
  })

  it('should call authorizeRelation of authorizer and fallback to custom authorizer of relation', async () => {
    const authorizer = testingModule.get<Authorizer<TestWithAuthorizerDTO>>(getAuthorizerToken(TestWithAuthorizerDTO))
    jest.spyOn(authorizer, 'authorizeRelation')
    const customAuthorizer = testingModule.get<CustomAuthorizer<TestWithAuthorizerDTO>>(
      getCustomAuthorizerToken(TestWithAuthorizerDTO)
    )
    jest.spyOn(customAuthorizer, 'authorizeRelation')
    expect(customAuthorizer).toBeDefined()
    const relationAuthorizer = testingModule.get<Authorizer<RelationWithAuthorizer>>(getAuthorizerToken(RelationWithAuthorizer))
    jest.spyOn(relationAuthorizer, 'authorize')
    const customRelationAuthorizer = testingModule.get<CustomAuthorizer<RelationWithAuthorizer>>(
      getCustomAuthorizerToken(RelationWithAuthorizer)
    )
    jest.spyOn(customRelationAuthorizer, 'authorize')
    const filter = await authorizer.authorizeRelation(
      'authorizerRelation',
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({
      authorizerOwnerId: { eq: 2 }
    })
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(customAuthorizer.authorizeRelation).toHaveBeenCalledWith(
      'authorizerRelation',
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(authorizer.authorizeRelation).toHaveBeenCalledWith(
      'authorizerRelation',
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(relationAuthorizer.authorize).toHaveBeenCalledWith(
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(customRelationAuthorizer.authorize).toHaveBeenCalledWith(
      { user: { id: 2 } },
      {
        operationName: 'queryRelation',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
  })

  it('should use authorizeUpdate filter on UPDATE operations when defined', async () => {
    const authorizer = testingModule.get<Authorizer<TestMutationHooksDTO>>(getAuthorizerToken(TestMutationHooksDTO))
    const filter = await authorizer.authorize(
      { user: { id: 2 } },
      {
        operationName: 'updateOne',
        operationGroup: OperationGroup.UPDATE,
        readonly: false,
        many: false
      }
    )
    expect(filter).toEqual({ ownerId: { eq: 2 }, canUpdate: { is: true } })
  })

  it('should use authorizeDelete filter on DELETE operations when defined', async () => {
    const authorizer = testingModule.get<Authorizer<TestMutationHooksDTO>>(getAuthorizerToken(TestMutationHooksDTO))
    const filter = await authorizer.authorize(
      { user: { id: 2 } },
      {
        operationName: 'deleteOne',
        operationGroup: OperationGroup.DELETE,
        readonly: false,
        many: false
      }
    )
    expect(filter).toEqual({ ownerId: { eq: 2 }, canDelete: { is: true } })
  })

  it('should fall back to authorize on READ for authorizers with mutation hooks', async () => {
    const authorizer = testingModule.get<Authorizer<TestMutationHooksDTO>>(getAuthorizerToken(TestMutationHooksDTO))
    const filter = await authorizer.authorize(
      { user: { id: 2 } },
      {
        operationName: 'queryMany',
        operationGroup: OperationGroup.READ,
        readonly: true,
        many: true
      }
    )
    expect(filter).toEqual({ ownerId: { eq: 2 } })
  })

  it('should fall back to authorize on UPDATE/DELETE when hooks are not defined (backwards compat)', async () => {
    const authorizer = testingModule.get<Authorizer<TestDTO>>(getAuthorizerToken(TestDTO))
    const updateFilter = await authorizer.authorize(
      { user: { id: 2 } },
      {
        operationName: 'updateOne',
        operationGroup: OperationGroup.UPDATE,
        readonly: false,
        many: false
      }
    )
    expect(updateFilter).toEqual({ ownerId: { eq: 2 } })

    const deleteFilter = await authorizer.authorize(
      { user: { id: 2 } },
      {
        operationName: 'deleteOne',
        operationGroup: OperationGroup.DELETE,
        readonly: false,
        many: false
      }
    )
    expect(deleteFilter).toEqual({ ownerId: { eq: 2 } })
  })
})

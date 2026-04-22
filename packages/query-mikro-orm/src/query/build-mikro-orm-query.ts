import { FilterQuery } from '@mikro-orm/core'
import { OperatorMap } from '@mikro-orm/core/typings'
import { Filter, FilterComparisons } from '@ptc-org/nestjs-query-core'

function expandFilterComparison(k: string, v: unknown): [string, unknown] {
  if (k === 'eq' || k === 'is') {
    return ['$eq', v as string] satisfies ['$eq', OperatorMap<string>['$eq']]
  }

  if (k === 'neq' || k === 'isNot') {
    return ['$ne', v as string] satisfies ['$ne', OperatorMap<string>['$ne']]
  }

  if (k === 'gt') {
    return ['$gt', v as string] satisfies ['$gt', OperatorMap<string>['$gt']]
  }

  if (k === 'gte') {
    return ['$gte', v as string] satisfies ['$gte', OperatorMap<string>['$gte']]
  }

  if (k === 'lt') {
    return ['$lt', v as string] satisfies ['$lt', OperatorMap<string>['$lt']]
  }

  if (k === 'lte') {
    return ['$lte', v as string] satisfies ['$lte', OperatorMap<string>['$lte']]
  }

  if (k === 'in') {
    return ['$in', v as string[]] satisfies ['$in', OperatorMap<string>['$in']]
  }

  if (k === 'notIn') {
    return ['$nin', v as string[]] satisfies ['$nin', OperatorMap<string>['$nin']]
  }

  if (k === 'like') {
    return ['$like', v as string] satisfies ['$like', OperatorMap<string>['$like']]
  }

  if (k === 'notLike') {
    return ['$not', { $like: v as string }]
  }

  if (k === 'iLike') {
    return ['$ilike', v as string] satisfies ['$ilike', OperatorMap<string>['$ilike']]
  }

  if (k === 'notILike') {
    return ['$not', { $ilike: v as string }]
  }

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return [k, expandFilter(v as FilterComparisons<unknown>)]
}

function expandFilter<E>(comparisons: FilterComparisons<unknown>): FilterQuery<E> {
  const entries = Object.entries(comparisons).map(([k, v]) => expandFilterComparison(k, v))
  return Object.fromEntries(entries) as FilterQuery<E>
}

/**
 * Translate a nestjs-query `Filter<E>` into a MikroORM `FilterQuery<E>`.
 *
 * Pure function — no entity metadata, no repository, no assembler.
 * The input is expected to already reference entity fields (run any DTO→Entity
 * conversion such as an assembler's `convertQuery` before calling this).
 *
 * Consumers outside nestjs-query resolvers (custom resolvers, domain services)
 * use this to reuse the same filter dialect the `@Authorize` pipeline produces.
 */
export function buildMikroOrmQuery<E>(filter: Filter<E> | undefined): FilterQuery<E> {
  if (!filter) {
    return {} as FilterQuery<E>
  }

  if ((filter.and || filter.or) && Object.keys(filter).length > 1) {
    throw new Error('filter must contain either only `and` or `or` property, or other properties')
  }

  if (filter.and) {
    return {
      $and: filter.and.map((f) => buildMikroOrmQuery(f))
    } as FilterQuery<E>
  }

  if (filter.or) {
    return {
      $or: filter.or.map((f) => buildMikroOrmQuery(f))
    } as FilterQuery<E>
  }

  return expandFilter<E>(filter as FilterComparisons<unknown>)
}

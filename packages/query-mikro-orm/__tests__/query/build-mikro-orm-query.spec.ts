import { buildMikroOrmQuery } from '../../src'

interface E {
  id: string
  name: string
  age: number
  active: boolean
}

describe('buildMikroOrmQuery', () => {
  it('returns empty object for undefined filter', () => {
    expect(buildMikroOrmQuery<E>(undefined)).toEqual({})
  })

  it('returns empty object for empty filter', () => {
    expect(buildMikroOrmQuery<E>({})).toEqual({})
  })

  it('translates eq', () => {
    expect(buildMikroOrmQuery<E>({ name: { eq: 'foo' } })).toEqual({ name: { $eq: 'foo' } })
  })

  it('translates is', () => {
    expect(buildMikroOrmQuery<E>({ active: { is: true } })).toEqual({ active: { $eq: true } })
  })

  it('translates neq', () => {
    expect(buildMikroOrmQuery<E>({ name: { neq: 'foo' } })).toEqual({ name: { $ne: 'foo' } })
  })

  it('translates isNot', () => {
    expect(buildMikroOrmQuery<E>({ active: { isNot: null } })).toEqual({ active: { $ne: null } })
  })

  it('translates gt/gte/lt/lte', () => {
    expect(buildMikroOrmQuery<E>({ age: { gt: 1, gte: 2, lt: 10, lte: 9 } })).toEqual({
      age: { $gt: 1, $gte: 2, $lt: 10, $lte: 9 }
    })
  })

  it('translates in/notIn', () => {
    expect(buildMikroOrmQuery<E>({ id: { in: ['a', 'b'], notIn: ['c'] } })).toEqual({
      id: { $in: ['a', 'b'], $nin: ['c'] }
    })
  })

  it('translates like/notLike', () => {
    expect(buildMikroOrmQuery<E>({ name: { like: 'a%', notLike: 'b%' } })).toEqual({
      name: { $like: 'a%', $not: { $like: 'b%' } }
    })
  })

  it('translates iLike/notILike', () => {
    expect(buildMikroOrmQuery<E>({ name: { iLike: 'a%', notILike: 'b%' } })).toEqual({
      name: { $ilike: 'a%', $not: { $ilike: 'b%' } }
    })
  })

  it('translates and', () => {
    expect(
      buildMikroOrmQuery<E>({
        and: [{ age: { gt: 3 } }, { age: { lt: 7 } }]
      })
    ).toEqual({
      $and: [{ age: { $gt: 3 } }, { age: { $lt: 7 } }]
    })
  })

  it('translates or', () => {
    expect(
      buildMikroOrmQuery<E>({
        or: [{ age: { eq: 1 } }, { age: { eq: 10 } }]
      })
    ).toEqual({
      $or: [{ age: { $eq: 1 } }, { age: { $eq: 10 } }]
    })
  })

  it('translates nested and/or', () => {
    expect(
      buildMikroOrmQuery<E>({
        or: [{ and: [{ age: { gt: 1 } }, { age: { lt: 5 } }] }, { name: { eq: 'foo' } }]
      })
    ).toEqual({
      $or: [{ $and: [{ age: { $gt: 1 } }, { age: { $lt: 5 } }] }, { name: { $eq: 'foo' } }]
    })
  })

  it('throws when and/or is mixed with field comparisons', () => {
    expect(() =>
      buildMikroOrmQuery<E>({
        and: [{ age: { gt: 1 } }],
        name: { eq: 'foo' }
      } as never)
    ).toThrow('filter must contain either only `and` or `or` property, or other properties')
  })

  it('passes through unknown comparison keys recursively', () => {
    expect(
      buildMikroOrmQuery({
        relation: { nested: { eq: 1 } }
      } as never)
    ).toEqual({
      relation: { nested: { $eq: 1 } }
    })
  })
})

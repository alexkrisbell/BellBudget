import { describe, it, expect } from 'vitest'
import { aggregateCategoryActuals } from './categoryActuals'

describe('aggregateCategoryActuals', () => {
  it('sums amounts grouped by category', () => {
    const result = aggregateCategoryActuals([
      { category_id: 'groceries', amount: 40 },
      { category_id: 'groceries', amount: 60 },
      { category_id: 'shopping', amount: 20 },
    ])
    expect(result).toEqual({ groceries: 100, shopping: 20 })
  })

  it('ignores rows with no category', () => {
    const result = aggregateCategoryActuals([
      { category_id: null, amount: 500 },
      { category_id: 'groceries', amount: 40 },
    ])
    expect(result).toEqual({ groceries: 40 })
  })

  it('returns an empty object for no rows', () => {
    expect(aggregateCategoryActuals([])).toEqual({})
  })

  it('lets a negative (refund) amount net against positive spend in the same category', () => {
    const result = aggregateCategoryActuals([
      { category_id: 'groceries', amount: 100 },
      { category_id: 'groceries', amount: -20 },
    ])
    expect(result).toEqual({ groceries: 80 })
  })
})

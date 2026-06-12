import { describe, expect, it } from 'vitest'
import { ERR_PAGE_LIMIT_REACHED } from '@/lib/constants/errors'

describe('errors', () => {
  it('ERR_PAGE_LIMIT_REACHED は上限値を埋め込む', () => {
    expect(ERR_PAGE_LIMIT_REACHED(100)).toContain('100')
  })
})

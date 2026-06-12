import { describe, expect, it } from 'vitest'
import { actionError, actionSuccess } from '@/types/action-result'

describe('ActionResult', () => {
  it('actionSuccess はデータ付き成功を返す', () => {
    expect(actionSuccess({ id: '1' })).toEqual({ success: true, data: { id: '1' } })
  })
  it('actionSuccess はデータ無しでも成功を返す', () => {
    expect(actionSuccess()).toEqual({ success: true, data: undefined })
  })
  it('actionError はエラーメッセージを返す', () => {
    expect(actionError('NG')).toEqual({ success: false, error: 'NG' })
  })
})

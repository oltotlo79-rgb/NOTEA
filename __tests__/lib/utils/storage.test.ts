import { describe, expect, it } from 'vitest'
import { formatStorageSize } from '@/lib/utils/storage'

describe('formatStorageSize', () => {
  it('0 バイトは 0.0 MB を返す', () => {
    const result = formatStorageSize(0)
    expect(result.value).toBe('0.0')
    expect(result.unit).toBe('MB')
  })

  it('1 MB 未満は MB 表示（小数点1桁）', () => {
    const result = formatStorageSize(500 * 1024)
    expect(result.unit).toBe('MB')
    expect(result.value).toBe('0.5')
  })

  it('84.3 MB のバイト数を正しく変換する', () => {
    const bytes = Math.round(84.3 * 1024 * 1024)
    const result = formatStorageSize(bytes)
    expect(result.unit).toBe('MB')
    expect(parseFloat(result.value)).toBeCloseTo(84.3, 0)
  })

  it('200 MB はちょうど MB 表示', () => {
    const bytes = 200 * 1024 * 1024
    const result = formatStorageSize(bytes)
    expect(result.unit).toBe('MB')
    expect(result.value).toBe('200.0')
  })

  it('1023.9 MB は MB 表示', () => {
    const bytes = Math.floor(1023.9 * 1024 * 1024)
    const result = formatStorageSize(bytes)
    expect(result.unit).toBe('MB')
  })

  it('1024 MB 以上は GB 表示（小数点2桁）', () => {
    const bytes = 1024 * 1024 * 1024
    const result = formatStorageSize(bytes)
    expect(result.unit).toBe('GB')
    expect(result.value).toBe('1.00')
  })

  it('5 GB は GB 表示', () => {
    const bytes = 5 * 1024 * 1024 * 1024
    const result = formatStorageSize(bytes)
    expect(result.unit).toBe('GB')
    expect(result.value).toBe('5.00')
  })

  it('1.23 GB は GB 表示（小数点2桁）', () => {
    const bytes = Math.round(1.23 * 1024 * 1024 * 1024)
    const result = formatStorageSize(bytes)
    expect(result.unit).toBe('GB')
    expect(parseFloat(result.value)).toBeCloseTo(1.23, 1)
  })
})

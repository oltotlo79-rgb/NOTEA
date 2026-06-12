import { describe, expect, it } from 'vitest'
import { passwordSchema, signInSchema, signUpSchema } from '@/lib/validations/auth'

describe('passwordSchema', () => {
  it('8文字以上・英字と数字を含むパスワードを受理', () => {
    expect(passwordSchema.safeParse('abcde123').success).toBe(true)
  })
  it.each([
    ['abc12', '8文字未満'],
    ['abcdefgh', '数字なし'],
    ['12345678', '英字なし'],
  ])('%s を拒否（%s）', (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false)
  })
})

describe('signUpSchema', () => {
  it('正しい入力を受理', () => {
    expect(signUpSchema.safeParse({ email: 'a@example.com', password: 'abcde123' }).success).toBe(true)
  })
  it('不正なメールを拒否', () => {
    expect(signUpSchema.safeParse({ email: 'not-an-email', password: 'abcde123' }).success).toBe(false)
  })
})

describe('signInSchema', () => {
  it('ログインはパスワードポリシーを適用しない（ポリシー導入前の既存ユーザーの救済）', () => {
    expect(signInSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true)
  })
  it('空パスワードは拒否', () => {
    expect(signInSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false)
  })
})

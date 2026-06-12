'use server'

import { revalidatePath } from 'next/cache'
import {
  ERR_AUTH_REQUIRED,
  ERR_INVALID_INPUT,
  ERR_LOGIN_FAILED,
  ERR_PASSWORD_UPDATE_FAILED,
  ERR_SIGNUP_FAILED,
} from '@/lib/constants/errors'
import { createClient } from '@/lib/supabase/server'
import {
  passwordResetRequestSchema,
  passwordUpdateSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validations/auth'
import { actionError, actionSuccess, type ActionResult } from '@/types/action-result'

export async function signUp(input: { email: string; password: string }): Promise<ActionResult> {
  // 1. 認証 — 不要（未認証ユーザーの操作）
  // 2. Zod バリデーション
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  // 4. ビジネスロジック（確認メールのリンク先は Supabase のメールテンプレート側で指定）
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp(parsed.data)
  if (error) return actionError(ERR_SIGNUP_FAILED)
  return actionSuccess()
}

export async function signIn(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return actionError(ERR_LOGIN_FAILED)
  revalidatePath('/', 'layout')
  return actionSuccess()
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return actionSuccess()
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = passwordResetRequestSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const supabase = await createClient()
  // メールアドレスの存在有無を漏らさないため、結果に関わらず成功を返す
  await supabase.auth.resetPasswordForEmail(parsed.data.email)
  return actionSuccess()
}

export async function updatePassword(input: { password: string }): Promise<ActionResult> {
  const parsed = passwordUpdateSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return actionError(ERR_AUTH_REQUIRED)
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return actionError(ERR_PASSWORD_UPDATE_FAILED)
  revalidatePath('/', 'layout')
  return actionSuccess()
}

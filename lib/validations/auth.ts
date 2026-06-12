import { z } from 'zod'

export const emailSchema = z.email({ error: 'メールアドレスの形式が正しくありません' }).max(255)

export const passwordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .regex(/[A-Za-z]/, 'パスワードにはアルファベットを1文字以上含めてください')
  .regex(/[0-9]/, 'パスワードには数字を1文字以上含めてください')

export const signUpSchema = z.object({ email: emailSchema, password: passwordSchema })
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1) })
export const passwordResetRequestSchema = z.object({ email: emailSchema })
export const passwordUpdateSchema = z.object({ password: passwordSchema })

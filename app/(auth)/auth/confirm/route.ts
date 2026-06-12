import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInternalPath } from '@/lib/utils/auth-redirect'

const VALID_OTP_TYPES = ['signup', 'recovery', 'email', 'email_change'] as const

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return VALID_OTP_TYPES.some((t) => t === value)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = sanitizeInternalPath(searchParams.get('next')) ?? ROUTES.PAGES

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?error=auth_confirm`)
}

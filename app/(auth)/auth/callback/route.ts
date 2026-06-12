import { NextResponse, type NextRequest } from 'next/server'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInternalPath } from '@/lib/utils/auth-redirect'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = sanitizeInternalPath(searchParams.get('next')) ?? ROUTES.PAGES

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?error=auth_callback`)
}

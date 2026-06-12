'use client'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/client'

export function GoogleSignInButton() {
  const handleClick = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${ROUTES.AUTH_CALLBACK}?next=${ROUTES.PAGES}`,
      },
    })
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleClick}>
      Google でログイン
    </Button>
  )
}

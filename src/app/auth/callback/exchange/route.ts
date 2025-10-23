import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const isValidRedirect = (redirectPath: string | null) => {
  if (!redirectPath) return false
  try {
    const url = new URL(redirectPath, 'http://example.com')
    return url.origin === 'http://example.com' && url.pathname.startsWith('/')
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectParam = requestUrl.searchParams.get('redirect')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const destination = isValidRedirect(redirectParam)
        ? redirectParam!
        : '/chat'

      return NextResponse.redirect(
        new URL(`/auth/callback?redirect=${encodeURIComponent(destination)}`, requestUrl.origin)
      )
    }
  }

  return NextResponse.redirect(
    new URL('/auth?error=authentication_failed', requestUrl.origin)
  )
}

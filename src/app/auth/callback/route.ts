import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // If we have a next parameter, decode and redirect to it
      if (next) {
        const decodedNext = decodeURIComponent(next)
        return NextResponse.redirect(new URL(decodedNext, requestUrl.origin))
      }
      
      // Otherwise, redirect to the default chat page
      return NextResponse.redirect(new URL('/chat', requestUrl.origin))
    }
  }

  // Return the user to an error page with error details
  return NextResponse.redirect(
    new URL('/auth?error=authentication_failed', requestUrl.origin)
  )
}
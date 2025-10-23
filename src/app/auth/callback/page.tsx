'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'

const resolveRedirect = (rawRedirect: string | null) => {
  if (!rawRedirect) return '/chat'
  try {
    const url = new URL(rawRedirect, 'http://example.com')
    return url.origin === 'http://example.com' && url.pathname.startsWith('/')
      ? `${url.pathname}${url.search}${url.hash}`
      : '/chat'
  } catch {
    return '/chat'
  }
}

export default function OAuthCallbackPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (loading) return

    const destination = resolveRedirect(searchParams.get('redirect'))

    if (user) {
      router.replace(destination)
    } else {
      router.replace('/auth?error=authentication_failed')
    }
  }, [loading, router, searchParams, user])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative">
      <AnimatedBackground opacity={0.3} />
      <div className="relative z-10 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div>
          <p className="text-lg font-semibold text-gray-800">Signing you in...</p>
          <p className="text-sm text-gray-500">Preparing your workspace</p>
        </div>
      </div>
    </div>
  )
}

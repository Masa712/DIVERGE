'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { useAuth } from '@/components/providers/auth-provider'

// PostHog client-side initialization
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // We'll manually capture pageviews
    capture_pageleave: true,
    // Disable autocapture to avoid ad blocker issues
    autocapture: false,
    // Disable session recording for now
    disable_session_recording: true,
    // Use local storage only (more reliable)
    persistence: 'localStorage',
    loaded: (posthog) => {
      // Enable debug mode in development
      if (process.env.NODE_ENV === 'development') {
        posthog.debug(true)
      }
      // Store PostHog instance globally for debugging
      if (typeof window !== 'undefined') {
        (window as any).posthog = posthog
      }
    }
  })
}

// PostHog provider component
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PostHogIdentifyUser />
      {children}
    </>
  )
}

// Component to identify users with PostHog
function PostHogIdentifyUser() {
  const { user } = useAuth()

  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      posthog.identify(user.id, {
        email: user.email,
        created_at: user.created_at
      })
    } else if (!user && typeof window !== 'undefined') {
      posthog.reset()
    }
  }, [user])

  return null
}

export default posthog
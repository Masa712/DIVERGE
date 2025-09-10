'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from './client'

export function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== 'undefined' && posthog) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
      
      // Capture pageview with additional context
      posthog.capture('$pageview', {
        $current_url: url,
        pathname,
        search: searchParams?.toString() || '',
      })
    }
  }, [pathname, searchParams])

  return null
}
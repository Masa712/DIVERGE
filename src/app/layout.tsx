import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ErrorProvider } from '@/components/providers/error-provider'
import { GuestProvider } from '@/components/providers/guest-provider'
import { PostHogProvider } from '@/lib/posthog/client'
import { PageViewTracker } from '@/lib/posthog/pageview-tracker'
import { Suspense } from 'react'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Diverge - Multi-Model Branching Chat',
  description: 'Branch conversations with different AI models',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorProvider>
          <AuthProvider>
            <GuestProvider>
              <PostHogProvider>
                <Suspense fallback={null}>
                  <PageViewTracker />
                </Suspense>
                {children}
              </PostHogProvider>
            </GuestProvider>
          </AuthProvider>
        </ErrorProvider>
      </body>
    </html>
  )
}
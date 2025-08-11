'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">Diverge Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <button
              onClick={async () => {
                await signOut()
                router.push('/auth')
              }}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Recent Sessions</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No sessions yet. Start a new chat to begin.
            </p>
            <button
              onClick={() => router.push('/chat')}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Chats
            </button>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Usage Statistics</h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Sessions</span>
                <span className="font-medium">0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Tokens</span>
                <span className="font-medium">0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-medium">$0.00</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Available Models</h2>
            <div className="mt-4 space-y-2">
              <div className="text-sm">
                <div className="font-medium">GPT-4o</div>
                <div className="text-xs text-muted-foreground">OpenAI</div>
              </div>
              <div className="text-sm">
                <div className="font-medium">Claude 3.5 Sonnet</div>
                <div className="text-xs text-muted-foreground">Anthropic</div>
              </div>
              <div className="text-sm">
                <div className="font-medium">Gemini Pro</div>
                <div className="text-xs text-muted-foreground">Google</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
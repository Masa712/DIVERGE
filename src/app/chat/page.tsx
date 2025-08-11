'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session } from '@/types'

export default function ChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useError()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchSessions()
    }
  }, [user])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const { sessions } = await response.json()
        setSessions(sessions)
      } else {
        const errorData = await response.json().catch(() => ({}))
        showError(errorData.error || 'Failed to fetch sessions')
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
      showError('Network error. Please check your connection.')
    } finally {
      setLoadingSessions(false)
    }
  }

  const createNewSession = async () => {
    setCreatingSession(true)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Chat ${new Date().toLocaleString()}`,
          description: 'New conversation'
        }),
      })

      if (response.ok) {
        const { session } = await response.json()
        router.push(`/chat/${session.id}`)
      } else {
        const errorData = await response.json().catch(() => ({}))
        showError(errorData.error || 'Failed to create new chat session')
      }
    } catch (error) {
      console.error('Error creating session:', error)
      showError('Network error. Please try again.')
    } finally {
      setCreatingSession(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">Chat Sessions</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80"
            >
              Dashboard
            </button>
            <button
              onClick={createNewSession}
              disabled={creatingSession}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingSession ? 'Creating...' : 'New Chat'}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loadingSessions ? (
          <div className="text-center">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">No chat sessions yet</h2>
            <p className="text-muted-foreground mb-6">
              Start your first conversation with AI models
            </p>
            <button
              onClick={createNewSession}
              disabled={creatingSession}
              className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingSession ? 'Creating...' : 'Start New Chat'}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => router.push(`/chat/${session.id}`)}
                className="cursor-pointer rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
              >
                <h3 className="font-semibold mb-2">{session.name}</h3>
                {session.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {session.description}
                  </p>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{session.nodeCount || 0} messages</span>
                  <span>${(session.totalCostUsd || 0).toFixed(4)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(session.lastAccessedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LeftSidebar } from '@/components/layout/left-sidebar'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'
import { Session } from '@/types'
import { ChatLayoutProvider, useChatLayout } from '@/contexts/ChatLayoutContext'

interface ChatLayoutProps {
  children: React.ReactNode
}

function ChatLayoutContent({ children }: ChatLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isLeftSidebarCollapsed, setIsLeftSidebarCollapsed, setIsLeftSidebarMobileOpen } = useChatLayout()
  const [currentSession, setCurrentSession] = useState<Session | null>(null)

  // Extract session ID from pathname
  const currentSessionId = pathname.startsWith('/chat/') && pathname !== '/chat'
    ? pathname.split('/')[2]
    : undefined

  // Fetch current session when session ID changes
  useEffect(() => {
    if (!currentSessionId) {
      setCurrentSession(null)
      return
    }

    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${currentSessionId}`)
        if (response.ok) {
          const { data } = await response.json()
          setCurrentSession(data)
        } else {
          setCurrentSession(null)
        }
      } catch (error) {
        console.error('Failed to fetch session:', error)
        setCurrentSession(null)
      }
    }

    fetchSession()
  }, [currentSessionId])

  const handleSessionSelect = (sessionId: string) => {
    // Navigate to the specific session page without full page reload
    router.push(`/chat/${sessionId}`)
  }

  const handleNewSession = () => {
    // Navigate back to the main chat page (no session selected)
    router.push('/chat')
  }

  return (
    <div className="relative flex h-screen">
      <AnimatedBackground opacity={0.4} />

      {/* Left Sidebar - persists across route changes */}
      <LeftSidebar
        currentSessionId={currentSessionId}
        currentSession={currentSession}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        isCollapsed={isLeftSidebarCollapsed}
        onToggleCollapse={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
        onMobileOpenChange={setIsLeftSidebarMobileOpen}
      />

      {/* Main Content - changes based on route */}
      {children}
    </div>
  )
}

export default function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <ChatLayoutProvider>
      <ChatLayoutContent>{children}</ChatLayoutContent>
    </ChatLayoutProvider>
  )
}

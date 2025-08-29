'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  PlusIcon,
  ChatBubbleLeftRightIcon as MessageSquare,
  ArrowRightOnRectangleIcon as LogOut,
  ChartBarIcon as Activity,
  Bars3Icon as Menu,
  TrashIcon as Trash2
} from '@heroicons/react/24/outline'
import { useAuth } from '@/components/providers/auth-provider'
import { useSessionManagement } from '@/hooks/useSessionManagement'
import { SessionList } from './SessionList'
import { DashboardStats } from './DashboardStats'
import { DeleteConfirmationModal } from './DeleteConfirmationModal'
import { Session } from '@/types'

interface Props {
  currentSessionId?: string
  currentSession?: Session | null
  onSessionSelect: (sessionId: string) => void
  onNewSession: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onMobileOpenChange?: (isOpen: boolean) => void
}

export function LeftSidebar({ currentSessionId, currentSession, onSessionSelect, onNewSession, isCollapsed, onToggleCollapse, onMobileOpenChange }: Props) {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [showDashboard, setShowDashboard] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Use session management hook
  const {
    sessions,
    loading,
    sessionToDelete,
    setSessionToDelete,
    dashboardData,
    handleCreateSession,
    handleDeleteSession
  } = useSessionManagement(currentSessionId, currentSession)

  // Notify parent of mobile open state changes
  useEffect(() => {
    onMobileOpenChange?.(isMobileOpen)
  }, [isMobileOpen, onMobileOpenChange])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/auth')
    } catch (error) {
      console.error('Failed to sign out')
    }
  }

  const handleNewSession = () => {
    handleCreateSession(onNewSession, onSessionSelect)
  }

  const handleSessionDelete = (sessionId: string) => {
    handleDeleteSession(sessionId, onNewSession)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // If collapsed, show minimal icon-only version
  if (isCollapsed) {
    return (
      <div>
        {/* Mobile Toggle Button - Show when collapsed */}
        {!isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(true)}
            className="fixed left-[30px] top-[25px] z-40 p-3 lg:hidden hover:bg-black/10 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* Mobile Overlay */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-transparent z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Mobile/Tablet - Use Original PC Design */}
        <aside className={`
          fixed z-50 flex flex-col
          glass-test glass-blur
          border border-white/20
          shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem]
          transform transition-all duration-300 ease-in-out
          lg:hidden
          
          /* Mobile/Tablet centered positioning */
          left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[90vw] max-w-[400px] h-[85vh] max-h-[700px]
          md:w-[80vw] md:max-w-[400px] md:h-[80vh]
          
          /* Show/hide animation */
          ${isMobileOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}
        `}>
          {/* Header - Logo */}
          <div className="px-6 pt-9 pb-6 border-b border-white/10 relative">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900">
                Diverge
              </h1>
            </div>
            
            <div className="absolute top-4 right-4">
              <button
                onClick={onToggleCollapse}
                className="p-2 rounded-lg text-gray-700 hover:bg-white/10 transition-all duration-200"
                title="Expand sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User Info Section */}
          <div className="px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                <span className="text-gray-900 text-sm font-medium">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">
                  {user?.email || 'User'}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-gray-600">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Sessions List */}
          <div className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
            <div className="mb-4 px-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Recent Chats
                </h2>
                <span className="text-xs text-gray-400">{sessions.length}</span>
              </div>
            </div>
            
            <SessionList
              sessions={sessions}
              loading={loading}
              currentSessionId={currentSessionId}
              onSessionSelect={onSessionSelect}
              onDeleteSession={setSessionToDelete}
              onCreateSession={handleNewSession}
              onMobileClose={() => setIsMobileOpen(false)}
              formatDate={formatDate}
            />
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-4">
            {/* New Chat Button */}
            <button 
              onClick={handleNewSession}
              className="
                w-full mb-3 px-4 py-2.5 rounded-lg
                bg-gradient-to-r from-blue-500/20 to-purple-500/20
                border border-white/20
                text-gray-800 text-sm font-medium
                hover:from-blue-500/30 hover:to-purple-500/30
                transition-all duration-200
                flex items-center justify-center gap-2
              "
            >
              <PlusIcon className="w-4 h-4" />
              New Chat
            </button>
            
            {/* Dashboard Button */}
            <button 
              onClick={() => {
                setShowDashboard(!showDashboard)
                setIsMobileOpen(false)
              }}
              className="
                w-full mb-2 px-4 py-2 rounded-lg
                text-gray-700 text-sm
                hover:text-blue-600
                transition-all duration-200
                flex items-center gap-2 group
              "
            >
              <Activity className="w-4 h-4 group-hover:text-blue-600 transition-colors duration-200" />
              <span className="group-hover:text-blue-600 transition-colors duration-200">Dashboard</span>
            </button>
            
            {/* Sign Out Button */}
            <button 
              onClick={handleSignOut}
              className="
                w-full px-4 py-2 rounded-lg
                text-gray-600 text-sm
                hover:text-red-600
                transition-all duration-200
                flex items-center gap-2 group
              "
            >
              <LogOut className="w-4 h-4 group-hover:text-red-600 transition-colors duration-200" />
              <span className="group-hover:text-red-600 transition-colors duration-200">Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Desktop Collapsed Sidebar */}
        <aside className="fixed left-[30px] top-[25px] bottom-[25px] w-16 z-50 flex flex-col glass-test glass-blur border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem] hidden lg:flex">
        {/* Toggle Button */}
        <div className="p-3 border-b border-white/10">
          <button
            onClick={onToggleCollapse}
            className="w-full p-2 rounded-lg text-gray-700 hover:bg-white/10 transition-all duration-200"
            title="Expand sidebar"
          >
            <Menu className="w-5 h-5 mx-auto" />
          </button>
        </div>

        {/* Quick Sessions */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.slice(0, 5).map((session) => (
            <button
              key={session.id}
              onClick={() => onSessionSelect(session.id)}
              className={`w-full p-3 mb-2 rounded-lg transition-all duration-200 ${
                currentSessionId === session.id
                  ? 'bg-white/20 shadow-lg'
                  : 'hover:bg-white/10'
              }`}
              title={session.name}
            >
              <MessageSquare className={`w-4 h-4 mx-auto ${
                currentSessionId === session.id ? 'text-gray-900' : 'text-gray-600'
              }`} />
            </button>
          ))}
        </div>

        {/* Dashboard */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setShowDashboard(true)}
            className="w-full p-2 rounded-lg text-gray-600 hover:text-blue-600 transition-all duration-200 group"
            title="Dashboard"
          >
            <Activity className="w-4 h-4 mx-auto group-hover:text-blue-600 transition-colors duration-200" />
          </button>
        </div>

        {/* Sign Out */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full p-2 rounded-lg text-gray-600 hover:text-red-600 transition-all duration-200 group"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 mx-auto group-hover:text-red-600 transition-colors duration-200" />
          </button>
        </div>
      </aside>
      
      {/* Dashboard Overlay - Available in collapsed state */}
      {showDashboard && (
        <DashboardStats
          dashboardData={dashboardData}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {/* Delete Confirmation Modal - Available in collapsed state */}
      <DeleteConfirmationModal
        sessionId={sessionToDelete}
        onConfirm={handleSessionDelete}
        onCancel={() => setSessionToDelete(null)}
      />
      </div>
    )
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed left-[30px] top-[25px] z-40 p-3 lg:hidden hover:bg-black/10 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-transparent z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Glass Morphism Floating Sidebar */}
      <aside className={`
        fixed z-50 flex flex-col
        glass-test glass-blur
        border border-white/20
        shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem]
        transform transition-transform duration-300 ease-in-out
        
        /* Desktop positioning - Override mobile styles */
        lg:left-[30px] lg:top-[25px] lg:bottom-[25px] lg:w-[350px] lg:h-auto lg:max-h-none lg:max-w-none lg:translate-x-0 lg:translate-y-0
        
        /* Tablet/Mobile centered positioning */
        left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
        w-[90vw] max-w-[400px] h-[85vh] max-h-[700px]
        md:w-[80vw] md:max-w-[400px] md:h-[80vh]
        
        /* Show/hide on mobile */
        ${isMobileOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none lg:scale-100 lg:opacity-100 lg:pointer-events-auto'}
      `}>
        {/* Header - Logo */}
        <div className="px-6 pt-9 pb-6 border-b border-white/10 relative">
          {/* Logo - Centered */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">
              Diverge
            </h1>
          </div>
          
          {/* Controls - Positioned absolutely */}
          <div className="absolute top-4 right-4">
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-lg text-gray-700 hover:bg-white/10 transition-all duration-200 lg:block hidden"
              title="Collapse sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Info Section */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
              <span className="text-gray-900 text-sm font-medium">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">
                {user?.email || 'User'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-gray-600">Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
          <div className="mb-4 px-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Recent Chats
              </h2>
              <span className="text-xs text-gray-400">{sessions.length}</span>
            </div>
          </div>
          
          {loading ? (
            <div className="space-y-2 px-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 px-3">
              <MessageSquare className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">No chats yet</p>
              <button
                onClick={() => handleCreateSession(onNewSession, onSessionSelect)}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                Start your first chat
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div key={session.id} className="relative group">
                  <button
                    onClick={() => onSessionSelect(session.id)}
                    className={`
                      w-full text-left px-3 py-2.5 rounded-lg mb-1
                      transition-all duration-200
                      transform hover:translate-x-1
                      ${currentSessionId === session.id 
                        ? 'bg-white/20 shadow-lg' 
                        : 'hover:bg-white/10'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          {session.name || `Chat ${formatDate(session.createdAt)}`}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {session.nodeCount} messages • ${(session.totalCostUsd || 0).toFixed(4)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(session.lastAccessedAt)}
                        </div>
                      </div>
                      {currentSessionId === session.id && (
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </div>
                  </button>
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSessionToDelete(session.id)
                    }}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          {/* New Chat Button */}
          <button 
            onClick={() => handleCreateSession(onNewSession, onSessionSelect)}
            className="
              w-full mb-3 px-4 py-2.5 rounded-lg
              bg-gradient-to-r from-blue-500/20 to-purple-500/20
              border border-white/20
              text-gray-800 text-sm font-medium
              hover:from-blue-500/30 hover:to-purple-500/30
              transition-all duration-200
              flex items-center justify-center gap-2
            "
          >
            <PlusIcon className="w-4 h-4" />
            New Chat
          </button>
          
          {/* Dashboard Button */}
          <button 
            onClick={() => setShowDashboard(!showDashboard)}
            className="
              w-full mb-2 px-4 py-2 rounded-lg
              text-gray-700 text-sm
              hover:text-blue-600
              transition-all duration-200
              flex items-center gap-2 group
            "
          >
            <Activity className="w-4 h-4 group-hover:text-blue-600 transition-colors duration-200" />
            <span className="group-hover:text-blue-600 transition-colors duration-200">Dashboard</span>
          </button>
          
          {/* Sign Out Button */}
          <button 
            onClick={handleSignOut}
            className="
              w-full px-4 py-2 rounded-lg
              text-gray-600 text-sm
              hover:text-red-600
              transition-all duration-200
              flex items-center gap-2 group
            "
          >
            <LogOut className="w-4 h-4 group-hover:text-red-600 transition-colors duration-200" />
            <span className="group-hover:text-red-600 transition-colors duration-200">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Dashboard Overlay */}
      {showDashboard && (
        <DashboardStats
          dashboardData={dashboardData}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        sessionId={sessionToDelete}
        onConfirm={handleSessionDelete}
        onCancel={() => setSessionToDelete(null)}
      />
    </>
  )
}
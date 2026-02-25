'use client'

import { useState, useEffect } from 'react'
import {
  UserPlusIcon,
  InformationCircleIcon,
  Bars3Icon as Menu
} from '@heroicons/react/24/outline'
import Link from 'next/link'

interface Props {
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSignUpClick: () => void
  onMobileOpenChange?: (isOpen: boolean) => void
}

export function GuestLeftSidebar({ isCollapsed, onToggleCollapse, onSignUpClick, onMobileOpenChange }: Props) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Notify parent of mobile open state changes
  useEffect(() => {
    onMobileOpenChange?.(isMobileOpen)
  }, [isMobileOpen, onMobileOpenChange])

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen)
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      {!isMobileOpen && (
        <button
          onClick={toggleMobileSidebar}
          className="fixed left-[30px] top-[25px] z-40 p-3 lg:hidden hover:bg-black/10 rounded-lg transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-transparent z-40 lg:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed z-50 flex flex-col
          glass-test glass-blur
          border border-white/20
          shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem]
          transform transition-all duration-300 ease-in-out

          /* Desktop positioning - Override mobile styles */
          lg:left-[30px] lg:top-[90px] lg:bottom-6 lg:h-auto lg:max-h-none lg:max-w-none lg:translate-x-0 lg:translate-y-0
          ${isCollapsed ? 'lg:w-16' : 'lg:w-[350px]'}

          /* Mobile/Tablet centered positioning */
          left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[90vw] max-w-[400px] h-[85vh] max-h-[700px]
          md:w-[80vw] md:max-w-[400px] md:h-[80vh]

          /* Show/hide animation */
          ${isMobileOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none lg:scale-100 lg:opacity-100 lg:pointer-events-auto'}
        `}
      >
          {/* Header */}
          <div className="px-6 pt-9 pb-6 border-b border-white/10">
            {/* Logo/Title - Centered, clickable to expand when collapsed */}
            <div className="text-center">
              {isCollapsed ? (
                <button
                  onClick={onToggleCollapse}
                  className="text-2xl font-bold text-gray-900 hover:text-gray-600 transition-colors cursor-pointer"
                  title="Expand sidebar"
                >
                  D
                </button>
              ) : (
                <h1 className="text-4xl font-bold text-gray-900">
                  Diverge
                </h1>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Guest Info */}
            {!isCollapsed && (
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 border border-blue-200/30">
                <div className="flex items-start gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-1">
                      Welcome, Guest!
                    </p>
                    <p className="text-xs text-gray-600">
                      You're using a limited demo version. Sign up to unlock all features!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sign Up CTA */}
            <button
              onClick={onSignUpClick}
              className={`
                w-full bg-gradient-to-r from-blue-500 to-blue-600
                hover:from-blue-600 hover:to-blue-700
                text-white font-medium rounded-lg
                transition-all duration-200 shadow-lg hover:shadow-xl
                ${isCollapsed ? 'p-3' : 'py-3 px-4'}
              `}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
                <UserPlusIcon className={isCollapsed ? 'w-7 h-7' : 'w-5 h-5'} />
                {!isCollapsed && <span>Sign Up Free</span>}
              </div>
            </button>

            {/* Features List */}
            {!isCollapsed && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Current Limits
                </h3>
                <ul className="text-xs text-gray-600 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>5 messages per session</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>Basic models only</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>No conversation history</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>No web search</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Unlock Features */}
            {!isCollapsed && (
              <div className="space-y-2 pt-4 border-t border-white/20">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sign Up to Unlock
                </h3>
                <ul className="text-xs text-gray-600 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Unlimited messages</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>All AI models</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Save conversations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Web search integration</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Footer Links */}
          {!isCollapsed && (
            <div className="p-4 border-t border-white/20">
              <div className="space-y-2">
                <Link
                  href="/terms"
                  className="block text-xs text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Terms of Service
                </Link>
                <Link
                  href="/privacy"
                  className="block text-xs text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Privacy Policy
                </Link>
                <p className="text-xs text-gray-400 pt-2">
                  © 2026 Diverge
                </p>
              </div>
            </div>
          )}
      </aside>
    </>
  )
}

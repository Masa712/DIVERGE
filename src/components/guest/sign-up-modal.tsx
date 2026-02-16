'use client'

import { useEffect } from 'react'
import { XMarkIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function SignUpModal({ isOpen, onClose }: Props) {
  const benefits = [
    'Unlimited messages per session',
    'Web search with AI responses',
    'Save your conversations',
    'Access to more AI models',
    'Branch conversations',
  ]

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left shadow-xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="absolute right-4 top-4">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mx-auto mb-4 flex items-center justify-center">
                <SparklesIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Unlock Full Access
              </h3>
              <p className="text-gray-600">
                Create a free account to continue your AI conversations.
              </p>
            </div>

            {/* Benefits */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-3">
                With a free account, you get:
              </h4>
              <ul className="space-y-2">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Link
                href="/auth?tab=signup"
                className="block w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 rounded-xl font-semibold text-center shadow-lg transition-all transform hover:scale-[1.02]"
              >
                Create Free Account
              </Link>
              <Link
                href="/auth"
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium text-center transition-colors"
              >
                Already have an account? Sign In
              </Link>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              By signing up, you agree to our{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-800 underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-800 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

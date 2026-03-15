'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface Props {
  onSignUp: () => void
}

export function GuestLimitBanner({ onSignUp }: Props) {
  return (
    <div className="mx-4 mb-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-sm sm:text-base text-gray-900">
                You've reached the guest message limit
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                Sign up for free to continue chatting with unlimited messages.
              </p>
            </div>
          </div>
          <button
            onClick={onSignUp}
            className="flex-shrink-0 w-full sm:w-auto text-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-2 rounded-full font-semibold shadow-lg transition-all transform hover:scale-105 text-sm sm:text-base"
          >
            Sign Up Free
          </button>
        </div>
      </div>
    </div>
  )
}

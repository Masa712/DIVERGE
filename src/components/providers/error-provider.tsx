'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ErrorContextType {
  error: string | null
  showError: (message: string) => void
  clearError: () => void
}

const ErrorContext = createContext<ErrorContextType>({
  error: null,
  showError: () => {},
  clearError: () => {},
})

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null)

  const showError = (message: string) => {
    setError(message)
    // Auto-clear error after 5 seconds
    setTimeout(() => setError(null), 5000)
  }

  const clearError = () => {
    setError(null)
  }

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div className="rounded-lg bg-destructive px-4 py-3 text-destructive-foreground shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm">{error}</p>
              <button
                onClick={clearError}
                className="ml-4 rounded-md p-1 hover:bg-destructive/80"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorContext.Provider>
  )
}

export const useError = () => {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}
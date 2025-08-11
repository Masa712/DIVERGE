import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ErrorProvider } from '@/components/providers/error-provider'
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
            {children}
          </AuthProvider>
        </ErrorProvider>
      </body>
    </html>
  )
}
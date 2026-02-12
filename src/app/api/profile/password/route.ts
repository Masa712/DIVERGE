import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, createAppError, ErrorCategory } from '@/lib/errors/error-handler'
import { log } from '@/lib/utils/logger'

// POST - Change password
export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  const body = await request.json()
  const { currentPassword, newPassword } = body

  // Validate input
  if (!currentPassword || typeof currentPassword !== 'string') {
    throw createAppError(
      'Current password is required',
      ErrorCategory.VALIDATION,
      { userMessage: 'Please provide your current password' }
    )
  }

  if (!newPassword || typeof newPassword !== 'string') {
    throw createAppError(
      'New password is required',
      ErrorCategory.VALIDATION,
      { userMessage: 'Please provide a new password' }
    )
  }

  if (newPassword.length < 6) {
    throw createAppError(
      'Password too short',
      ErrorCategory.VALIDATION,
      { userMessage: 'Password must be at least 6 characters long' }
    )
  }

  if (currentPassword === newPassword) {
    throw createAppError(
      'New password must be different',
      ErrorCategory.VALIDATION,
      { userMessage: 'New password must be different from current password' }
    )
  }

  // Verify current password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword
  })

  if (signInError) {
    throw createAppError(
      'Current password is incorrect',
      ErrorCategory.AUTHENTICATION,
      { userMessage: 'Current password is incorrect' }
    )
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (updateError) {
    throw createAppError(
      'Failed to update password',
      ErrorCategory.AUTHENTICATION,
      { cause: updateError, userMessage: 'Failed to update password. Please try again.' }
    )
  }

  log.info('Password updated successfully', { userId: user.id })

  return NextResponse.json({
    success: true,
    message: 'Password updated successfully'
  })
})
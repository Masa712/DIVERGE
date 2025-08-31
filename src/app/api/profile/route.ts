import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, createAppError, ErrorCategory } from '@/lib/errors/error-handler'
import { log } from '@/lib/utils/logger'

// GET - Fetch user profile
export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  // Get user profile
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // If profile doesn't exist, create one
  if (error && error.code === 'PGRST116') {
    log.info('Creating new user profile', { userId: user.id })
    
    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        display_name: user.email?.split('@')[0] || 'User'
      })
      .select()
      .single()
    
    if (createError) {
      throw createAppError(
        'Failed to create user profile',
        ErrorCategory.DATABASE,
        { context: { userId: user.id }, cause: createError }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...newProfile,
        email: user.email // Include email from auth
      }
    })
  }
  
  if (error) {
    throw createAppError(
      'Failed to fetch user profile',
      ErrorCategory.DATABASE,
      { context: { userId: user.id }, cause: error }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      ...profile,
      email: user.email // Include email from auth
    }
  })
})

// PATCH - Update user profile
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  const body = await request.json()
  const { display_name, default_model, default_temperature, default_max_tokens, preferences } = body

  // Validate input
  if (display_name !== undefined && (typeof display_name !== 'string' || display_name.trim().length === 0)) {
    throw createAppError(
      'Display name must be a non-empty string',
      ErrorCategory.VALIDATION,
      { userMessage: 'Please provide a valid display name' }
    )
  }

  if (default_temperature !== undefined && (typeof default_temperature !== 'number' || default_temperature < 0 || default_temperature > 2)) {
    throw createAppError(
      'Temperature must be between 0 and 2',
      ErrorCategory.VALIDATION,
      { userMessage: 'Temperature must be between 0 and 2' }
    )
  }

  if (default_max_tokens !== undefined && (typeof default_max_tokens !== 'number' || default_max_tokens < 1 || default_max_tokens > 100000)) {
    throw createAppError(
      'Max tokens must be between 1 and 100000',
      ErrorCategory.VALIDATION,
      { userMessage: 'Max tokens must be between 1 and 100000' }
    )
  }

  // Build update object
  const updateData: any = {}
  if (display_name !== undefined) updateData.display_name = display_name.trim()
  if (default_model !== undefined) updateData.default_model = default_model
  if (default_temperature !== undefined) updateData.default_temperature = default_temperature
  if (default_max_tokens !== undefined) updateData.default_max_tokens = default_max_tokens
  if (preferences !== undefined) updateData.preferences = preferences

  // Update profile
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update(updateData)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    // If profile doesn't exist, create it
    if (error.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          ...updateData
        })
        .select()
        .single()
      
      if (createError) {
        throw createAppError(
          'Failed to create user profile',
          ErrorCategory.DATABASE,
          { context: { userId: user.id }, cause: createError }
        )
      }
      
      log.info('User profile created', { userId: user.id })
      return NextResponse.json({
        success: true,
        data: {
          ...newProfile,
          email: user.email
        }
      })
    }
    
    throw createAppError(
      'Failed to update user profile',
      ErrorCategory.DATABASE,
      { context: { userId: user.id }, cause: error }
    )
  }

  log.info('User profile updated', { userId: user.id, changes: Object.keys(updateData) })

  return NextResponse.json({
    success: true,
    data: {
      ...profile,
      email: user.email
    }
  })
})
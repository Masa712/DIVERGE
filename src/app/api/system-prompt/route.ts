import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  getUserSystemPromptPreferences,
  updateUserSystemPromptPreferences,
  UserSystemPromptPreferences
} from '@/lib/db/system-prompt-preferences'
import { SystemPromptPresets } from '@/lib/system-prompts'
import { 
  withErrorHandler, 
  createAppError, 
  ErrorCategory 
} from '@/lib/errors/error-handler'

// GET: Get current system prompt preferences
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

  const preferences = await getUserSystemPromptPreferences(user.id)
  
  // Return default if no preferences set
  const defaultPreferences = {
    system_prompt_preset: 'default' as const,
    system_prompt_style: 'friendly' as const,
    system_prompt_language: 'auto' as const,
    system_prompt_format: 'markdown' as const,
    system_prompt_specializations: [],
    custom_instructions: null,
    system_prompt_enabled: true
  }

  return NextResponse.json({
    success: true,
    data: preferences || defaultPreferences
  })
})

// PUT: Update system prompt preferences
export const PUT = withErrorHandler(async (request: NextRequest) => {
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
  const {
    system_prompt_preset,
    system_prompt_style,
    system_prompt_language,
    system_prompt_format,
    system_prompt_specializations,
    custom_instructions,
    system_prompt_enabled
  } = body

  // Validate preset if provided
  if (system_prompt_preset && !SystemPromptPresets[system_prompt_preset]) {
    throw createAppError(
      'Invalid system prompt preset',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Please select a valid preset option.',
        context: { preset: system_prompt_preset }
      }
    )
  }

  // Validate style if provided
  const validStyles = ['professional', 'friendly', 'concise', 'detailed']
  if (system_prompt_style && !validStyles.includes(system_prompt_style)) {
    throw createAppError(
      'Invalid response style',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Please select a valid response style.',
        context: { style: system_prompt_style }
      }
    )
  }

  // Validate language if provided
  const validLanguages = ['auto', 'en', 'ja', 'multilingual']
  if (system_prompt_language && !validLanguages.includes(system_prompt_language)) {
    throw createAppError(
      'Invalid language preference',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Please select a valid language preference.',
        context: { language: system_prompt_language }
      }
    )
  }

  // Validate format if provided
  const validFormats = ['markdown', 'plain', 'structured']
  if (system_prompt_format && !validFormats.includes(system_prompt_format)) {
    throw createAppError(
      'Invalid output format',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Please select a valid output format.',
        context: { format: system_prompt_format }
      }
    )
  }

  // Update preferences
  const updateData: Partial<Omit<UserSystemPromptPreferences, 'user_id'>> = {}
  
  if (system_prompt_preset !== undefined) updateData.system_prompt_preset = system_prompt_preset
  if (system_prompt_style !== undefined) updateData.system_prompt_style = system_prompt_style
  if (system_prompt_language !== undefined) updateData.system_prompt_language = system_prompt_language
  if (system_prompt_format !== undefined) updateData.system_prompt_format = system_prompt_format
  if (system_prompt_specializations !== undefined) updateData.system_prompt_specializations = system_prompt_specializations
  if (custom_instructions !== undefined) updateData.custom_instructions = custom_instructions
  if (system_prompt_enabled !== undefined) updateData.system_prompt_enabled = system_prompt_enabled

  const success = await updateUserSystemPromptPreferences(user.id, updateData)
  
  console.log('Update result:', { success, updateData })

  if (!success) {
    throw createAppError(
      'Failed to update system prompt preferences',
      ErrorCategory.DATABASE,
      {
        userMessage: 'Unable to save your preferences. Please try again.'
      }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'System prompt preferences updated successfully'
  })
})

// GET: Get available options for system prompt configuration
export const OPTIONS = withErrorHandler(async () => {
  return NextResponse.json({
    success: true,
    data: {
      presets: Object.keys(SystemPromptPresets),
      styles: ['professional', 'friendly', 'concise', 'detailed'],
      languages: ['auto', 'en', 'ja', 'multilingual'],
      formats: ['markdown', 'plain', 'structured'],
      commonSpecializations: [
        'software development',
        'web development',
        'data science',
        'machine learning',
        'cybersecurity',
        'project management',
        'business analysis',
        'design',
        'writing',
        'research'
      ]
    }
  })
})
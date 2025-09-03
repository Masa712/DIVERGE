import { createClient } from '@/lib/supabase/server'
import { SystemPromptConfig, SystemPromptPresets, generateSystemPrompt } from '@/lib/system-prompts'

export interface UserSystemPromptPreferences {
  user_id: string
  system_prompt_preset: keyof typeof SystemPromptPresets
  system_prompt_style: 'professional' | 'friendly' | 'concise' | 'detailed'
  system_prompt_language: 'auto' | 'en' | 'ja' | 'multilingual'
  system_prompt_format: 'markdown' | 'plain' | 'structured'
  system_prompt_specializations: string[]
  custom_instructions: string | null
  system_prompt_enabled: boolean
}

/**
 * Get system prompt preferences for a user
 */
export async function getUserSystemPromptPreferences(
  userId: string
): Promise<UserSystemPromptPreferences | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      user_id,
      system_prompt_preset,
      system_prompt_style,
      system_prompt_language,
      system_prompt_format,
      system_prompt_specializations,
      custom_instructions,
      system_prompt_enabled
    `)
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Failed to fetch system prompt preferences:', error)
    return null
  }

  return data
}

/**
 * Update system prompt preferences for a user
 */
export async function updateUserSystemPromptPreferences(
  userId: string,
  preferences: Partial<Omit<UserSystemPromptPreferences, 'user_id'>>
): Promise<boolean> {
  const supabase = createClient()
  
  console.log('Updating system prompt preferences:', { userId, preferences })
  
  const { data, error } = await supabase
    .from('user_profiles')
    .update(preferences)
    .eq('user_id', userId)
    .select()

  if (error) {
    console.error('Failed to update system prompt preferences:', error)
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    })
    return false
  }

  console.log('Update successful:', data)
  return true
}

/**
 * Generate system prompt for a specific user based on their preferences
 */
export async function generateUserSystemPrompt(
  userId: string
): Promise<string> {
  const preferences = await getUserSystemPromptPreferences(userId)
  
  // Use default if no preferences or disabled
  if (!preferences || !preferences.system_prompt_enabled) {
    return generateSystemPrompt(SystemPromptPresets.default)
  }
  
  // Build config from user preferences
  const config: SystemPromptConfig = {
    includeDate: true, // Always include current date
    responseStyle: preferences.system_prompt_style,
    language: preferences.system_prompt_language,
    outputFormat: preferences.system_prompt_format,
    specialization: preferences.system_prompt_specializations || [],
    customInstructions: preferences.custom_instructions || undefined
  }
  
  // Use preset as base and override with custom config
  if (preferences.system_prompt_preset && SystemPromptPresets[preferences.system_prompt_preset]) {
    const presetConfig = SystemPromptPresets[preferences.system_prompt_preset]
    const mergedConfig = {
      ...presetConfig,
      ...config
    }
    return generateSystemPrompt(mergedConfig)
  }
  
  return generateSystemPrompt(config)
}

/**
 * Initialize default preferences for a new user
 */
export async function initializeDefaultSystemPromptPreferences(
  userId: string
): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('user_profiles')
    .update({
      system_prompt_preset: 'default',
      system_prompt_style: 'friendly',
      system_prompt_language: 'auto',
      system_prompt_format: 'markdown',
      system_prompt_specializations: [],
      custom_instructions: null,
      system_prompt_enabled: true
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to initialize system prompt preferences:', error)
    return false
  }

  return true
}
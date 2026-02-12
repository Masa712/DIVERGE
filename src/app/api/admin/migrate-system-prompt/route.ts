import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  withErrorHandler, 
  createAppError, 
  ErrorCategory 
} from '@/lib/errors/error-handler'

// POST: Apply system prompt preferences migration
export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()
  
  // Check authentication (admin only)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  try {
    // Add columns if they don't exist
    const alterQuery = `
      ALTER TABLE user_profiles 
      ADD COLUMN IF NOT EXISTS system_prompt_preset VARCHAR(50) DEFAULT 'default',
      ADD COLUMN IF NOT EXISTS system_prompt_style VARCHAR(20) DEFAULT 'friendly',
      ADD COLUMN IF NOT EXISTS system_prompt_language VARCHAR(20) DEFAULT 'auto',
      ADD COLUMN IF NOT EXISTS system_prompt_format VARCHAR(20) DEFAULT 'markdown',
      ADD COLUMN IF NOT EXISTS system_prompt_specializations TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS custom_instructions TEXT,
      ADD COLUMN IF NOT EXISTS system_prompt_enabled BOOLEAN DEFAULT true;
    `

    const { error } = await supabase.rpc('exec_sql', { sql: alterQuery })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'System prompt preferences migration applied successfully'
    })
  } catch (error) {
    console.error('Migration error:', error)
    throw createAppError(
      'Failed to apply migration',
      ErrorCategory.DATABASE,
      {
        userMessage: 'Database migration failed. Check server logs.',
        cause: error as Error
      }
    )
  }
})
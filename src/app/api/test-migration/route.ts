import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const POST = async (request: NextRequest) => {
  const supabase = createClient()
  
  try {
    // First, let's check if the columns exist
    const { data: existingData, error: selectError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1)

    console.log('Current user_profiles structure check:', existingData)

    if (selectError) {
      console.error('Error checking existing structure:', selectError)
      return NextResponse.json({ 
        error: 'Failed to check existing table structure',
        details: selectError.message
      }, { status: 500 })
    }

    // Try a test update to see what happens
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Try to update with new columns
    const { data: updateData, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        system_prompt_enabled: true,
        system_prompt_preset: 'default',
        system_prompt_style: 'friendly'
      })
      .eq('user_id', user.id)
      .select()

    if (updateError) {
      console.error('Update error details:', {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      })
      
      return NextResponse.json({ 
        error: 'Update failed - columns likely don\'t exist',
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Columns exist and update worked',
      data: updateData
    })

  } catch (error) {
    console.error('Test migration error:', error)
    return NextResponse.json({ 
      error: 'Test migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const GET = async (request: NextRequest) => {
  const supabase = await createClient()
  
  try {
    // Get table structure
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'user_profiles')
      .order('ordinal_position')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      columns: data,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch table structure',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
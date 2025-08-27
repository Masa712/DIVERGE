'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const nodeId = params.id

    // First, check if the node exists and belongs to the user
    const { data: nodeData, error: nodeError } = await supabase
      .from('chat_nodes')
      .select('id, session_id, sessions!inner(user_id)')
      .eq('id', nodeId)
      .single()

    if (nodeError || !nodeData) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    // Check if the user owns this node through the session
    if (nodeData.sessions.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete the node
    const { error: deleteError } = await supabase
      .from('chat_nodes')
      .delete()
      .eq('id', nodeId)

    if (deleteError) {
      console.error('Error deleting node:', deleteError)
      return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 })
    }

    console.log(`Successfully deleted node: ${nodeId}`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE /api/nodes/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
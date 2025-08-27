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
    console.log(`DELETE request for node: ${nodeId}`)

    // First, check if the node exists
    const { data: nodeData, error: nodeError } = await supabase
      .from('chat_nodes')
      .select('id, session_id')
      .eq('id', nodeId)
      .single()

    if (nodeError || !nodeData) {
      console.error('Node not found error:', nodeError)
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    // Check if the user owns this node through the session
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', nodeData.session_id)
      .single()

    if (sessionError || !sessionData) {
      console.error('Session not found error:', sessionError)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (sessionData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if node has children (prevent deletion of parent nodes)
    const { data: childNodes, error: childCheckError } = await supabase
      .from('chat_nodes')
      .select('id')
      .eq('parent_id', nodeId)
      .limit(1)

    if (childCheckError) {
      console.error('Error checking child nodes:', childCheckError)
      return NextResponse.json({ error: 'Failed to check node dependencies' }, { status: 500 })
    }

    if (childNodes && childNodes.length > 0) {
      return NextResponse.json({ error: 'Cannot delete node with child nodes' }, { status: 400 })
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
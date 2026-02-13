'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { clearQueryCache } from '@/lib/db/query-optimizer'
import { log } from '@/lib/utils/logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const nodeId = (await params).id
    log.info('DELETE request for node', { nodeId })

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

    // Verify node exists before deletion
    const { data: preDeleteCheck } = await supabase
      .from('chat_nodes')
      .select('id')
      .eq('id', nodeId)
      .single()
    
    log.debug('Pre-delete check', { nodeId, exists: !!preDeleteCheck })

    // Delete the node using service role client to bypass RLS
    const serviceSupabase = createServiceRoleClient()
    const { data: deleteData, error: deleteError, count } = await serviceSupabase
      .from('chat_nodes')
      .delete({ count: 'exact' })
      .eq('id', nodeId)

    log.debug('Delete operation result', {
      hasData: !!deleteData,
      hasError: !!deleteError,
      count,
      nodeId
    })

    if (deleteError) {
      log.error('Error deleting node', deleteError)
      return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 })
    }

    if (count === 0) {
      log.error('Delete operation succeeded but no rows were deleted', { nodeId })
      return NextResponse.json({ error: 'No rows were deleted - possible permission issue' }, { status: 500 })
    }
    
    // Verify deletion actually occurred using service role client
    const { data: verifyData, error: verifyError } = await serviceSupabase
      .from('chat_nodes')
      .select('id')
      .eq('id', nodeId)
      .single()
    
    log.debug('Post-delete verification', {
      nodeId,
      hasData: !!verifyData,
      errorCode: verifyError?.code,
      errorMessage: verifyError?.message
    })
    
    if (verifyData) {
      log.error('Node still exists after deletion attempt', { nodeId, nodeData: verifyData })
      return NextResponse.json({ error: 'Node deletion failed - node still exists' }, { status: 500 })
    }
    
    if (verifyError && verifyError.code !== 'PGRST116') {
      log.error('Unexpected error during verification', verifyError)
    } else if (verifyError && verifyError.code === 'PGRST116') {
      log.info('Node successfully deleted', { nodeId })
    }

    // Clear query cache to ensure deleted nodes don't appear in subsequent requests
    // This is necessary because the chatNodesLoader caches results
    clearQueryCache()
    log.info('Successfully deleted node and cleared cache', { nodeId, sessionId: nodeData.session_id })
    
    return NextResponse.json({ success: true })

  } catch (error) {
    log.error('Error in DELETE /api/nodes/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
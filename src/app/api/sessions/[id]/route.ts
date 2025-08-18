import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionChatNodes } from '@/lib/db/chat-nodes'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const sessionId = params.id

    // Get session information
    const { data: sessionRaw, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }
      throw sessionError
    }

    // Convert session to camelCase
    const session = {
      id: sessionRaw.id,
      name: sessionRaw.name,
      description: sessionRaw.description,
      userId: sessionRaw.user_id,
      rootNodeId: sessionRaw.root_node_id,
      totalCostUsd: sessionRaw.total_cost_usd || 0,
      totalTokens: sessionRaw.total_tokens || 0,
      nodeCount: sessionRaw.node_count || 0,
      maxDepth: sessionRaw.max_depth || 0,
      isArchived: sessionRaw.is_archived || false,
      createdAt: new Date(sessionRaw.created_at),
      updatedAt: new Date(sessionRaw.updated_at),
      lastAccessedAt: new Date(sessionRaw.last_accessed_at),
    }

    // Get chat nodes for this session
    const chatNodes = await getSessionChatNodes(sessionId)

    // Update last accessed time
    await supabase
      .from('sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', sessionId)

    return NextResponse.json({
      session,
      chatNodes,
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const sessionId = params.id

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }
      throw sessionError
    }

    // Delete all chat nodes associated with the session
    // (This will cascade due to foreign key constraints, but we'll be explicit)
    const { error: nodesError } = await supabase
      .from('chat_nodes')
      .delete()
      .eq('session_id', sessionId)

    if (nodesError) {
      console.error('Error deleting chat nodes:', nodesError)
      // Continue with session deletion even if node deletion fails
    }

    // Delete the session
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
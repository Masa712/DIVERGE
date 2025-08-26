import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionChatNodes } from '@/lib/db/chat-nodes'
import { 
  withErrorHandler, 
  createAppError, 
  ErrorCategory, 
  classifyDatabaseError 
} from '@/lib/errors/error-handler'
import { executeOptimizedQuery, chatNodesLoader } from '@/lib/db/query-optimizer'

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  const sessionId = params.id

  // Get session information with optimized query and selective fields
  const sessionRaw = await executeOptimizedQuery(
    `session_${sessionId}_${user.id}`,
    async (supabase) => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          name,
          description,
          user_id,
          root_node_id,
          total_cost_usd,
          total_tokens,
          node_count,
          max_depth,
          is_archived,
          created_at,
          updated_at,
          last_accessed_at
        `)
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw createAppError(
            'Session not found',
            ErrorCategory.NOT_FOUND,
            { context: { sessionId, userId: user.id } }
          )
        }
        throw createAppError(
          'Failed to fetch session',
          classifyDatabaseError(error),
          { context: { sessionId, userId: user.id }, cause: error }
        )
      }

      return data
    },
    { poolKey: `session_${sessionId}`, cacheTTL: 60000 } // 1 minute cache
  )

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

  // Get chat nodes using batch loader to prevent N+1 queries
  const chatNodesRaw = await chatNodesLoader.load(sessionId)

  // Convert chat nodes to camelCase
  const chatNodes = chatNodesRaw.map(node => ({
    id: node.id,
    sessionId: node.session_id,
    parentId: node.parent_id,
    model: node.model,
    prompt: node.prompt,
    response: node.response,
    status: node.status,
    depth: node.depth,
    promptTokens: node.prompt_tokens || 0,
    responseTokens: node.response_tokens || 0,
    costUsd: node.cost_usd || 0,
    temperature: node.temperature,
    maxTokens: node.max_tokens,
    createdAt: new Date(node.created_at),
    updatedAt: new Date(node.updated_at),
  }))

  // Update last accessed time asynchronously (don't wait)
  Promise.resolve(
    supabase
      .from('sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', sessionId)
  ).then(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📈 Updated last access time for session: ${sessionId}`)
    }
  }).catch(error => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Failed to update last access time:', error)
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      session,
      chatNodes,
    }
  })
})

export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  const sessionId = params.id

  // Verify session ownership with optimized query
  await executeOptimizedQuery(
    `session_ownership_${sessionId}_${user.id}`,
    async (supabase) => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, user_id')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw createAppError(
            'Session not found',
            ErrorCategory.NOT_FOUND,
            { context: { sessionId, userId: user.id } }
          )
        }
        throw createAppError(
          'Failed to verify session ownership',
          classifyDatabaseError(error),
          { context: { sessionId, userId: user.id }, cause: error }
        )
      }

      return data
    },
    { poolKey: `verify_${sessionId}`, cacheTTL: 10000 } // 10 second cache
  )

  // Execute optimized batch delete operation
  await executeOptimizedQuery(
    `delete_session_${sessionId}`,
    async (supabase) => {
      // Use a transaction-like approach: delete nodes first, then session
      const { error: nodesError } = await supabase
        .from('chat_nodes')
        .delete()
        .eq('session_id', sessionId)

      if (nodesError) {
        console.warn('Error deleting chat nodes (continuing):', nodesError)
        // Continue with session deletion even if node deletion fails
      }

      const { error: deleteError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id)

      if (deleteError) {
        throw createAppError(
          'Failed to delete session',
          classifyDatabaseError(deleteError),
          { context: { sessionId, userId: user.id }, cause: deleteError }
        )
      }

      return { deleted: true }
    },
    { poolKey: `delete_${sessionId}`, skipCache: true } // Don't cache delete operations
  )

  return NextResponse.json({
    success: true,
    data: {
      message: 'Session deleted successfully'
    }
  })
})
/**
 * Pooled database operations for high-frequency queries
 * Uses connection pooling to optimize database access performance
 */

import { withPooledConnection } from '@/lib/supabase/connection-pool'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModelId } from '@/types'
import { createAppError, classifyDatabaseError, ErrorCategory } from '@/lib/errors/error-handler'

/**
 * Get parent node depth using pooled connection
 */
export async function getParentNodeDepth(parentNodeId: string): Promise<number> {
  try {
    return await withPooledConnection(async (supabase) => {
      const { data: parentNode, error } = await supabase
        .from('chat_nodes')
        .select('depth')
        .eq('id', parentNodeId)
        .single()
      
      if (error) {
        throw createAppError(
          'Failed to retrieve parent node depth',
          classifyDatabaseError(error),
          { context: { parentNodeId }, cause: error }
        )
      }
      
      return parentNode?.depth || 0
    }, `depth_${parentNodeId}`)
  } catch (error) {
    if (error && typeof error === 'object' && 'category' in error) {
      throw error // Re-throw AppError
    }
    throw createAppError(
      'Connection pool error while getting parent depth',
      ErrorCategory.DATABASE,
      { context: { parentNodeId }, cause: error as Error }
    )
  }
}

/**
 * Create chat node using pooled connection
 */
export async function createChatNode(nodeData: {
  sessionId: string
  parentId: string | null
  model: ModelId
  prompt: string
  temperature: number
  maxTokens: number
  depth: number
  metadata?: Record<string, any>
}): Promise<any> {
  try {
    return await withPooledConnection(async (supabase) => {
      const { data: chatNodeRaw, error: nodeError } = await supabase
        .from('chat_nodes')
        .insert({
          session_id: nodeData.sessionId,
          parent_id: nodeData.parentId,
          model: nodeData.model,
          prompt: nodeData.prompt,
          status: 'streaming',
          temperature: nodeData.temperature,
          max_tokens: nodeData.maxTokens,
          depth: nodeData.depth,
          metadata: nodeData.metadata || {},
        })
        .select()
        .single()

      if (nodeError) {
        throw createAppError(
          'Failed to create chat node in database',
          classifyDatabaseError(nodeError),
          { context: nodeData, cause: nodeError }
        )
      }

      // Update session's updated_at timestamp to reflect new node creation
      // Also increment node_count for accurate tracking
      const { data: currentSession } = await supabase
        .from('sessions')
        .select('node_count')
        .eq('id', nodeData.sessionId)
        .single()
      
      const { error: sessionUpdateError } = await supabase
        .from('sessions')
        .update({ 
          updated_at: new Date().toISOString(),
          node_count: (currentSession?.node_count || 0) + 1
        })
        .eq('id', nodeData.sessionId)

      if (sessionUpdateError) {
        console.warn('Failed to update session timestamp:', sessionUpdateError)
        // Don't throw - this is not critical
      } else {
        console.log(`📝 Updated session ${nodeData.sessionId} updated_at for new node`)
      }

      return chatNodeRaw
    }, `create_${nodeData.sessionId}`)
  } catch (error) {
    if (error && typeof error === 'object' && 'category' in error) {
      throw error // Re-throw AppError
    }
    throw createAppError(
      'Connection pool error while creating chat node',
      ErrorCategory.DATABASE,
      { context: nodeData, cause: error as Error }
    )
  }
}

/**
 * Update chat node with response using pooled connection
 */
export async function updateChatNodeResponse(
  nodeId: string,
  response: string,
  usage: { prompt_tokens: number; completion_tokens: number } | undefined,
  model: string,
  status: string = 'completed',
  errorMessage?: string
): Promise<void> {
  try {
    return await withPooledConnection(async (supabase) => {
      // First, get the existing node data to preserve metadata
      const { data: existingNode } = await supabase
        .from('chat_nodes')
        .select('metadata')
        .eq('id', nodeId)
        .single()

      const updateData: any = {
        response,
        status,
        prompt_tokens: usage?.prompt_tokens || 0,
        response_tokens: usage?.completion_tokens || 0,
        cost_usd: calculateCost(model, usage),
        metadata: existingNode?.metadata || {}, // Preserve existing metadata
      }
      
      if (errorMessage) {
        updateData.error_message = errorMessage
      }

      const { error: updateError } = await supabase
        .from('chat_nodes')
        .update(updateData)
        .eq('id', nodeId)

      if (updateError) {
        throw createAppError(
          'Failed to update chat node response',
          classifyDatabaseError(updateError),
          { context: { nodeId, model, hasUsage: !!usage, status }, cause: updateError }
        )
      }
    }, `update_${nodeId}`)
  } catch (error) {
    if (error && typeof error === 'object' && 'category' in error) {
      throw error // Re-throw AppError
    }
    throw createAppError(
      'Connection pool error while updating chat node',
      ErrorCategory.DATABASE,
      { context: { nodeId, model, status }, cause: error as Error }
    )
  }
}

/**
 * Get session nodes using pooled connection
 */
export async function getSessionNodesPooled(sessionId: string): Promise<any[]> {
  return await withPooledConnection(async (supabase) => {
    const { data: nodes, error } = await supabase
      .from('chat_nodes')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return nodes || []
  }, `session_${sessionId}`)
}

/**
 * Get chat sessions using pooled connection
 */
export async function getChatSessionsPooled(userId: string): Promise<any[]> {
  return await withPooledConnection(async (supabase) => {
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        name,
        created_at,
        updated_at,
        chat_nodes(count)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
    }

    return sessions || []
  }, `sessions_${userId}`)
}

/**
 * Create chat session using pooled connection
 */
export async function createChatSessionPooled(name: string, userId: string): Promise<any> {
  return await withPooledConnection(async (supabase) => {
    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        name,
        user_id: userId,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return session
  }, `create_session_${userId}`)
}

/**
 * Delete chat session using pooled connection
 */
export async function deleteChatSessionPooled(sessionId: string, userId: string): Promise<void> {
  return await withPooledConnection(async (supabase) => {
    // First delete all nodes in the session
    const { error: nodesError } = await supabase
      .from('chat_nodes')
      .delete()
      .eq('session_id', sessionId)

    if (nodesError) {
      throw nodesError
    }

    // Then delete the session
    const { error: sessionError } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId)

    if (sessionError) {
      throw sessionError
    }
  }, `delete_${sessionId}`)
}

/**
 * Batch get multiple nodes by IDs using pooled connection
 */
export async function getNodesByIdsPooled(nodeIds: string[]): Promise<any[]> {
  if (nodeIds.length === 0) return []

  return await withPooledConnection(async (supabase) => {
    const { data: nodes, error } = await supabase
      .from('chat_nodes')
      .select('*')
      .in('id', nodeIds)

    if (error) {
      throw error
    }

    return nodes || []
  }, 'batch_nodes')
}

// Helper function to calculate cost (keeping existing logic)
function calculateCost(model: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  if (!usage) return 0

  const costMap: Record<string, { input: number; output: number }> = {
    'openai/gpt-4o': { input: 5, output: 15 },
    'openai/gpt-4-turbo': { input: 10, output: 30 },
    'openai/gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'anthropic/claude-3.5-sonnet': { input: 3, output: 15 },
    'anthropic/claude-3-opus': { input: 15, output: 75 },
    'google/gemini-pro': { input: 0.5, output: 1.5 },
    'meta-llama/llama-3.1-70b-instruct': { input: 0.8, output: 0.8 },
  }

  const modelCost = costMap[model] || { input: 1, output: 1 }
  const inputCost = (usage.prompt_tokens / 1_000_000) * modelCost.input
  const outputCost = (usage.completion_tokens / 1_000_000) * modelCost.output
  
  return inputCost + outputCost
}
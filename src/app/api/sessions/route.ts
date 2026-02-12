import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getChatSessionsPooled, createChatSessionPooled } from '@/lib/db/pooled-operations'
import {
  withErrorHandler,
  createAppError,
  ErrorCategory,
  classifyDatabaseError,
  withRetry
} from '@/lib/errors/error-handler'
import { loadOptimizedSessions, executeOptimizedQuery, clearSessionCache } from '@/lib/db/query-optimizer'
import { log } from '@/lib/utils/logger'
import { canCreateSession, incrementSessionCount } from '@/lib/billing/usage-tracker'

export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const archived = searchParams.get('archived') === 'true'

  const offset = (page - 1) * limit

  // Get sessions using optimized query with selective field loading
  const sessionsRaw = await loadOptimizedSessions(user.id, {
    includeNodeCount: true,
    limit,
    offset,
    archived
  })

    // Convert to camelCase and use last node creation time for display
    const sessions = (sessionsRaw || []).map(session => ({
      id: session.id,
      name: session.name,
      description: session.description,
      userId: session.user_id,
      rootNodeId: session.root_node_id,
      totalCostUsd: session.total_cost_usd || 0,
      totalTokens: session.total_tokens || 0,
      nodeCount: session.node_count || 0,
      maxDepth: session.max_depth || 0,
      isArchived: session.is_archived || false,
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.last_node_created_at || session.updated_at), // Use last node time for display
      lastAccessedAt: new Date(session.last_accessed_at),
      lastNodeCreatedAt: session.last_node_created_at ? new Date(session.last_node_created_at) : null,
    }))

  // Get total count for pagination with optimized caching
  const { count } = await executeOptimizedQuery(
    `sessions_count_${user.id}_${archived}`,
    async (supabase) => {
      const result = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_archived', archived)
      
      if (result.error) {
        throw createAppError(
          'Failed to get sessions count',
          classifyDatabaseError(result.error),
          { context: { userId: user.id, archived }, cause: result.error }
        )
      }
      
      return result
    },
    { poolKey: `count_${user.id}`, cacheTTL: 120000 } // 2 minute cache
  )

  return NextResponse.json({
    success: true,
    data: {
      sessions,
      total: count || 0,
      page,
      limit,
    }
  })
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  // Check session creation quota
  const sessionQuota = await canCreateSession(user.id)
  if (!sessionQuota.allowed) {
    const limitMessage = sessionQuota.limit === -1
      ? 'unlimited'
      : `${sessionQuota.limit}`

    throw createAppError(
      'Session creation limit reached',
      ErrorCategory.QUOTA_EXCEEDED,
      {
        userMessage: `You have reached your session limit (${sessionQuota.currentSessions}/${limitMessage}). Please upgrade your plan or delete unused sessions.`,
        context: {
          currentSessions: sessionQuota.currentSessions,
          limit: sessionQuota.limit
        }
      }
    )
  }

  const body = await request.json()
  const { name, description } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createAppError(
      'Session name is required and cannot be empty',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Please provide a valid session name.',
        context: { providedName: name }
      }
    )
  }

  if (name.length > 100) {
    throw createAppError(
      'Session name is too long',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Session name must be 100 characters or less.',
        context: { nameLength: name.length }
      }
    )
  }

  // Create new session with optimized insert operation
  log.info('Creating new session', { name: name.trim(), userId: user.id })
  
  const sessionRaw = await executeOptimizedQuery(
    `create_session_${user.id}_${Date.now()}`, // Unique cache key
    async (supabase) => {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          user_id: user.id,
        })
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
        .single()
      
      if (error) {
        console.error('❌ Session creation error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        throw createAppError(
          'Failed to create session in database',
          classifyDatabaseError(error),
          {
            userMessage: 'Unable to create your session. Please try again.',
            context: { name, userId: user.id, errorDetails: error },
            cause: error
          }
        )
      }
      
      log.info('Session created successfully', { sessionId: data?.id })
      return data
    },
    { poolKey: `create_${user.id}`, skipCache: true } // Don't cache create operations
  )

    // Convert to camelCase
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
  
  // Increment session count after successful creation
  const incrementSuccess = await incrementSessionCount(user.id)
  if (!incrementSuccess) {
    log.warn('Failed to increment session count, but session was created', {
      userId: user.id,
      sessionId: session.id
    })
  }

  // Clear session cache to ensure fresh data on next fetch
  clearSessionCache(user.id)

  return NextResponse.json({
    success: true,
    data: {
      session,
    }
  })
})
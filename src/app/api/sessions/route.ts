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

export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = createClient()
  
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

  // Get sessions for the user with retry
  const { data: sessionsRaw, error } = await withRetry(async () => {
    const query = supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', archived)
      .order('last_accessed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    return await query
  }).catch(error => {
    throw createAppError(
      'Failed to fetch sessions from database',
      classifyDatabaseError(error),
      {
        userMessage: 'Unable to load your sessions. Please try again.',
        context: { userId: user.id, page, limit, archived },
        cause: error as Error
      }
    )
  })

  if (error) {
    throw createAppError(
      'Database query failed',
      classifyDatabaseError(error),
      { cause: error }
    )
  }

    // Convert to camelCase
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
      updatedAt: new Date(session.updated_at),
      lastAccessedAt: new Date(session.last_accessed_at),
    }))

  // Get total count for pagination with retry
  const { count } = await withRetry(async () => {
    return await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_archived', archived)
  }).catch(error => {
    throw createAppError(
      'Failed to get sessions count',
      classifyDatabaseError(error),
      { context: { userId: user.id, archived } }
    )
  })

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
  const supabase = createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
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

  // Create new session with retry
  const { data: sessionRaw, error } = await withRetry(async () => {
    return await supabase
      .from('sessions')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        user_id: user.id,
      })
      .select()
      .single()
  }).catch(error => {
    throw createAppError(
      'Failed to create session in database',
      classifyDatabaseError(error),
      {
        userMessage: 'Unable to create your session. Please try again.',
        context: { name, userId: user.id },
        cause: error as Error
      }
    )
  })

  if (error) {
    throw createAppError(
      'Session creation failed',
      classifyDatabaseError(error),
      { cause: error }
    )
  }

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

  return NextResponse.json({
    success: true,
    data: {
      session,
    }
  })
})
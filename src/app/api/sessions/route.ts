import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const archived = searchParams.get('archived') === 'true'

    const offset = (page - 1) * limit

    // Get sessions for the user
    let query = supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', archived)
      .order('last_accessed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: sessionsRaw, error } = await query

    if (error) {
      throw error
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

    // Get total count for pagination
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_archived', archived)

    return NextResponse.json({
      sessions,
      total: count || 0,
      page,
      limit,
    })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      )
    }

    // Create new session
    const { data: sessionRaw, error } = await supabase
      .from('sessions')
      .insert({
        name,
        description,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      throw error
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
      session,
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
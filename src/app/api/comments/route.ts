import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPooledServerClient } from '@/lib/supabase/connection-pool'
import { createAppError, ErrorCategory } from '@/lib/errors/error-handler'
import { performanceMonitor } from '@/lib/utils/performance-optimizer'

export async function GET(request: NextRequest) {
  const stopTimer = performanceMonitor.startTimer('comments_get')
  
  try {
    const { searchParams } = new URL(request.url)
    const nodeId = searchParams.get('nodeId')
    const sessionId = searchParams.get('sessionId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    if (!nodeId && !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Either nodeId or sessionId is required' },
        { status: 400 }
      )
    }
    
    const supabase = await getPooledServerClient()
    
    let query = supabase
      .from('node_comments')
      .select('*')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)
    
    if (nodeId) {
      query = query.eq('node_id', nodeId)
    } else if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    
    const { data: comments, error } = await query
    
    if (error) {
      throw createAppError(
        'Failed to fetch comments',
        ErrorCategory.DATABASE,
        { context: { nodeId, sessionId }, cause: error }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: { comments: comments || [] }
    })
    
  } catch (error) {
    console.error('❌ Comments GET error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.name === 'AppError' ? 400 : 500 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    stopTimer()
  }
}

export async function POST(request: NextRequest) {
  const stopTimer = performanceMonitor.startTimer('comments_post')
  
  try {
    const body = await request.json()
    const { nodeId, sessionId, content, commentType = 'user_comment', parentCommentId } = body
    
    console.log('📝 Comment POST request:', { nodeId, sessionId, contentLength: content?.length })
    
    if (!nodeId || !sessionId || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'nodeId, sessionId, and content are required' },
        { status: 400 }
      )
    }
    
    const supabase = await getPooledServerClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    console.log('👤 Authenticated user:', user.id)
    
    // First verify the node exists
    const { data: nodeData, error: nodeError } = await supabase
      .from('chat_nodes')
      .select('id, session_id')
      .eq('id', nodeId)
      .eq('session_id', sessionId)
      .single()
    
    if (nodeError || !nodeData) {
      console.error('Node verification failed:', nodeError)
      return NextResponse.json(
        { success: false, error: 'Node not found' },
        { status: 404 }
      )
    }
    
    // Then check session ownership separately
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()
    
    if (sessionError || !sessionData) {
      console.error('Session verification failed:', sessionError)
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }
    
    // Check if user has permission to comment
    // For now, only allow session owners to comment (to avoid recursion issues)
    const isSessionOwner = sessionData.user_id === user.id
    
    if (!isSessionOwner) {
      console.log('❌ User is not session owner:', { userId: user.id, sessionOwnerId: sessionData.user_id })
      return NextResponse.json(
        { success: false, error: 'Permission denied: only session owner can comment for now' },
        { status: 403 }
      )
    }
    
    console.log('✅ User authorized to comment')
    
    // Create the comment
    console.log('💾 Creating comment with data:', {
      node_id: nodeId,
      session_id: sessionId,
      user_id: user.id,
      content_preview: content.trim().substring(0, 50)
    })
    
    // Insert with only the basic fields that exist in simplified table
    const insertData = {
      node_id: nodeId,
      session_id: sessionId,
      user_id: user.id,
      content: content.trim()
    }
    
    console.log('📦 Inserting data:', insertData)
    
    const { data: comment, error: insertError } = await supabase
      .from('node_comments')
      .insert(insertData)
      .select('*')
      .single()
    
    if (insertError || !comment) {
      console.error('❌ Failed to insert comment:', insertError)
      throw createAppError(
        'Failed to create comment',
        ErrorCategory.DATABASE,
        { context: { nodeId, sessionId, userId: user.id }, cause: insertError }
      )
    }
    
    console.log('✅ Comment created successfully:', comment.id)
    
    return NextResponse.json({
      success: true,
      data: { comment }
    })
    
  } catch (error) {
    console.error('❌ Comments POST error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.name === 'AppError' ? 400 : 500 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    stopTimer()
  }
}

export async function PUT(request: NextRequest) {
  const stopTimer = performanceMonitor.startTimer('comments_put')
  
  try {
    const body = await request.json()
    const { commentId, content, isPinned, isResolved } = body
    
    if (!commentId) {
      return NextResponse.json(
        { success: false, error: 'commentId is required' },
        { status: 400 }
      )
    }
    
    const supabase = await getPooledServerClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Get current comment to check ownership
    const { data: currentComment, error: fetchError } = await supabase
      .from('node_comments')
      .select('user_id, content, edit_history, version')
      .eq('id', commentId)
      .single()
    
    if (fetchError || !currentComment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      )
    }
    
    // Only comment owner can edit content, session owners can pin/resolve
    if (content && currentComment.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: can only edit your own comments' },
        { status: 403 }
      )
    }
    
    const updateData: any = {}
    
    if (content !== undefined && content.trim() !== currentComment.content) {
      // Update content and track edit history
      const editHistory = currentComment.edit_history || []
      editHistory.push({
        version: currentComment.version,
        content: currentComment.content,
        edited_at: new Date().toISOString(),
        edited_by: user.id
      })
      
      updateData.content = content.trim()
      updateData.is_edited = true
      updateData.edit_history = editHistory
      updateData.version = currentComment.version + 1
    }
    
    if (isPinned !== undefined) {
      updateData.is_pinned = isPinned
    }
    
    if (isResolved !== undefined) {
      updateData.is_resolved = isResolved
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No changes provided' },
        { status: 400 }
      )
    }
    
    const { data: updatedComment, error: updateError } = await supabase
      .from('node_comments')
      .update(updateData)
      .eq('id', commentId)
      .select('*')
      .single()
    
    if (updateError || !updatedComment) {
      throw createAppError(
        'Failed to update comment',
        ErrorCategory.DATABASE,
        { context: { commentId, updateData }, cause: updateError }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: { comment: updatedComment }
    })
    
  } catch (error) {
    console.error('❌ Comments PUT error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.name === 'AppError' ? 400 : 500 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    stopTimer()
  }
}

export async function DELETE(request: NextRequest) {
  const stopTimer = performanceMonitor.startTimer('comments_delete')
  
  try {
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')
    
    if (!commentId) {
      return NextResponse.json(
        { success: false, error: 'commentId is required' },
        { status: 400 }
      )
    }
    
    const supabase = await getPooledServerClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Check if user owns the comment
    const { data: comment, error: fetchError } = await supabase
      .from('node_comments')
      .select('id, user_id, session_id')
      .eq('id', commentId)
      .single()
    
    if (fetchError || !comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      )
    }
    
    // Check session ownership separately
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', comment.session_id)
      .single()
    
    if (sessionError || !sessionData) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }
    
    const canDelete = comment.user_id === user.id || sessionData.user_id === user.id
    
    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: can only delete your own comments or comments in your sessions' },
        { status: 403 }
      )
    }
    
    const { error: deleteError } = await supabase
      .from('node_comments')
      .delete()
      .eq('id', commentId)
    
    if (deleteError) {
      throw createAppError(
        'Failed to delete comment',
        ErrorCategory.DATABASE,
        { context: { commentId }, cause: deleteError }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: { message: 'Comment deleted successfully' }
    })
    
  } catch (error) {
    console.error('❌ Comments DELETE error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.name === 'AppError' ? 400 : 500 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    stopTimer()
  }
}
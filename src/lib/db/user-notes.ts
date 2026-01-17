/**
 * User Notes Database Operations
 * Handles CRUD operations for user-created note nodes
 */

import { createClient } from '@/lib/supabase/server'
import { ChatNode, CreateUserNoteInput, UpdateUserNoteInput } from '@/types'

/**
 * snake_case → camelCase 変換
 */
function convertToCamelCase(node: any): ChatNode {
  return {
    id: node.id,
    parentId: node.parent_id,
    sessionId: node.session_id,
    model: node.model,
    systemPrompt: node.system_prompt,
    prompt: node.prompt,
    response: node.response,
    status: node.status,
    errorMessage: node.error_message,
    depth: node.depth,
    promptTokens: node.prompt_tokens || 0,
    responseTokens: node.response_tokens || 0,
    costUsd: parseFloat(node.cost_usd || '0'),
    temperature: node.temperature,
    maxTokens: node.max_tokens,
    topP: node.top_p,
    metadata: node.metadata || {},
    createdAt: new Date(node.created_at),
    updatedAt: new Date(node.updated_at),
  }
}

/**
 * ユーザーノートを作成
 */
export async function createUserNote(
  data: CreateUserNoteInput
): Promise<ChatNode> {
  const supabase = createClient()

  // ユーザー認証確認
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized: User must be authenticated to create notes')
  }

  // セッションの所有権確認
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', data.sessionId)
    .single()

  if (sessionError || !session) {
    throw new Error('Session not found')
  }

  if (session.user_id !== user.id) {
    throw new Error('Unauthorized: Cannot create note in another user\'s session')
  }

  // 親ノードの深さを取得
  let depth = 0
  if (data.parentId) {
    const { data: parent, error: parentError } = await supabase
      .from('chat_nodes')
      .select('depth, session_id')
      .eq('id', data.parentId)
      .single()

    if (parentError) {
      throw new Error(`Parent node not found: ${data.parentId}`)
    }

    // 親ノードが同じセッションに属することを確認
    if (parent.session_id !== data.sessionId) {
      throw new Error('Parent node must be in the same session')
    }

    depth = parent.depth + 1
  }

  // ユーザーノートとして保存
  const { data: node, error } = await supabase
    .from('chat_nodes')
    .insert({
      session_id: data.sessionId,
      parent_id: data.parentId || null,
      model: 'system/user-note',
      prompt: data.content,
      response: null,
      status: 'completed',
      depth,
      prompt_tokens: 0,
      response_tokens: 0,
      cost_usd: 0,
      metadata: {
        nodeType: 'user_note',
        noteTitle: data.title || null,
        noteTags: data.tags || []
      }
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create user note:', error)
    throw new Error(`Failed to create user note: ${error.message}`)
  }

  console.log(`✅ Created user note: ${node.id} in session ${data.sessionId}`)
  return convertToCamelCase(node)
}

/**
 * ユーザーノートを更新
 */
export async function updateUserNote(
  nodeId: string,
  updates: UpdateUserNoteInput
): Promise<ChatNode> {
  const supabase = createClient()

  // ユーザー認証確認
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // 既存のノードを取得
  const { data: existing, error: fetchError } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('id', nodeId)
    .single()

  if (fetchError || !existing) {
    console.error('Failed to fetch node:', fetchError)
    throw new Error('Note not found')
  }

  // セッションの所有者確認
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', existing.session_id)
    .single()

  if (sessionError || !session) {
    console.error('Failed to fetch session:', sessionError)
    throw new Error('Session not found')
  }

  if (session.user_id !== user.id) {
    throw new Error('Unauthorized: Cannot update another user\'s note')
  }

  // ユーザーノートであることを確認
  if (existing.metadata?.nodeType !== 'user_note') {
    throw new Error('Cannot update: This is not a user note')
  }

  // メタデータを更新
  const updatedMetadata = {
    ...existing.metadata,
    nodeType: 'user_note',
    ...(updates.title !== undefined && { noteTitle: updates.title }),
    ...(updates.tags !== undefined && { noteTags: updates.tags })
  }

  // 更新実行
  const { data: updated, error: updateError } = await supabase
    .from('chat_nodes')
    .update({
      ...(updates.content !== undefined && { prompt: updates.content }),
      metadata: updatedMetadata,
      updated_at: new Date().toISOString()
    })
    .eq('id', nodeId)
    .select()
    .single()

  if (updateError) {
    console.error('Failed to update user note:', updateError)
    throw new Error(`Failed to update user note: ${updateError.message}`)
  }

  console.log(`✅ Updated user note: ${nodeId}`)
  return convertToCamelCase(updated)
}

/**
 * ユーザーノートを削除
 */
export async function deleteUserNote(nodeId: string): Promise<void> {
  const supabase = createClient()

  // ユーザー認証確認
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // 既存のノードを取得
  const { data: existing, error: fetchError } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('id', nodeId)
    .single()

  if (fetchError || !existing) {
    console.error('Failed to fetch node:', fetchError)
    throw new Error('Note not found')
  }

  // セッションの所有者確認
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', existing.session_id)
    .single()

  if (sessionError || !session) {
    console.error('Failed to fetch session:', sessionError)
    throw new Error('Session not found')
  }

  if (session.user_id !== user.id) {
    throw new Error('Unauthorized: Cannot delete another user\'s note')
  }

  // ユーザーノートであることを確認
  if (existing.metadata?.nodeType !== 'user_note') {
    throw new Error('Cannot delete: This is not a user note')
  }

  // 削除実行（CASCADE により子ノードも削除される）
  const { error: deleteError } = await supabase
    .from('chat_nodes')
    .delete()
    .eq('id', nodeId)

  if (deleteError) {
    console.error('Failed to delete user note:', deleteError)
    throw new Error(`Failed to delete user note: ${deleteError.message}`)
  }

  console.log(`✅ Deleted user note: ${nodeId}`)
}

/**
 * セッション内のユーザーノート一覧を取得
 */
export async function getSessionUserNotes(
  sessionId: string
): Promise<ChatNode[]> {
  const supabase = createClient()

  // ユーザー認証確認
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // セッションの所有権確認
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    throw new Error('Session not found')
  }

  if (session.user_id !== user.id) {
    throw new Error('Unauthorized: Cannot access another user\'s notes')
  }

  // ユーザーノート一覧を取得
  const { data, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('session_id', sessionId)
    .eq('metadata->>nodeType', 'user_note')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user notes:', error)
    throw new Error(`Failed to fetch user notes: ${error.message}`)
  }

  return (data || []).map(convertToCamelCase)
}

/**
 * ノードIDでユーザーノートを取得
 */
export async function getUserNoteById(nodeId: string): Promise<ChatNode> {
  const supabase = createClient()

  // ユーザー認証確認
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // ノードを取得
  const { data, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('id', nodeId)
    .eq('metadata->>nodeType', 'user_note')
    .single()

  if (error || !data) {
    console.error('Failed to fetch node:', error)
    throw new Error('Note not found')
  }

  // セッションの所有者確認
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', data.session_id)
    .single()

  if (sessionError || !session) {
    console.error('Failed to fetch session:', sessionError)
    throw new Error('Session not found')
  }

  if (session.user_id !== user.id) {
    throw new Error('Unauthorized: Cannot access another user\'s note')
  }

  return convertToCamelCase(data)
}

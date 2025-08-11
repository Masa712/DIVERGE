import { createClient } from '@/lib/supabase/server'
import { ChatNode, ModelId, NodeStatus } from '@/types'

export async function createChatNode(data: {
  sessionId: string
  parentId?: string
  model: ModelId
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}): Promise<ChatNode> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Calculate depth
  let depth = 0
  if (data.parentId) {
    const { data: parent } = await supabase
      .from('chat_nodes')
      .select('depth')
      .eq('id', data.parentId)
      .single()
    
    if (parent) depth = parent.depth + 1
  }

  const { data: node, error } = await supabase
    .from('chat_nodes')
    .insert({
      session_id: data.sessionId,
      parent_id: data.parentId,
      model: data.model,
      prompt: data.prompt,
      system_prompt: data.systemPrompt,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
      depth,
      status: 'pending' as NodeStatus,
    })
    .select()
    .single()

  if (error) throw error
  return node
}

export async function getSessionChatNodes(sessionId: string): Promise<ChatNode[]> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function updateChatNode(
  nodeId: string,
  updates: Partial<{
    response: string
    status: NodeStatus
    errorMessage: string
    promptTokens: number
    responseTokens: number
    costUsd: number
  }>
): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('chat_nodes')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', nodeId)

  if (error) throw error
}

export async function getChatNodeById(nodeId: string): Promise<ChatNode | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('id', nodeId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export async function getChatNodeChildren(parentId: string): Promise<ChatNode[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function buildContextForNode(nodeId: string): Promise<Array<{ role: string; content: string }>> {
  const supabase = createClient()
  
  // Get the node and its ancestors
  const context: Array<{ role: string; content: string }> = []
  
  let currentNodeId: string | null = nodeId
  const nodeHistory: ChatNode[] = []
  
  // Build path from current node to root
  while (currentNodeId) {
    const { data: node }: { data: ChatNode | null } = await supabase
      .from('chat_nodes')
      .select('*')
      .eq('id', currentNodeId)
      .single()
    
    if (!node) break
    nodeHistory.unshift(node)
    currentNodeId = node.parentId
  }
  
  // Build context from node history
  for (const node of nodeHistory) {
    // Add system prompt if it's the first node and has one
    if (node.systemPrompt && nodeHistory[0].id === node.id) {
      context.push({ role: 'system', content: node.systemPrompt })
    }
    
    // Add user prompt
    context.push({ role: 'user', content: node.prompt })
    
    // Add assistant response if available
    if (node.response) {
      context.push({ role: 'assistant', content: node.response })
    }
  }
  
  return context
}
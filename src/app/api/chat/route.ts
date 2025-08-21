import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { createClient } from '@/lib/supabase/server'
import { ModelId } from '@/types'
import { buildEnhancedContext, extractNodeReferences } from '@/lib/db/enhanced-context'
import { clearSessionCache } from '@/lib/db/enhanced-context-cache'

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
    const { 
      messages, 
      model, 
      temperature = 0.7, 
      max_tokens = 1000,
      sessionId,
      parentNodeId,
      useEnhancedContext = true
    } = body

    if (!messages || !model) {
      return NextResponse.json(
        { error: 'Messages and model are required' },
        { status: 400 }
      )
    }

    // Extract user prompt for processing
    const userPrompt = messages[messages.length - 1]?.content || ''

    // Calculate depth for the new node
    let depth = 0
    if (parentNodeId) {
      const { data: parentNode } = await supabase
        .from('chat_nodes')
        .select('depth')
        .eq('id', parentNodeId)
        .single()
      
      if (parentNode) {
        depth = parentNode.depth + 1
      }
    }

    // Create a new chat node in the database
    const { data: chatNodeRaw, error: nodeError } = await supabase
      .from('chat_nodes')
      .insert({
        session_id: sessionId,
        parent_id: parentNodeId,
        model: model as ModelId,
        prompt: userPrompt,
        status: 'streaming',
        temperature,
        max_tokens,
        depth,
      })
      .select()
      .single()

    if (nodeError) {
      console.error('Error creating chat node:', nodeError)
      return NextResponse.json(
        { error: 'Failed to create chat node' },
        { status: 500 }
      )
    }

    // Convert to camelCase for consistency
    const chatNode = {
      id: chatNodeRaw.id,
      parentId: chatNodeRaw.parent_id,
      sessionId: chatNodeRaw.session_id,
      model: chatNodeRaw.model,
      systemPrompt: chatNodeRaw.system_prompt,
      prompt: chatNodeRaw.prompt,
      response: chatNodeRaw.response,
      status: chatNodeRaw.status,
      errorMessage: chatNodeRaw.error_message,
      depth: chatNodeRaw.depth,
      promptTokens: chatNodeRaw.prompt_tokens || 0,
      responseTokens: chatNodeRaw.response_tokens || 0,
      costUsd: chatNodeRaw.cost_usd || 0,
      temperature: chatNodeRaw.temperature,
      maxTokens: chatNodeRaw.max_tokens,
      topP: chatNodeRaw.top_p,
      metadata: chatNodeRaw.metadata || {},
      createdAt: new Date(chatNodeRaw.created_at),
      updatedAt: new Date(chatNodeRaw.updated_at),
    }

    // Build context using enhanced context system if enabled and parentNodeId exists
    let finalMessages = messages
    let contextMetadata = null
    
    console.log(`Debug: useEnhancedContext=${useEnhancedContext}, parentNodeId=${parentNodeId}`)
    
    if (useEnhancedContext && parentNodeId) {
      try {
        console.log(`Starting enhanced context building for parentNodeId: ${parentNodeId}`)
        
        // Extract node references from user prompt
        const referencedNodes = extractNodeReferences(userPrompt)
        console.log(`Extracted references:`, referencedNodes)
        
        // Build enhanced context with model awareness
        const enhancedContext = await buildEnhancedContext(parentNodeId, {
          includeSiblings: true,
          maxTokens: 3000, // Leave room for new prompt and response
          includeReferences: referencedNodes,
          model: model // NEW: Pass model for accurate token counting
        })
        
        contextMetadata = enhancedContext.metadata
        
        // Combine enhanced context with new user message
        finalMessages = [
          ...enhancedContext.messages,
          { role: 'user', content: userPrompt }
        ]
        
        console.log(`Enhanced context: ${enhancedContext.metadata.totalTokens} tokens, ${enhancedContext.metadata.siblingCount} siblings, ${referencedNodes.length} references`)
        
      } catch (contextError) {
        console.warn('Enhanced context failed, falling back to simple messages:', contextError)
        // Keep original messages as fallback
      }
    } else {
      console.log(`Enhanced context skipped - useEnhancedContext: ${useEnhancedContext}, parentNodeId: ${parentNodeId}`)
    }

    // Initialize OpenRouter client
    const client = new OpenRouterClient()

    // Create completion with enhanced context
    const response = await client.createChatCompletion({
      model: model as ModelId,
      messages: finalMessages,
      temperature,
      max_tokens,
      stream: false,
    })

    const responseContent = response.choices[0]?.message?.content || ''
    const usage = response.usage

    // Update chat node with response
    const { error: updateError } = await supabase
      .from('chat_nodes')
      .update({
        response: responseContent,
        status: 'completed',
        prompt_tokens: usage?.prompt_tokens || 0,
        response_tokens: usage?.completion_tokens || 0,
        cost_usd: calculateCost(model, usage),
      })
      .eq('id', chatNode.id)

    if (updateError) {
      console.error('Error updating chat node:', updateError)
    } else {
      // Clear session cache since new node was added
      clearSessionCache(sessionId)
    }

    return NextResponse.json({
      id: chatNode.id,
      content: responseContent,
      usage,
      contextMetadata,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate cost based on model and usage
function calculateCost(model: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  if (!usage) return 0

  // Cost per million tokens (you can import this from types/index.ts)
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
import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { createClient } from '@/lib/supabase/server'
import { ModelId } from '@/types'
import { buildContextWithStrategy, extractNodeReferences } from '@/lib/db/enhanced-context'
import { clearSessionCache } from '@/lib/db/enhanced-context-cache'
import { isRedisAvailable } from '@/lib/redis/client'
import { getRedisEnhancedContextCache } from '@/lib/db/redis-enhanced-context-cache'
import { getParentNodeDepth, createChatNode, updateChatNodeResponse } from '@/lib/db/pooled-operations'

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

    // Calculate depth for the new node using pooled connection
    let depth = 0
    if (parentNodeId) {
      try {
        const parentDepth = await getParentNodeDepth(parentNodeId)
        depth = parentDepth + 1
      } catch (error) {
        console.warn('Failed to get parent depth, using 0:', error)
      }
    }

    // Create a new chat node using pooled connection
    let chatNodeRaw
    try {
      chatNodeRaw = await createChatNode({
        sessionId,
        parentId: parentNodeId,
        model: model as ModelId,
        prompt: userPrompt,
        temperature,
        maxTokens: max_tokens,
        depth,
      })
    } catch (nodeError) {
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
        
        // Build enhanced context with intelligent strategy selection
        const enhancedContext = await buildContextWithStrategy(parentNodeId, userPrompt, {
          includeSiblings: true,
          maxTokens: 3000, // Leave room for new prompt and response
          includeReferences: referencedNodes,
          model: model // Pass model for accurate token counting
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

    // Update chat node with response using pooled connection
    try {
      await updateChatNodeResponse(chatNode.id, responseContent, usage, model)
      
      // Clear session cache since new node was added
      // Use Redis cache if available, otherwise fall back to local cache
      const redisIsAvailable = await isRedisAvailable()
      if (redisIsAvailable) {
        const redisCache = getRedisEnhancedContextCache()
        await redisCache.clearSessionCache(sessionId)
        // Also add the new node to cache
        await redisCache.addNode(sessionId, {
          ...chatNode,
          response: responseContent,
          status: 'completed',
          createdAt: chatNode.createdAt.toISOString(),
          updatedAt: chatNode.updatedAt.toISOString(),
        })
      } else {
        await clearSessionCache(sessionId)
      }
    } catch (updateError) {
      console.error('Error updating chat node:', updateError)
      // Continue execution even if update fails
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


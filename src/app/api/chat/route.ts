import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { createClient } from '@/lib/supabase/server'
import { ModelId } from '@/types'
import { buildContextWithStrategy, extractNodeReferences } from '@/lib/db/enhanced-context'
import { clearSessionCache } from '@/lib/db/enhanced-context-cache'
import { isRedisAvailable } from '@/lib/redis/client'
import { getRedisEnhancedContextCache } from '@/lib/db/redis-enhanced-context-cache'
import { getParentNodeDepth, createChatNode, updateChatNodeResponse } from '@/lib/db/pooled-operations'
import { 
  withErrorHandler, 
  createAppError, 
  ErrorCategory, 
  classifyDatabaseError,
  withRetry 
} from '@/lib/errors/error-handler'
import { recordError } from '@/lib/errors/error-monitoring'
import { performanceMonitor, withTimeout } from '@/lib/utils/performance-optimizer'

export const POST = withErrorHandler(async (request: NextRequest) => {
  const stopTimer = performanceMonitor.startTimer('chat_api_total')
  
  try {
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
  const { 
    messages, 
    model, 
    temperature = 0.7, 
    max_tokens = 4000, // Increased default for better responses
    sessionId,
    parentNodeId,
    useEnhancedContext = true
  } = body

  if (!messages || !model) {
    throw createAppError(
      'Messages and model parameters are required',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Please provide both messages and model selection.',
        context: { hasMessages: !!messages, hasModel: !!model }
      }
    )
  }

    // Extract user prompt for processing
    const userPrompt = messages[messages.length - 1]?.content || ''

  // Calculate depth for the new node using pooled connection with retry
  let depth = 0
  if (parentNodeId) {
    try {
      depth = await withRetry(async () => {
        const parentDepth = await getParentNodeDepth(parentNodeId)
        return parentDepth + 1
      }, { maxAttempts: 2 })
    } catch (error) {
      // Log but don't fail - use depth 0 as fallback
      console.warn('Failed to get parent depth, using 0:', error)
      recordError(createAppError(
        'Failed to retrieve parent node depth',
        classifyDatabaseError(error),
        { context: { parentNodeId }, cause: error as Error }
      ))
    }
  }

  // Create a new chat node using pooled connection with retry
  const chatNodeRaw = await withRetry(async () => {
    return await createChatNode({
      sessionId,
      parentId: parentNodeId,
      model: model as ModelId,
      prompt: userPrompt,
      temperature,
      maxTokens: max_tokens,
      depth,
    })
  }, { maxAttempts: 3 }).catch(error => {
    throw createAppError(
      'Failed to create chat node in database',
      classifyDatabaseError(error),
      {
        userMessage: 'Unable to save your message. Please try again.',
        context: { sessionId, parentNodeId, model },
        cause: error as Error
      }
    )
  })

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
    
    // Debug: Enhanced context evaluation
    if (process.env.NODE_ENV === 'development') {
      console.log(`🧠 Enhanced context: ${useEnhancedContext}, parent: ${parentNodeId ? 'present' : 'none'}`)
    }
    
    if (useEnhancedContext && parentNodeId) {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🚀 Building enhanced context for: ${parentNodeId}`)
        }
        
        // Extract node references from user prompt
        const referencedNodes = extractNodeReferences(userPrompt)
        
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
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Enhanced context: ${enhancedContext.metadata.totalTokens} tokens, ${enhancedContext.metadata.siblingCount} siblings, ${referencedNodes.length} references`)
        }
        
      } catch (contextError) {
        // Log but don't fail - enhanced context is optional
        recordError(createAppError(
          'Enhanced context building failed',
          ErrorCategory.INTERNAL,
          {
            userMessage: 'Using simplified context for this message.',
            context: { parentNodeId, useEnhancedContext },
            cause: contextError as Error,
            severity: 'medium' as any
          }
        ))
        console.warn('Enhanced context failed, falling back to simple messages:', contextError)
        // Keep original messages as fallback
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`⏩ Enhanced context skipped - useEnhancedContext: ${useEnhancedContext}, parentNodeId: ${parentNodeId}`)
    }

  // Initialize OpenRouter client and create completion with timeout and retry
  const client = new OpenRouterClient()
  const aiTimer = performanceMonitor.startTimer('openrouter_api')
  
  // Grok-4 is a reasoning model that needs more time (2-4 minutes typical)
  const timeoutMs = model === 'x-ai/grok-4' ? 150000 : 30000 // 2.5 minutes for Grok-4, 30 seconds for others
  
  // Set model-specific max_tokens for optimal output length
  const getOptimalMaxTokens = (modelId: string, userMaxTokens: number): number => {
    // For reasoning models like Grok-4, allow more tokens for complete responses
    if (modelId === 'x-ai/grok-4') return Math.max(userMaxTokens, 6000)
    
    // For high-context models, use generous limits
    if (modelId.includes('gpt-5') || modelId.includes('claude-opus')) return Math.max(userMaxTokens, 5000)
    
    // For other models, ensure minimum for complete responses
    return Math.max(userMaxTokens, 4000)
  }
  
  const optimalMaxTokens = getOptimalMaxTokens(model, max_tokens)
  
  const response = await withTimeout(
    withRetry(async () => {
      return await client.createChatCompletion({
        model: model as ModelId,
        messages: finalMessages,
        temperature,
        max_tokens: optimalMaxTokens,
        stream: false,
      })
    }, { maxAttempts: 2 }),
    timeoutMs,
    'OpenRouter API call'
  ).catch(error => {
    aiTimer()
    throw createAppError(
      'AI service request failed or timed out',
      ErrorCategory.EXTERNAL_API,
      {
        userMessage: 'The AI service is temporarily unavailable. Please try again in a moment.',
        context: { model, messageCount: finalMessages.length },
        cause: error as Error
      }
    )
  })
  
  aiTimer()

    const responseContent = response.choices[0]?.message?.content || ''
    const usage = response.usage

  // Update chat node with response using pooled connection with retry
  try {
    await withRetry(async () => {
      await updateChatNodeResponse(chatNode.id, responseContent, usage, model)
    }, { maxAttempts: 3 })
    
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
    // Log error but don't fail the request - user got their response
    recordError(createAppError(
      'Failed to update chat node with response',
      classifyDatabaseError(updateError),
      {
        context: { chatNodeId: chatNode.id, sessionId },
        cause: updateError as Error,
        severity: 'medium' as any
      }
    ))
  }

    return NextResponse.json({
      success: true,
      data: {
        id: chatNode.id,
        content: responseContent,
        usage,
        contextMetadata,
      }
    })
  } finally {
    stopTimer()
  }
})


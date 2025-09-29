import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient, supportsReasoning, getReasoningConfig } from '@/lib/openrouter/client'
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
import { log } from '@/lib/utils/logger'
import { tavilyClient } from '@/lib/tavily'
import { checkUserQuota, trackTokenUsage, canUseAdvancedModels, estimateTokens } from '@/lib/billing/usage-tracker'

// Background processing function for AI responses
async function processAIResponseInBackground(
  chatNode: any,
  messages: any[],
  model: string,
  temperature: number,
  maxTokens: number,
  sessionId: string,
  parentNodeId: string | undefined,
  useEnhancedContext: boolean,
  userPrompt: string,
  enableWebSearch: boolean = true,
  reasoning: boolean = false,
  userId: string
) {
  try {
    // Build context using enhanced context system if enabled and parentNodeId exists
    let finalMessages = messages
    let contextMetadata = null
    let webSearchResults = null
    
    // Add current date context to help AI understand the current time
    const currentDate = new Date()
    const dateContext = `Important: Today's date is ${currentDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}, ${currentDate.getFullYear()}. The current year is ${currentDate.getFullYear()}, not 2024.`
    
    // Check if web search should be performed
    log.info('Web search evaluation', { 
      enableWebSearch, 
      tavilyConfigured: tavilyClient.isConfigured(),
      userPrompt: userPrompt.substring(0, 100) + '...'
    })
    
    if (enableWebSearch && tavilyClient.isConfigured()) {
      // When web search is enabled, always perform search for all queries
      log.info('Web search enabled, performing search for query', { query: userPrompt.substring(0, 100) + '...' })
      
      try {
        log.info('Performing web search for query', { query: userPrompt })
        const searchResults = await tavilyClient.search(userPrompt, {
          maxResults: 3,
          includeAnswer: true,
          searchDepth: 'basic'
        })
        
        if (searchResults && searchResults.results.length > 0) {
          webSearchResults = searchResults
          
          // Add search context to messages with date reminder
          const searchContext = `${dateContext}

Web search results for "${userPrompt}":
${searchResults.answer ? `Summary: ${searchResults.answer}\n\n` : ''}
${searchResults.results.map((r, i) => 
  `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content.substring(0, 200)}...\n`
).join('\n')}

Based on these search results and knowing that today is ${currentDate.getFullYear()}, please provide an informed response.`
          
          // Insert search results before the user message
          finalMessages = [
            ...messages.slice(0, -1),
            { role: 'system', content: searchContext },
            messages[messages.length - 1]
          ]
          
          log.info('Web search completed', { resultCount: searchResults.results.length })
        }
      } catch (searchError) {
        log.warn('Web search failed, continuing without search results', searchError)
      }
    }
    
    // Enhanced context evaluation
    log.debug('Enhanced context evaluation', { useEnhancedContext, hasParent: !!parentNodeId })
    
    if (useEnhancedContext && parentNodeId) {
      try {
        log.debug('Building enhanced context', { parentNodeId })
        
        // Extract node references from user prompt
        const referencedNodes = extractNodeReferences(userPrompt)
        
        // Build enhanced context with intelligent strategy selection
        const enhancedContext = await buildContextWithStrategy(parentNodeId, userPrompt, {
          includeSiblings: false, // FIXED: Prevent cross-branch contamination
          maxTokens: 3000, // Leave room for new prompt and response
          includeReferences: referencedNodes,
          model: model // Pass model for accurate token counting
        })
        
        contextMetadata = enhancedContext.metadata
        
        // Combine enhanced context with web search results and new user message
        if (webSearchResults && webSearchResults.results.length > 0) {
          // Include web search results in enhanced context
          const searchContext = `Web search results for "${userPrompt}":
${webSearchResults.answer ? `Summary: ${webSearchResults.answer}\n\n` : ''}
${webSearchResults.results.map((r, i) => 
  `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content.substring(0, 200)}...\n`
).join('\n')}

Based on these search results and the conversation context, please provide an informed response.`

          finalMessages = [
            ...enhancedContext.messages,
            { role: 'system', content: searchContext },
            { role: 'user', content: userPrompt }
          ]
          log.info('Web search integrated with enhanced context', { resultCount: webSearchResults.results.length })
        } else {
          finalMessages = [
            ...enhancedContext.messages,
            { role: 'user', content: userPrompt }
          ]
        }
        
        log.info('Enhanced context built successfully', { 
          tokens: enhancedContext.metadata.totalTokens, 
          siblings: enhancedContext.metadata.siblingCount, 
          references: referencedNodes.length 
        })
        
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
        log.warn('Enhanced context failed, falling back to simple messages', contextError)
        // Keep original messages as fallback
      }
    } else {
      log.debug('Enhanced context skipped', { useEnhancedContext, parentNodeId })
    }

    // Initialize OpenRouter client and create completion with timeout and retry
    const client = new OpenRouterClient()
    const aiTimer = performanceMonitor.startTimer('openrouter_api')
    
    // High-performance and reasoning models need more time (2-4 minutes typical)
    const timeoutMs = (() => {
      if (model === 'x-ai/grok-4') return 150000 // 2.5 minutes for Grok-4
      if (model.startsWith('openai/o1') || model.includes('gpt-5')) return 120000 // 2 minutes for GPT-5 models
      if (model.includes('gemini-2.5-pro') || model.includes('gemini-pro-1.5')) return 120000 // 2 minutes for Gemini Pro models
      return 30000 // 30 seconds for standard models
    })()
    
    // Set model-specific max_tokens for optimal output length
    const getOptimalMaxTokens = (modelId: string, userMaxTokens: number): number => {
      // For reasoning and high-performance models, allow more tokens for complete responses
      if (modelId === 'x-ai/grok-4') return Math.max(userMaxTokens, 6000)
      if (modelId.includes('gpt-5') || modelId.startsWith('openai/o1')) return Math.max(userMaxTokens, 5000)
      if (modelId.includes('gemini-2.5-pro') || modelId.includes('gemini-pro-1.5')) return Math.max(userMaxTokens, 5000)
      
      // For high-context models, use generous limits
      if (modelId.includes('claude-opus')) return Math.max(userMaxTokens, 5000)
      
      // For other models, ensure minimum for complete responses
      return Math.max(userMaxTokens, 4000)
    }
    
    const optimalMaxTokens = getOptimalMaxTokens(model, maxTokens)
    
    // Build request with optional reasoning configuration
    const requestParams: any = {
      model: model as ModelId,
      messages: finalMessages,
      temperature,
      max_tokens: optimalMaxTokens,
      stream: false,
    }

    // Add reasoning configuration if enabled and model supports it
    if (reasoning && supportsReasoning(model as ModelId)) {
      requestParams.reasoning = getReasoningConfig(model as ModelId)
    }

    // Debug log for reasoning
    if (reasoning) {
      const reasoningConfig = supportsReasoning(model as ModelId) ? getReasoningConfig(model as ModelId) : null
      console.log('🧠 Reasoning request debug (chat API):', {
        model,
        reasoning,
        supportsReasoning: supportsReasoning(model as ModelId),
        reasoningEnabled: reasoning && supportsReasoning(model as ModelId),
        reasoningConfig,
        requestHasReasoning: 'reasoning' in requestParams
      })
    }

    const response = await withTimeout(
      withRetry(async () => {
        return await client.createChatCompletion(requestParams)
      }, { maxAttempts: 2 }),
      timeoutMs,
      'OpenRouter API call'
    )
    
    aiTimer()

    const responseContent = response.choices[0]?.message?.content || ''
    const usage = response.usage

    // Update chat node with response using pooled connection with retry
    await withRetry(async () => {
      await updateChatNodeResponse(chatNode.id, responseContent, usage, model)
    }, { maxAttempts: 3 })

    // Track token usage for billing
    if (usage) {
      const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
      await trackTokenUsage({
        userId,
        tokensUsed: totalTokens,
        modelId: model,
        sessionId,
        nodeId: chatNode.id
      }).catch(error => {
        log.warn('Failed to track token usage', error)
      })
    }
    
    // Generate AI title for the session if it's the first node (depth = 0 and no parentNodeId)
    log.info('Title generation check', { 
      parentNodeId, 
      depth: chatNode.depth, 
      shouldGenerateTitle: !parentNodeId && chatNode.depth === 0 
    })
    
    if (!parentNodeId && chatNode.depth === 0) {
      try {
        log.info('Generating AI title for session', { sessionId, userPrompt: userPrompt.substring(0, 50) })
        
        // Generate title based on user's message and AI's response
        const titleResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sessions/generate-title`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userMessage: userPrompt,
            assistantResponse: responseContent.substring(0, 500) // Send first 500 chars of response
          })
        })

        if (titleResponse.ok) {
          const { title } = await titleResponse.json()
          log.info('AI title generated', { title })
          
          // Update session name with AI-generated title
          const supabase = createClient()
          const { data: updatedSession, error: updateError } = await supabase
            .from('sessions')
            .update({ 
              name: title,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .select('id, name')
            .single()
          
          if (updateError) {
            log.error('Failed to update session name in database', updateError)
          } else {
            log.info('Successfully updated session title', { title, verified: updatedSession?.name })
            
            // Force clear all related caches
            try {
              const { clearQueryCache } = await import('@/lib/db/query-optimizer')
              clearQueryCache()
              log.debug('Cleared query cache to force fresh data')
            } catch (error) {
              log.warn('Failed to clear query cache', error)
            }
          }
        } else {
          log.error('Title generation API failed', { 
            status: titleResponse.status, 
            statusText: titleResponse.statusText 
          })
          const errorText = await titleResponse.text().catch(() => 'Unknown error')
          log.error('Title generation error details', { errorText })
        }
      } catch (error) {
        log.error('Failed to generate AI title - exception', error)
        // Don't throw - this is a non-critical feature
      }
    }

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

  } catch (error) {
    log.error('Background AI processing failed', error)
    // Update node status to failed
    await updateChatNodeResponse(chatNode.id, '', undefined, model, 'failed', error instanceof Error ? error.message : 'Unknown error').catch(err => log.error('Failed to update node status to failed', err))
    
    // Record error for monitoring
    recordError(createAppError(
      'Background AI processing failed',
      ErrorCategory.EXTERNAL_API,
      {
        context: { chatNodeId: chatNode.id, sessionId },
        cause: error as Error,
        severity: 'high' as any
      }
    ))
  }
}

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
  let { 
    messages, 
    model, 
    temperature, 
    max_tokens,
    sessionId,
    parentNodeId,
    useEnhancedContext = true,
    enableWebSearch = true,
    reasoning = false
  } = body

  // Check if user can access advanced models
  const hasAdvancedAccess = await canUseAdvancedModels(user.id)
  const advancedModels = ['openai/gpt-5', 'anthropic/claude-opus-4.1', 'anthropic/claude-opus-4', 'x-ai/grok-4']
  
  if (advancedModels.includes(model) && !hasAdvancedAccess) {
    return NextResponse.json(
      { error: 'Advanced models require a Pro or Enterprise subscription. Please upgrade your plan.' },
      { status: 403 }
    )
  }

  // Estimate token usage for quota check  
  const estimatedTokens = estimateTokens(messages[messages.length - 1]?.content || '') + (max_tokens || 4000)
  
  // Check user quota before processing
  const quotaCheck = await checkUserQuota(user.id, estimatedTokens)
  if (!quotaCheck.allowed) {
    const quotaExceededMessage = quotaCheck.limit === -1 
      ? 'An error occurred while checking your usage quota.'
      : `Monthly token limit reached (${quotaCheck.currentUsage.toLocaleString()}/${quotaCheck.limit.toLocaleString()}). Please upgrade your plan or wait for next month's reset.`
    
    return NextResponse.json(
      { 
        error: quotaExceededMessage,
        quota: {
          used: quotaCheck.currentUsage,
          limit: quotaCheck.limit,
          plan: quotaCheck.planId
        }
      },
      { status: 429 }
    )
  }

  // Fetch user profile for defaults if not provided
  if (temperature === undefined || max_tokens === undefined) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('default_temperature, default_max_tokens')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        if (temperature === undefined) {
          temperature = profile.default_temperature || 0.7
        }
        if (max_tokens === undefined) {
          max_tokens = profile.default_max_tokens || 4000
        }
      } else {
        // Fallback defaults if no profile exists
        temperature = temperature || 0.7
        max_tokens = max_tokens || 4000
      }
    } catch (error) {
      log.warn('Failed to fetch user profile for defaults', error)
      // Use fallback defaults
      temperature = temperature || 0.7
      max_tokens = max_tokens || 4000
    }
  }

  // Increase max_tokens for reasoning requests to accommodate longer thought processes
  if (reasoning && supportsReasoning(model as ModelId)) {
    const currentMaxTokens = max_tokens || 4000
    // Double the max_tokens for reasoning, with a minimum of 8000
    max_tokens = Math.max(currentMaxTokens * 2, 8000)
    log.debug('Increased max_tokens for reasoning', { 
      originalMaxTokens: currentMaxTokens, 
      reasoningMaxTokens: max_tokens,
      model 
    })
  }

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
      log.warn('Failed to get parent depth, using 0', error)
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
      metadata: {
        reasoning: reasoning && supportsReasoning(model as ModelId),
        functionCalling: false,  // Normal chat API doesn't use function calling
        enableWebSearch: false
      }
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

  // Return node immediately for instant UI feedback (async processing continues)
  const immediateResponse = NextResponse.json({
    success: true,
    data: {
      id: chatNode.id,
      content: null, // Will be updated via background processing
      status: 'streaming',
      node: chatNode
    }
  })

  // Continue processing AI response in background without blocking UI
  processAIResponseInBackground(
    chatNode, 
    messages, 
    model, 
    temperature, 
    max_tokens, 
    sessionId, 
    parentNodeId, 
    useEnhancedContext, 
    userPrompt,
    enableWebSearch,
    reasoning,
    user.id
  ).catch(error => {
    log.error('Background AI processing failed', error)
    // Update node status to failed
    updateChatNodeResponse(chatNode.id, '', undefined, model, 'failed', error.message).catch(err => log.error('Failed to update node status to failed', err))
  })

  return immediateResponse
  } finally {
    stopTimer()
  }
})


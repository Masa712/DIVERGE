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
import { log } from '@/lib/utils/logger'
import { tavilyClient } from '@/lib/tavily'

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
  enableWebSearch: boolean = true
) {
  try {
    // Build context using enhanced context system if enabled and parentNodeId exists
    let finalMessages = messages
    let contextMetadata = null
    let webSearchResults = null
    
    // Check if web search should be performed
    log.info('Web search evaluation', { 
      enableWebSearch, 
      tavilyConfigured: tavilyClient.isConfigured(),
      userPrompt: userPrompt.substring(0, 100) + '...'
    })
    
    if (enableWebSearch && tavilyClient.isConfigured()) {
      // Keywords that typically indicate need for current information (English and Japanese)
      const searchKeywords = [
        // English keywords
        'latest', 'current', 'today', 'now', 'recent', 'news', 
        'update', '2024', '2025', 'what is happening', 'real-time',
        'price', 'weather', 'score', 'result',
        // Japanese keywords
        '最新', '現在', '今日', '今', '最近', 'ニュース', 'ニューズ',
        'アップデート', '更新', '何が起きて', 'リアルタイム',
        '価格', '値段', '天気', '天候', 'スコア', '結果', '情報'
      ]
      
      const needsSearch = searchKeywords.some(keyword => 
        userPrompt.toLowerCase().includes(keyword)
      ) || userPrompt.includes('?')
      
      log.info('Web search decision', { needsSearch, hasQuestion: userPrompt.includes('?') })
      
      if (needsSearch) {
        try {
          log.info('Performing web search for query', { query: userPrompt })
          const searchResults = await tavilyClient.search(userPrompt, {
            maxResults: 3,
            includeAnswer: true,
            searchDepth: 'basic'
          })
          
          if (searchResults && searchResults.results.length > 0) {
            webSearchResults = searchResults
            
            // Add search context to messages
            const searchContext = `Web search results for "${userPrompt}":
${searchResults.answer ? `Summary: ${searchResults.answer}\n\n` : ''}
${searchResults.results.map((r, i) => 
  `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content.substring(0, 200)}...\n`
).join('\n')}

Based on these search results, please provide an informed response.`
            
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
    )
    
    aiTimer()

    const responseContent = response.choices[0]?.message?.content || ''
    const usage = response.usage

    // Update chat node with response using pooled connection with retry
    await withRetry(async () => {
      await updateChatNodeResponse(chatNode.id, responseContent, usage, model)
    }, { maxAttempts: 3 })
    
    // Generate AI title for the session if it's the first node (depth = 0 and no parentNodeId)
    if (!parentNodeId && chatNode.depth === 0) {
      try {
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
            log.error('Failed to update session name', updateError)
          } else {
            log.info('Updated session title', { title, verified: updatedSession?.name })
            
            // Force clear all related caches
            try {
              const { clearQueryCache } = await import('@/lib/db/query-optimizer')
              clearQueryCache()
              log.debug('Cleared query cache to force fresh data')
            } catch (error) {
              log.warn('Failed to clear query cache', error)
            }
          }
        }
      } catch (error) {
        log.error('Failed to generate AI title', error)
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
    enableWebSearch = true
  } = body

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
    enableWebSearch
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


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
import { 
  webSearchTool, 
  parseFunctionArguments, 
  createToolResultMessage 
} from '@/lib/openrouter/function-calling'
import { generateUserSystemPrompt } from '@/lib/db/system-prompt-preferences'

// Process AI response with Function Calling support
async function processAIResponseWithTools(
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
  userId?: string
) {
  try {
    // Build context using enhanced context system if enabled and parentNodeId exists
    let finalMessages = messages
    let contextMetadata = null
    
    // Generate personalized system prompt for the user
    const systemPromptContent = userId 
      ? await generateUserSystemPrompt(userId)
      : `Today's date is ${new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}, ${new Date().getFullYear()}. The current year is ${new Date().getFullYear()}, not 2024.`
    
    const systemPrompt = {
      role: 'system' as const,
      content: systemPromptContent
    }
    
    // Inject system prompt at the beginning of messages
    finalMessages = [systemPrompt, ...messages]
    
    // Enhanced context evaluation
    log.debug('Enhanced context evaluation', { useEnhancedContext, hasParent: !!parentNodeId })
    
    if (useEnhancedContext && parentNodeId) {
      try {
        log.debug('Building enhanced context', { parentNodeId })
        
        // Extract node references from user prompt
        const referencedNodes = extractNodeReferences(userPrompt)
        
        // Build enhanced context with intelligent strategy selection
        const enhancedContext = await buildContextWithStrategy(parentNodeId, userPrompt, {
          includeSiblings: false,
          maxTokens: 3000,
          includeReferences: referencedNodes,
          model: model
        })
        
        contextMetadata = enhancedContext.metadata
        
        // Use enhanced context messages plus new user message with system prompt
        finalMessages = [
          systemPrompt,  // Always include personalized system prompt
          ...enhancedContext.messages,
          { role: 'user', content: userPrompt }
        ]
        
        log.info('Enhanced context built successfully', { 
          tokens: enhancedContext.metadata.totalTokens, 
          siblings: enhancedContext.metadata.siblingCount, 
          references: referencedNodes.length 
        })
        
      } catch (contextError) {
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
      }
    } else {
      log.debug('Enhanced context skipped', { useEnhancedContext, parentNodeId })
    }

    // Initialize OpenRouter client
    const client = new OpenRouterClient()
    const aiTimer = performanceMonitor.startTimer('openrouter_api_with_tools')
    
    // Determine if we should include tools based on web search setting and model support
    // All models support Function Calling except GPT OSS 120B
    const shouldUseTools = enableWebSearch && tavilyClient.isConfigured() && 
      model !== 'openai/gpt-oss-120b'
    
    log.info('Function calling evaluation', { 
      shouldUseTools, 
      model, 
      enableWebSearch,
      tavilyConfigured: tavilyClient.isConfigured() 
    })
    
    // Prepare request with or without tools
    const requestBody: any = {
      model: model as ModelId,
      messages: finalMessages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    }
    
    if (shouldUseTools) {
      requestBody.tools = [webSearchTool]
      requestBody.tool_choice = 'auto'  // Let the model decide when to use tools
    }
    
    // Model-specific timeout settings
    const timeoutMs = (() => {
      if (model === 'x-ai/grok-4') return 150000
      if (model.startsWith('openai/o1') || model.includes('gpt-5')) return 120000
      if (model.includes('gemini-2.5-pro') || model.includes('gemini-pro-1.5')) return 120000
      return 30000
    })()
    
    // First API call - may include tool calls
    const response = await withTimeout(
      withRetry(async () => {
        return await client.createChatCompletion(requestBody)
      }, { maxAttempts: 2 }),
      timeoutMs,
      'OpenRouter API call with tools'
    )
    
    // Check if the model wants to use tools
    const message = response.choices[0]?.message
    
    if (message?.tool_calls && message.tool_calls.length > 0) {
      log.info('Model requested tool calls', { count: message.tool_calls.length })
      
      // Process tool calls
      const toolMessages = []
      
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'web_search') {
          try {
            const args = parseFunctionArguments(toolCall.function.arguments)
            log.info('Executing web search', { query: args.query, type: args.search_type })
            
            const searchResults = await tavilyClient.search(args.query, {
              maxResults: 5,  // More results for function calling
              includeAnswer: true,
              searchDepth: args.search_type === 'news' ? 'advanced' : 'basic'
            })
            
            // Format search results for the model
            const formattedResults = {
              query: args.query,
              answer: searchResults.answer,
              results: searchResults.results.map(r => ({
                title: r.title,
                url: r.url,
                content: r.content.substring(0, 300)
              }))
            }
            
            toolMessages.push(createToolResultMessage(toolCall.id, formattedResults))
            log.info('Web search completed', { resultCount: searchResults.results.length })
            
          } catch (searchError) {
            log.error('Tool execution failed', searchError)
            toolMessages.push(createToolResultMessage(
              toolCall.id,
              `Search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`
            ))
          }
        }
      }
      
      // Continue conversation with tool results
      const continuationMessages = [
        ...finalMessages,
        {
          ...message,
          role: 'assistant' as const
        },
        ...toolMessages
      ]
      
      log.info('Sending tool results back to model')
      
      // Second API call with tool results
      const finalResponse = await withTimeout(
        withRetry(async () => {
          return await client.createChatCompletion({
            model: model as ModelId,
            messages: continuationMessages,
            temperature,
            max_tokens: maxTokens,
            stream: false
          })
        }, { maxAttempts: 2 }),
        timeoutMs,
        'OpenRouter final response with tool results'
      )
      
      aiTimer()
      
      const responseContent = finalResponse.choices[0]?.message?.content || ''
      const usage = finalResponse.usage
      
      // Update chat node with response
      await withRetry(async () => {
        await updateChatNodeResponse(chatNode.id, responseContent, usage, model)
      }, { maxAttempts: 3 })
      
      // Handle AI title generation for first node
      if (!parentNodeId && chatNode.depth === 0) {
        await generateAITitle(sessionId, userPrompt, responseContent)
      }
      
      // Clear caches
      await clearCaches(sessionId, chatNode, responseContent)
      
    } else {
      // No tool calls - regular response
      aiTimer()
      
      const responseContent = message?.content || ''
      const usage = response.usage
      
      // Update chat node with response
      await withRetry(async () => {
        await updateChatNodeResponse(chatNode.id, responseContent, usage, model)
      }, { maxAttempts: 3 })
      
      // Handle AI title generation for first node
      if (!parentNodeId && chatNode.depth === 0) {
        await generateAITitle(sessionId, userPrompt, responseContent)
      }
      
      // Clear caches
      await clearCaches(sessionId, chatNode, responseContent)
    }
    
  } catch (error) {
    log.error('Background AI processing with tools failed', error)
    await updateChatNodeResponse(
      chatNode.id, 
      '', 
      undefined, 
      model, 
      'failed', 
      error instanceof Error ? error.message : 'Unknown error'
    ).catch(err => log.error('Failed to update node status to failed', err))
    
    recordError(createAppError(
      'Background AI processing with tools failed',
      ErrorCategory.EXTERNAL_API,
      {
        context: { chatNodeId: chatNode.id, sessionId },
        cause: error as Error,
        severity: 'high' as any
      }
    ))
  }
}

// Helper function to generate AI title
async function generateAITitle(sessionId: string, userPrompt: string, responseContent: string) {
  try {
    const titleResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sessions/generate-title`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userMessage: userPrompt,
        assistantResponse: responseContent.substring(0, 500)
      })
    })

    if (titleResponse.ok) {
      const { title } = await titleResponse.json()
      
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
  }
}

// Helper function to clear caches
async function clearCaches(sessionId: string, chatNode: any, responseContent: string) {
  const redisIsAvailable = await isRedisAvailable()
  if (redisIsAvailable) {
    const redisCache = getRedisEnhancedContextCache()
    await redisCache.clearSessionCache(sessionId)
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
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const stopTimer = performanceMonitor.startTimer('chat_api_with_tools_total')
  
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
          temperature = temperature || 0.7
          max_tokens = max_tokens || 4000
        }
      } catch (error) {
        log.warn('Failed to fetch user profile for defaults', error)
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

    // Calculate depth for the new node
    let depth = 0
    if (parentNodeId) {
      try {
        depth = await withRetry(async () => {
          const parentDepth = await getParentNodeDepth(parentNodeId)
          return parentDepth + 1
        }, { maxAttempts: 2 })
      } catch (error) {
        log.warn('Failed to get parent depth, using 0', error)
        recordError(createAppError(
          'Failed to retrieve parent node depth',
          classifyDatabaseError(error),
          { context: { parentNodeId }, cause: error as Error }
        ))
      }
    }

    // Create a new chat node
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

    // Return node immediately for instant UI feedback
    const immediateResponse = NextResponse.json({
      success: true,
      data: {
        id: chatNode.id,
        content: null,
        status: 'streaming',
        node: chatNode
      }
    })

    // Continue processing AI response with tools in background
    processAIResponseWithTools(
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
      user.id  // Pass user ID for personalized system prompt
    ).catch(error => {
      log.error('Background AI processing with tools failed', error)
      updateChatNodeResponse(chatNode.id, '', undefined, model, 'failed', error.message)
        .catch(err => log.error('Failed to update node status to failed', err))
    })

    return immediateResponse
  } finally {
    stopTimer()
  }
})
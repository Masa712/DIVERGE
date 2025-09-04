import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient, supportsReasoning, getReasoningConfig } from '@/lib/openrouter/client'
import { createClient } from '@/lib/supabase/server'
import { ModelId, AVAILABLE_MODELS } from '@/types'
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
  withRetry,
  AppError
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
  max_tokens: number,
  sessionId: string,
  parentNodeId: string | null,
  useEnhancedContext: boolean,
  userPrompt: string,
  enableWebSearch: boolean,
  userId: string,
  reasoning: boolean = false
) {
  const stopTimer = performanceMonitor.startTimer('chat_ai_response_with_tools')
  
  try {
    // Parse and validate model
    if (!AVAILABLE_MODELS.find(m => m.id === model)) {
      throw createAppError(
        'Invalid model selection',
        ErrorCategory.VALIDATION,
        { 
          userMessage: 'Please select a valid model.', 
          context: { model } 
        }
      )
    }

    // Check if we should use enhanced context and have parentNodeId
    let enhancedContext = null
    if (useEnhancedContext && parentNodeId) {
      log.debug('Enhanced context evaluation', { useEnhancedContext, hasParent: !!parentNodeId })
      
      try {
        // Build enhanced context using the parent node
        const contextResult = await withRetry(async () => {
          return await buildContextWithStrategy(parentNodeId, userPrompt, {
            maxTokens: 2000,
            model: model,
            includeSiblings: false
          })
        }, { maxAttempts: 2 })
        
        // Convert context messages to a single enhanced prompt
        enhancedContext = contextResult.messages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n\n') + `\n\nUser: ${userPrompt}`
          
        log.debug('Enhanced context built', { contextLength: enhancedContext?.length || 0 })
      } catch (contextError) {
        log.warn('Failed to build enhanced context', contextError)
        recordError(createAppError(
          'Enhanced context generation failed',
          ErrorCategory.EXTERNAL_API,
          { cause: contextError as Error }
        ))
      }
    } else {
      log.debug('Enhanced context skipped', { useEnhancedContext })
    }

    // Check if we should use function calling
    // Use tools when web search is explicitly enabled by user (not dependent on keywords)
    const shouldUseTools = enableWebSearch
    
    log.info('Function calling evaluation', { 
      shouldUseTools, 
      model, 
      enableWebSearch,
      tavilyConfigured: !!process.env.TAVILY_API_KEY
    })

    // Use tools if detected or fallback to normal chat
    let openRouterClient: OpenRouterClient
    let finalContent = ''
    
    if (shouldUseTools) {
      // Initialize Tavily for web search
      if (!process.env.TAVILY_API_KEY) {
        throw createAppError(
          'Tavily API key not configured',
          ErrorCategory.EXTERNAL_API
        )
      }

      openRouterClient = new OpenRouterClient()

      // Build the request body for function calling
      const requestBody: any = {
        model,
        messages: enhancedContext ? [...messages.slice(0, -1), { role: 'user', content: enhancedContext }] : messages,
        temperature,
        max_tokens,
        tools: [
          {
            type: 'function',
            function: {
              name: 'tavily_search_results_json',
              description: 'A search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events. Input should be a search query.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search query to execute'
                  }
                },
                required: ['query']
              }
            }
          }
        ],
        tool_choice: 'auto'
      }

      // Add reasoning configuration if enabled and model supports it
      if (reasoning && supportsReasoning(model as ModelId)) {
        requestBody.reasoning = getReasoningConfig(model as ModelId)
      }
      
      // Debug log for reasoning
      if (reasoning) {
        const reasoningConfig = supportsReasoning(model as ModelId) ? getReasoningConfig(model as ModelId) : null
        console.log('🧠 Reasoning request debug (with-tools API):', {
          model,
          reasoning,
          shouldUseTools,
          supportsReasoning: supportsReasoning(model as ModelId),
          reasoningEnabled: reasoning && supportsReasoning(model as ModelId),
          reasoningConfig,
          requestHasReasoning: 'reasoning' in requestBody
        })
      }

      try {
        const response = await openRouterClient.createChatCompletion(requestBody)
        
        // Handle function calls
        if (response.choices?.[0]?.message?.tool_calls) {
          const toolCalls = response.choices[0].message.tool_calls
          const toolResults = []

          for (const toolCall of toolCalls) {
            if (toolCall.function.name === 'tavily_search_results_json') {
              try {
                const searchQuery = JSON.parse(toolCall.function.arguments).query
                log.info('Executing web search', { query: searchQuery })
                
                const searchResults = await tavilyClient.search(searchQuery, { maxResults: 5 })
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: JSON.stringify(searchResults)
                })
                
                log.debug('Web search completed', { resultsCount: searchResults?.results?.length || 0 })
              } catch (searchError) {
                log.error('Web search failed', searchError)
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: JSON.stringify({ error: 'Search failed', message: 'Unable to perform web search' })
                })
              }
            }
          }

          if (toolResults.length > 0) {
            // Make a second call with the tool results
            const followUpMessages = [
              ...messages,
              response.choices[0].message,
              ...toolResults
            ]

            const followUpBody: any = {
              model,
              messages: followUpMessages,
              temperature,
              max_tokens
            }

            // Add reasoning to follow-up request as well if enabled
            if (reasoning && supportsReasoning(model as ModelId)) {
              followUpBody.reasoning = getReasoningConfig(model as ModelId)
            }

            const finalResponse = await openRouterClient.createChatCompletion(followUpBody)
            
            finalContent = finalResponse.choices?.[0]?.message?.content || ''
            const usage = finalResponse.usage || { prompt_tokens: 0, completion_tokens: 0 }

            // Update the chat node with final response
            await updateChatNodeResponse(
              chatNode.id,
              finalContent,
              usage,
              model,
              'completed'
            )

            log.info('Function calling completed successfully', { 
              nodeId: chatNode.id,
              toolCallsCount: toolCalls.length,
              finalResponseLength: finalContent.length
            })
          }
        } else {
          // No function calls, treat as regular response
          finalContent = response.choices?.[0]?.message?.content || ''
          const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 }

          await updateChatNodeResponse(
            chatNode.id,
            finalContent,
            usage,
            model,
            'completed'
          )

          log.info('Direct response completed', { 
            nodeId: chatNode.id,
            responseLength: finalContent.length 
          })
        }

      } catch (error) {
        log.error('Function calling request failed', error)
        throw error
      }

    } else {
      // Fallback to normal chat without tools
      log.info('Using normal chat API (no tools)')
      
      openRouterClient = new OpenRouterClient()

      const requestBody: any = {
        model,
        messages: enhancedContext ? [...messages.slice(0, -1), { role: 'user', content: enhancedContext }] : messages,
        temperature,
        max_tokens
      }

      // Add reasoning configuration if enabled and model supports it
      if (reasoning && supportsReasoning(model as ModelId)) {
        requestBody.reasoning = getReasoningConfig(model as ModelId)
      }
      
      // Debug log for reasoning
      if (reasoning) {
        const reasoningConfig = supportsReasoning(model as ModelId) ? getReasoningConfig(model as ModelId) : null
        console.log('🧠 Reasoning request debug (with-tools API fallback):', {
          model,
          reasoning,
          shouldUseTools,
          supportsReasoning: supportsReasoning(model as ModelId),
          reasoningEnabled: reasoning && supportsReasoning(model as ModelId),
          reasoningConfig,
          requestHasReasoning: 'reasoning' in requestBody
        })
      }

      const response = await openRouterClient.createChatCompletion(requestBody)
      
      finalContent = response.choices?.[0]?.message?.content || ''
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 }

      await updateChatNodeResponse(
        chatNode.id,
        finalContent,
        usage,
        model,
        'completed'
      )

      log.info('Normal chat completed', { 
        nodeId: chatNode.id,
        responseLength: finalContent.length 
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
            assistantResponse: finalContent.substring(0, 500) // Send first 500 chars of response
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

  } catch (error) {
    log.error('AI response processing failed', error)
    
    const appError = createAppError(
      'AI request processing failed',
      ErrorCategory.EXTERNAL_API,
      {
        userMessage: 'Unable to generate AI response. Please try again.',
        context: { model, nodeId: chatNode.id },
        cause: error as Error
      }
    )
    
    recordError(appError)
    
    // Update node with error status
    await updateChatNodeResponse(
      chatNode.id,
      '',
      undefined,
      model,
      'failed',
      appError.message
    ).catch(err => {
      log.error('Failed to update node error status', err)
    })
    
    throw appError
  } finally {
    stopTimer()
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
      enableWebSearch = true,
      reasoning = false
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
        metadata: {
          reasoning: reasoning && supportsReasoning(model as ModelId),
          functionCalling: enableWebSearch,
          enableWebSearch: enableWebSearch
        } as Record<string, any>
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
      user.id,  // Pass user ID for personalized system prompt
      reasoning // Pass reasoning parameter
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
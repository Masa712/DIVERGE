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
  createAppError,
  ErrorCategory,
  classifyDatabaseError,
  withRetry,
} from '@/lib/errors/error-handler'
import { recordError } from '@/lib/errors/error-monitoring'
import { performanceMonitor } from '@/lib/utils/performance-optimizer'
import { log } from '@/lib/utils/logger'
import { tavilyClient } from '@/lib/tavily'
import {
  canUseWebSearch,
  trackWebSearchUsage,
  getUserPlan,
  canUseAdvancedModels,
  checkUserQuota,
  trackTokenUsage,
  estimateTokens
} from '@/lib/billing/usage-tracker'
import { estimateCostUsd, formatCreditUsage } from '@/lib/billing/cost-calculator'
import {
  isModelAvailableForFreePlan,
  isAdvancedModel,
  getModelAccessErrorMessage
} from '@/lib/billing/model-restrictions'

// Helper function to clear caches after completion
async function clearCaches(sessionId: string, chatNode: any, responseContent: string) {
  try {
    const redisIsAvailable = await isRedisAvailable()
    if (redisIsAvailable) {
      const redisCache = getRedisEnhancedContextCache()
      await redisCache.clearSessionCache(sessionId)
      await redisCache.addNode(sessionId, {
        ...chatNode,
        response: responseContent,
        status: 'completed',
        createdAt: chatNode.createdAt instanceof Date ? chatNode.createdAt.toISOString() : chatNode.createdAt,
        updatedAt: chatNode.updatedAt instanceof Date ? chatNode.updatedAt.toISOString() : chatNode.updatedAt,
      })
    } else {
      await clearSessionCache(sessionId)
    }
  } catch (error) {
    log.warn('Failed to clear caches', error)
  }
}

export async function POST(request: NextRequest) {
  const stopTimer = performanceMonitor.startTimer('chat_api_with_tools_total')

  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
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

    // Check model access based on user's plan
    const userPlan = await getUserPlan(user.id)

    if (userPlan === 'free') {
      const isAllowed = isModelAvailableForFreePlan(model)
      if (!isAllowed) {
        log.warn('Model access denied for free plan (with-tools)', { model, userPlan })
        return NextResponse.json(
          { error: getModelAccessErrorMessage('free', model) },
          { status: 403 }
        )
      }
    }

    if (isAdvancedModel(model)) {
      const hasAdvancedAccess = await canUseAdvancedModels(user.id)
      if (!hasAdvancedAccess) {
        return NextResponse.json(
          { error: getModelAccessErrorMessage(userPlan, model) },
          { status: 403 }
        )
      }
    }

    // Cost-based quota check
    const estimatedInputTokens = estimateTokens(messages[messages.length - 1]?.content || '')
    const estimatedCost = estimateCostUsd(model, estimatedInputTokens, max_tokens || 4000)
    const quotaCheck = await checkUserQuota(user.id, estimatedCost)
    if (!quotaCheck.allowed) {
      const quotaExceededMessage = quotaCheck.costLimit === -1
        ? 'Usage limit exceeded. Please contact support.'
        : `Monthly credit limit reached (${formatCreditUsage(quotaCheck.currentCostUsed, quotaCheck.costLimit)} credits). Please upgrade your plan or wait for next month's reset.`
      return NextResponse.json(
        {
          error: quotaExceededMessage,
          quota: {
            costUsed: quotaCheck.currentCostUsed,
            costLimit: quotaCheck.costLimit,
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
          if (temperature === undefined) temperature = profile.default_temperature || 0.7
          if (max_tokens === undefined) max_tokens = profile.default_max_tokens || 4000
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

    // Increase max_tokens for reasoning requests
    if (reasoning && supportsReasoning(model as ModelId)) {
      const currentMaxTokens = max_tokens || 4000
      max_tokens = Math.max(currentMaxTokens * 2, 8000)
      log.debug('Increased max_tokens for reasoning', {
        originalMaxTokens: currentMaxTokens,
        reasoningMaxTokens: max_tokens,
        model
      })
    }

    if (!messages || !model) {
      return NextResponse.json(
        { error: 'Messages and model parameters are required' },
        { status: 400 }
      )
    }

    // Validate model
    if (!AVAILABLE_MODELS.find(m => m.id === model)) {
      return NextResponse.json(
        { error: 'Invalid model selection' },
        { status: 400 }
      )
    }

    const userPrompt = messages[messages.length - 1]?.content || ''

    // Calculate depth
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

    // Create chat node in DB
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
          enableWebSearch
        }
      })
    }, { maxAttempts: 3 })

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

    // Return SSE stream
    const encoder = new TextEncoder()
    const userId = user.id

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          // 1. Send initial node data for immediate UI display
          sendEvent({ type: 'node', node: chatNode })

          // 2. Build enhanced context
          let enhancedContext: string | null = null
          if (useEnhancedContext && parentNodeId) {
            try {
              const referencedNodes = extractNodeReferences(userPrompt)
              const contextResult = await withRetry(async () => {
                return await buildContextWithStrategy(parentNodeId, userPrompt, {
                  maxTokens: 8000,
                  model,
                  includeSiblings: false,
                  includeReferences: referencedNodes
                })
              }, { maxAttempts: 2 })

              enhancedContext = contextResult.messages
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n\n') + `\n\nUser: ${userPrompt}`

              log.debug('Enhanced context built', {
                contextLength: enhancedContext.length,
                referencedNodes: referencedNodes.length
              })
            } catch (contextError) {
              log.warn('Enhanced context failed, falling back to simple messages', contextError)
              recordError(createAppError(
                'Enhanced context generation failed',
                ErrorCategory.EXTERNAL_API,
                { cause: contextError as Error }
              ))
            }
          }

          // 3. Determine if we should use tools
          const shouldUseTools = enableWebSearch
          const openRouterClient = new OpenRouterClient()
          let finalMessages = [...messages]
          let responseText = ''
          let tokenCount = 0

          if (shouldUseTools) {
            // Tool calling: first non-streaming call for tool detection
            const currentDate = new Date().toISOString().split('T')[0]
            const messagesWithDateContext = enhancedContext
              ? [
                  { role: 'system', content: `Current date: ${currentDate}. Use this as reference for time-related queries.` },
                  ...messages.slice(0, -1),
                  { role: 'user', content: enhancedContext }
                ]
              : [
                  { role: 'system', content: `Current date: ${currentDate}. Use this as reference for time-related queries.` },
                  ...messages
                ]

            const toolRequestBody: any = {
              model,
              messages: messagesWithDateContext,
              temperature,
              max_tokens,
              tools: [{
                type: 'function',
                function: {
                  name: 'tavily_search_results_json',
                  description: `A search engine optimized for comprehensive, accurate, and trusted results. IMPORTANT: Current date is ${currentDate}.`,
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: `The search query to execute. Use current date ${currentDate} as reference.`
                      }
                    },
                    required: ['query']
                  }
                }
              }],
              tool_choice: 'auto'
            }

            if (reasoning && supportsReasoning(model as ModelId)) {
              toolRequestBody.reasoning = getReasoningConfig(model as ModelId)
            }

            const toolResponse = await openRouterClient.createChatCompletion(toolRequestBody)

            if (toolResponse.choices?.[0]?.message?.tool_calls) {
              const toolCalls = toolResponse.choices[0].message.tool_calls
              const toolResults: any[] = []

              for (const toolCall of toolCalls) {
                if (toolCall.function.name === 'tavily_search_results_json') {
                  try {
                    const searchQuery = JSON.parse(toolCall.function.arguments).query

                    const webQuotaCheck = await canUseWebSearch(userId)
                    if (!webQuotaCheck.allowed) {
                      sendEvent({
                        type: 'search_quota_exceeded',
                        id: chatNode.id,
                        message: `Web search limit reached (${webQuotaCheck.currentUsage}/${webQuotaCheck.limit}).`
                      })
                      toolResults.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        content: JSON.stringify({ error: 'Quota exceeded' })
                      })
                      continue
                    }

                    sendEvent({ type: 'search_start', id: chatNode.id, query: searchQuery })

                    const searchResults = await tavilyClient.search(searchQuery, { maxResults: 5 })
                    await trackWebSearchUsage(userId)

                    sendEvent({ type: 'search_results', id: chatNode.id, results: searchResults })

                    const enhancedSearchResults = {
                      ...searchResults,
                      search_metadata: {
                        query: searchQuery,
                        search_date: currentDate,
                        note: `These search results are from ${currentDate}.`
                      }
                    }

                    toolResults.push({
                      tool_call_id: toolCall.id,
                      role: 'tool',
                      content: JSON.stringify(enhancedSearchResults)
                    })
                  } catch (searchError) {
                    log.error('Web search failed', searchError)
                    toolResults.push({
                      tool_call_id: toolCall.id,
                      role: 'tool',
                      content: JSON.stringify({ error: 'Search failed' })
                    })
                  }
                }
              }

              if (toolResults.length > 0) {
                const baseMessages = enhancedContext
                  ? [...messages.slice(0, -1), { role: 'user', content: enhancedContext }]
                  : messages

                const systemMessage = {
                  role: 'system',
                  content: `Current date: ${currentDate}. When referencing search results, use this date as baseline.`
                }

                finalMessages = [
                  systemMessage,
                  ...baseMessages,
                  toolResponse.choices[0].message,
                  ...toolResults
                ]
              } else {
                // Tool detection but no results - use enhanced context
                finalMessages = enhancedContext
                  ? [...messages.slice(0, -1), { role: 'user', content: enhancedContext }]
                  : messages
              }
            } else {
              // No tool calls - model decided not to search
              const directContent = toolResponse.choices?.[0]?.message?.content
              if (directContent) {
                // Model already produced a response without tools
                responseText = directContent
                const usage = toolResponse.usage || { prompt_tokens: 0, completion_tokens: 0 }

                // Send the full content as a single chunk
                sendEvent({ type: 'content', id: chatNode.id, content: directContent })

                // Update DB
                await updateChatNodeResponse(chatNode.id, directContent, usage, model, 'completed')

                // Track usage
                await trackTokenUsage({
                  userId,
                  tokensUsed: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
                  promptTokens: usage.prompt_tokens || 0,
                  completionTokens: usage.completion_tokens || 0,
                  modelId: model,
                  sessionId,
                  nodeId: chatNode.id
                }).catch(err => log.error('Failed to track token usage', err))

                // Title generation
                if (!parentNodeId && chatNode.depth === 0) {
                  await generateAndSendTitle(openRouterClient, sessionId, userPrompt, directContent, sendEvent)
                }

                await clearCaches(sessionId, chatNode, directContent)
                sendEvent({ type: 'done', id: chatNode.id })
                controller.close()
                stopTimer()
                return
              }

              // Empty response - fall through to streaming
              finalMessages = enhancedContext
                ? [...messages.slice(0, -1), { role: 'user', content: enhancedContext }]
                : messages
            }
          } else {
            // No tools - use enhanced context if available
            finalMessages = enhancedContext
              ? [...messages.slice(0, -1), { role: 'user', content: enhancedContext }]
              : messages
          }

          // 4. Stream the final AI response
          const streamRequestParams: any = {
            model: model as ModelId,
            messages: finalMessages,
            temperature,
            max_tokens,
            stream: true,
          }

          if (reasoning && supportsReasoning(model as ModelId)) {
            streamRequestParams.reasoning = getReasoningConfig(model as ModelId)
          }

          // Generous timeout for streaming (5 minutes)
          const streamTimeout = 300000

          await openRouterClient.createStreamingChatCompletion(
            streamRequestParams,
            (chunk) => {
              responseText += chunk
              tokenCount++
              sendEvent({ type: 'content', id: chatNode.id, content: chunk })
            },
            streamTimeout
          )

          // 5. Update DB with completed response
          const estimatedPromptTokens = estimateTokens(userPrompt)
          await updateChatNodeResponse(
            chatNode.id,
            responseText,
            { prompt_tokens: estimatedPromptTokens, completion_tokens: tokenCount },
            model,
            'completed'
          )

          // 6. Track billing
          await trackTokenUsage({
            userId,
            tokensUsed: estimatedPromptTokens + tokenCount,
            promptTokens: estimatedPromptTokens,
            completionTokens: tokenCount,
            modelId: model,
            sessionId,
            nodeId: chatNode.id
          }).catch(err => log.error('Failed to track token usage (streaming)', err))

          // 7. Title generation for first message
          if (!parentNodeId && chatNode.depth === 0) {
            await generateAndSendTitle(openRouterClient, sessionId, userPrompt, responseText, sendEvent)
          }

          // 8. Clear caches
          await clearCaches(sessionId, chatNode, responseText)

          // 9. Done
          sendEvent({ type: 'done', id: chatNode.id })
          controller.close()
        } catch (error) {
          log.error('Streaming error in with-tools route', error)

          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          // Update DB with failed status
          await updateChatNodeResponse(
            chatNode.id, '', undefined, model, 'failed', errorMessage
          ).catch(err => log.error('Failed to update node status to failed', err))

          recordError(createAppError(
            'SSE streaming failed',
            ErrorCategory.EXTERNAL_API,
            {
              context: { chatNodeId: chatNode.id, sessionId, model },
              cause: error as Error,
            }
          ))

          sendEvent({ type: 'error', id: chatNode.id, error: errorMessage })
          controller.close()
        }

        stopTimer()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    stopTimer()
    log.error('Pre-stream error in with-tools route', error)

    recordError(createAppError(
      'Chat with-tools API failed',
      ErrorCategory.INTERNAL,
      { cause: error as Error }
    ))

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper: Generate AI title and send via SSE
async function generateAndSendTitle(
  client: OpenRouterClient,
  sessionId: string,
  userPrompt: string,
  responseContent: string,
  sendEvent: (data: any) => void
) {
  try {
    const systemPrompt = `You are a helpful assistant that generates concise, descriptive titles for chat conversations.
Based on the user's first message and optionally the assistant's response, generate a short title (3-7 words) that captures the essence of the conversation.
The title should be:
- Clear and descriptive
- In the same language as the user's message
- Without quotes or special characters
- Focused on the main topic or question`

    const titlePrompt = responseContent
      ? `User's first message: "${userPrompt}"\n\nAssistant's response summary: "${responseContent.substring(0, 500)}..."\n\nGenerate a concise title for this conversation.`
      : `User's first message: "${userPrompt}"\n\nGenerate a concise title for this conversation.`

    const titleResponse = await client.createChatCompletion({
      model: 'openai/gpt-4o-2024-11-20',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: titlePrompt }
      ],
      max_tokens: 50,
      temperature: 0.7,
    })

    const title = titleResponse.choices[0]?.message?.content?.trim() || 'New Chat'

    const supabase = await createClient()
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        name: title,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (!updateError) {
      sendEvent({ type: 'title', sessionId, title })
      log.info('Session title updated', { title, sessionId })

      try {
        const { clearQueryCache } = await import('@/lib/db/query-optimizer')
        clearQueryCache()
      } catch {
        // Non-critical
      }
    } else {
      log.error('Failed to update session title', updateError)
    }
  } catch (error) {
    log.error('Failed to generate AI title', error)
    // Non-critical - don't fail the stream
  }
}

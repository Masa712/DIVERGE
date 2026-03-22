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
  createAppError,
  ErrorCategory,
  classifyDatabaseError,
  withRetry
} from '@/lib/errors/error-handler'
import { recordError } from '@/lib/errors/error-monitoring'
import { performanceMonitor } from '@/lib/utils/performance-optimizer'
import { log } from '@/lib/utils/logger'
import { tavilyClient } from '@/lib/tavily'
import { checkUserQuota, trackTokenUsage, canUseAdvancedModels, estimateTokens, canUseWebSearch, trackWebSearchUsage, getUserPlan } from '@/lib/billing/usage-tracker'
import { estimateCostUsd, formatCreditUsage } from '@/lib/billing/cost-calculator'
import { isModelAvailableForFreePlan, isAdvancedModel, getModelAccessErrorMessage } from '@/lib/billing/model-restrictions'

export async function POST(request: NextRequest) {
  const stopTimer = performanceMonitor.startTimer('chat_api_total')

  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'User authentication required' },
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
        log.warn('Model access denied for free plan', { model, userPlan })
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
        ? 'An error occurred while checking your usage quota.'
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

    // Fetch user profile for defaults
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

    // Create chat node
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
          functionCalling: false,
          enableWebSearch: false
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
          // 1. Send initial node data
          sendEvent({ type: 'node', node: chatNode })

          // 2. Build context
          let finalMessages = messages
          let webSearchResults: any = null

          const currentDate = new Date()
          const dateContext = `Important: Today's date is ${currentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}, ${currentDate.getFullYear()}.`

          // 3. Web search (inline)
          if (enableWebSearch && tavilyClient.isConfigured()) {
            const webSearchQuota = await canUseWebSearch(userId)
            if (webSearchQuota.allowed) {
              try {
                sendEvent({ type: 'search_start', id: chatNode.id, query: userPrompt })

                const searchResults = await tavilyClient.search(userPrompt, {
                  maxResults: 3,
                  includeAnswer: true,
                  searchDepth: 'basic'
                })

                if (searchResults && searchResults.results.length > 0) {
                  webSearchResults = searchResults
                  await trackWebSearchUsage(userId)

                  sendEvent({ type: 'search_results', id: chatNode.id, results: searchResults })

                  const searchContext = `${dateContext}\n\nWeb search results for "${userPrompt}":\n${searchResults.answer ? `Summary: ${searchResults.answer}\n\n` : ''}${searchResults.results.map((r: any, i: number) =>
                    `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content.substring(0, 200)}...\n`
                  ).join('\n')}\n\nBased on these search results, please provide an informed response.`

                  finalMessages = [
                    ...messages.slice(0, -1),
                    { role: 'system', content: searchContext },
                    messages[messages.length - 1]
                  ]
                }
              } catch (searchError) {
                log.warn('Web search failed, continuing without results', searchError)
              }
            }
          }

          // 4. Enhanced context
          if (useEnhancedContext && parentNodeId) {
            try {
              const referencedNodes = extractNodeReferences(userPrompt)
              const enhancedContext = await buildContextWithStrategy(parentNodeId, userPrompt, {
                includeSiblings: false,
                maxTokens: 8000,
                includeReferences: referencedNodes,
                model
              })

              if (webSearchResults && webSearchResults.results.length > 0) {
                const searchContext = `Web search results for "${userPrompt}":\n${webSearchResults.answer ? `Summary: ${webSearchResults.answer}\n\n` : ''}${webSearchResults.results.map((r: any, i: number) =>
                  `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content.substring(0, 200)}...\n`
                ).join('\n')}\n\nBased on these search results and the conversation context, please provide an informed response.`

                finalMessages = [
                  ...enhancedContext.messages,
                  { role: 'system', content: searchContext },
                  { role: 'user', content: userPrompt }
                ]
              } else {
                finalMessages = [
                  ...enhancedContext.messages,
                  { role: 'user', content: userPrompt }
                ]
              }

              log.info('Enhanced context built', {
                tokens: enhancedContext.metadata.totalTokens,
                references: referencedNodes.length
              })
            } catch (contextError) {
              log.warn('Enhanced context failed, using simple messages', contextError)
              recordError(createAppError(
                'Enhanced context building failed',
                ErrorCategory.INTERNAL,
                { cause: contextError as Error }
              ))
            }
          }

          // 5. Stream AI response
          const client = new OpenRouterClient()
          let responseText = ''

          const getOptimalMaxTokens = (modelId: string, userMaxTokens: number): number => {
            if (modelId === 'x-ai/grok-4') return Math.max(userMaxTokens, 6000)
            if (modelId.includes('gpt-5') || modelId.startsWith('openai/o1')) return Math.max(userMaxTokens, 5000)
            if (modelId.includes('gemini-2.5-pro') || modelId.includes('gemini-pro-1.5')) return Math.max(userMaxTokens, 5000)
            if (modelId.includes('claude-opus')) return Math.max(userMaxTokens, 5000)
            return Math.max(userMaxTokens, 4000)
          }

          const optimalMaxTokens = getOptimalMaxTokens(model, max_tokens)

          const requestParams: any = {
            model: model as ModelId,
            messages: finalMessages,
            temperature,
            max_tokens: optimalMaxTokens,
            stream: true,
          }

          if (reasoning && supportsReasoning(model as ModelId)) {
            requestParams.reasoning = getReasoningConfig(model as ModelId)
          }

          const streamTimeout = 300000

          const streamingUsage = await client.createStreamingChatCompletion(
            requestParams,
            (chunk) => {
              responseText += chunk
              sendEvent({ type: 'content', id: chatNode.id, content: chunk })
            },
            streamTimeout
          )

          // 6. Update DB - use actual usage from OpenRouter when available
          const promptTokens = streamingUsage?.prompt_tokens || estimateTokens(userPrompt)
          const completionTokens = streamingUsage?.completion_tokens || estimateTokens(responseText)
          log.debug('Token usage for billing', {
            source: streamingUsage ? 'openrouter' : 'estimate',
            promptTokens,
            completionTokens,
            model
          })

          await withRetry(async () => {
            await updateChatNodeResponse(
              chatNode.id,
              responseText,
              { prompt_tokens: promptTokens, completion_tokens: completionTokens },
              model,
              'completed'
            )
          }, { maxAttempts: 3 })

          // 7. Track billing
          await trackTokenUsage({
            userId,
            tokensUsed: promptTokens + completionTokens,
            promptTokens,
            completionTokens,
            modelId: model,
            sessionId,
            nodeId: chatNode.id
          }).catch(err => log.error('Failed to track token usage', err))

          // 8. Title generation for first message
          if (!parentNodeId && chatNode.depth === 0) {
            try {
              const titleResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sessions/generate-title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userMessage: userPrompt,
                  assistantResponse: responseText.substring(0, 500)
                })
              })

              if (titleResponse.ok) {
                const { title } = await titleResponse.json()

                const updateSupabase = await createClient()
                await updateSupabase
                  .from('sessions')
                  .update({
                    name: title,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', sessionId)

                sendEvent({ type: 'title', sessionId, title })

                try {
                  const { clearQueryCache } = await import('@/lib/db/query-optimizer')
                  clearQueryCache()
                } catch {
                  // Non-critical
                }
              }
            } catch (error) {
              log.error('Failed to generate AI title', error)
            }
          }

          // 9. Clear caches
          try {
            const redisIsAvailable = await isRedisAvailable()
            if (redisIsAvailable) {
              const redisCache = getRedisEnhancedContextCache()
              await redisCache.clearSessionCache(sessionId)
              await redisCache.addNode(sessionId, {
                ...chatNode,
                response: responseText,
                status: 'completed',
                createdAt: chatNode.createdAt instanceof Date ? chatNode.createdAt.toISOString() : chatNode.createdAt,
                updatedAt: chatNode.updatedAt instanceof Date ? chatNode.updatedAt.toISOString() : chatNode.updatedAt,
              })
            } else {
              await clearSessionCache(sessionId)
            }
          } catch (cacheError) {
            log.warn('Failed to clear caches', cacheError)
          }

          // 10. Done
          sendEvent({ type: 'done', id: chatNode.id })
          controller.close()
        } catch (error) {
          log.error('Streaming error in chat route', error)

          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          await updateChatNodeResponse(
            chatNode.id, '', undefined, model, 'failed', errorMessage
          ).catch(err => log.error('Failed to update node status', err))

          recordError(createAppError(
            'SSE streaming failed',
            ErrorCategory.EXTERNAL_API,
            {
              context: { chatNodeId: chatNode.id, sessionId },
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
    log.error('Pre-stream error in chat route', error)

    recordError(createAppError(
      'Chat API failed',
      ErrorCategory.INTERNAL,
      { cause: error as Error }
    ))

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

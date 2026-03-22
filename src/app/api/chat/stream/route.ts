import { NextRequest } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { createClient } from '@/lib/supabase/server'
import { ModelId } from '@/types'
import { checkUserQuota, trackTokenUsage, estimateTokens } from '@/lib/billing/usage-tracker'
import { estimateCostUsd, formatCreditUsage } from '@/lib/billing/cost-calculator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { 
      messages, 
      model, 
      temperature = 0.7, 
      max_tokens = 1000,
      sessionId,
      parentNodeId
    } = body

    if (!messages || !model) {
      return new Response(
        JSON.stringify({ error: 'Messages and model are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Cost-based quota check
    const estimatedInputTokens = estimateTokens(messages[messages.length - 1]?.content || '')
    const estimatedCost = estimateCostUsd(model, estimatedInputTokens, max_tokens || 1000)
    const quotaCheck = await checkUserQuota(user.id, estimatedCost)
    if (!quotaCheck.allowed) {
      const quotaExceededMessage = quotaCheck.costLimit === -1
        ? 'Usage limit exceeded. Please contact support.'
        : `Monthly credit limit reached (${formatCreditUsage(quotaCheck.currentCostUsed, quotaCheck.costLimit)} credits). Please upgrade your plan or wait for next month's reset.`
      return new Response(
        JSON.stringify({
          error: quotaExceededMessage,
          quota: {
            costUsed: quotaCheck.currentCostUsed,
            costLimit: quotaCheck.costLimit,
            plan: quotaCheck.planId
          }
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create a new chat node in the database
    const { data: chatNode, error: nodeError } = await supabase
      .from('chat_nodes')
      .insert({
        session_id: sessionId,
        parent_id: parentNodeId,
        model: model as ModelId,
        prompt: messages[messages.length - 1].content,
        status: 'streaming',
        temperature,
        max_tokens,
      })
      .select()
      .single()

    if (nodeError) {
      console.error('Error creating chat node:', nodeError)
      return new Response(
        JSON.stringify({ error: 'Failed to create chat node' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize OpenRouter client
    const client = new OpenRouterClient()

    // Create a readable stream
    const encoder = new TextEncoder()
    let responseText = ''

    // Set appropriate timeout for high-performance and reasoning models
    const timeoutMs = (() => {
      if (model === 'x-ai/grok-4') return 150000 // 2.5 minutes
      if (model.startsWith('openai/o1') || model.includes('gpt-5')) return 120000 // 2 minutes for GPT-5
      if (model.includes('gemini-2.5-pro') || model.includes('gemini-pro-1.5')) return 120000 // 2 minutes for Gemini Pro
      return 60000 // 60 seconds for standard streaming
    })()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamingUsage = await client.createStreamingChatCompletion(
            {
              model: model as ModelId,
              messages,
              temperature,
              max_tokens,
              stream: true,
            },
            (chunk) => {
              responseText += chunk

              // Send chunk to client
              const data = JSON.stringify({
                id: chatNode.id,
                content: chunk,
                type: 'content'
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            },
            timeoutMs
          )

          // Update chat node with complete response - use actual usage from OpenRouter when available
          const promptTokens = streamingUsage?.prompt_tokens || estimateTokens(messages[messages.length - 1]?.content || '')
          const completionTokens = streamingUsage?.completion_tokens || estimateTokens(responseText)
          await supabase
            .from('chat_nodes')
            .update({
              response: responseText,
              status: 'completed',
              response_tokens: completionTokens,
            })
            .eq('id', chatNode.id)

          // Track token usage for billing
          await trackTokenUsage({
            userId: user.id,
            tokensUsed: promptTokens + completionTokens,
            promptTokens,
            completionTokens,
            modelId: model,
            sessionId,
            nodeId: chatNode.id
          }).catch(err => console.error('Failed to track token usage (stream)', err))

          // Send completion signal
          const doneData = JSON.stringify({ 
            id: chatNode.id,
            type: 'done'
          })
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          
          // Update chat node with error status
          await supabase
            .from('chat_nodes')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('id', chatNode.id)

          const errorData = JSON.stringify({ 
            id: chatNode.id,
            error: 'Streaming failed',
            type: 'error'
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Stream API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
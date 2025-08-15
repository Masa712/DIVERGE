import { NextRequest, NextResponse } from 'next/server'
import { createChatNode, getChatNodeById, buildContextForNode } from '@/lib/db/chat-nodes'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { ModelId } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      parentNodeId,
      sessionId,
      prompt,
      model,
      temperature = 0.7,
      maxTokens = 1000,
      systemPrompt
    } = body

    if (!parentNodeId || !sessionId || !prompt || !model) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get parent node to verify it exists
    const parentNode = await getChatNodeById(parentNodeId)
    if (!parentNode) {
      return NextResponse.json(
        { error: 'Parent node not found' },
        { status: 404 }
      )
    }

    // Create new branch node
    const newNode = await createChatNode({
      sessionId,
      parentId: parentNodeId,
      model: model as ModelId,
      prompt,
      systemPrompt,
      temperature,
      maxTokens,
    })

    // Build context from parent node path
    const context = await buildContextForNode(parentNodeId)
    
    // Add the new prompt to context with proper typing
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      ...context.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })),
      { role: 'user' as const, content: prompt }
    ]

    // Initialize OpenRouter client
    const client = new OpenRouterClient()

    // Get response from AI
    const response = await client.createChatCompletion({
      model: model as ModelId,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    })

    const responseContent = response.choices[0]?.message?.content || ''
    const usage = response.usage

    // Update node with response
    await updateChatNode(newNode.id, {
      response: responseContent,
      status: 'completed',
      promptTokens: usage?.prompt_tokens || 0,
      responseTokens: usage?.completion_tokens || 0,
      costUsd: calculateCost(model, usage),
    })

    return NextResponse.json({
      node: {
        ...newNode,
        response: responseContent,
        status: 'completed',
      },
      context: messages,
    })
  } catch (error) {
    console.error('Branch creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create branch' },
      { status: 500 }
    )
  }
}

// Import these from the existing chat route
import { updateChatNode } from '@/lib/db/chat-nodes'

function calculateCost(model: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  if (!usage) return 0

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
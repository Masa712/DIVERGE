import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { createClient } from '@/lib/supabase/server'
import { ModelId } from '@/types'

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
      parentNodeId
    } = body

    if (!messages || !model) {
      return NextResponse.json(
        { error: 'Messages and model are required' },
        { status: 400 }
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
      return NextResponse.json(
        { error: 'Failed to create chat node' },
        { status: 500 }
      )
    }

    // Initialize OpenRouter client
    const client = new OpenRouterClient()

    // Create completion
    const response = await client.createChatCompletion({
      model: model as ModelId,
      messages,
      temperature,
      max_tokens,
      stream: false,
    })

    const responseContent = response.choices[0]?.message?.content || ''
    const usage = response.usage

    // Update chat node with response
    const { error: updateError } = await supabase
      .from('chat_nodes')
      .update({
        response: responseContent,
        status: 'completed',
        prompt_tokens: usage?.prompt_tokens || 0,
        response_tokens: usage?.completion_tokens || 0,
        cost_usd: calculateCost(model, usage),
      })
      .eq('id', chatNode.id)

    if (updateError) {
      console.error('Error updating chat node:', updateError)
    }

    return NextResponse.json({
      id: chatNode.id,
      content: responseContent,
      usage,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate cost based on model and usage
function calculateCost(model: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  if (!usage) return 0

  // Cost per million tokens (you can import this from types/index.ts)
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
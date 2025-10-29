import { NextRequest, NextResponse } from 'next/server'
import { createChatNode, getChatNodeById, buildContextForNode } from '@/lib/db/chat-nodes'
import { buildEnhancedContext, buildContextWithStrategy, extractNodeReferences } from '@/lib/db/enhanced-context'
import { clearSessionCache } from '@/lib/db/enhanced-context-cache'
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
      maxTokens = 4000, // Increased default for better responses
      systemPrompt,
      useEnhancedContext = true
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

    // Build context using enhanced context system if enabled
    let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
    let contextMetadata = null
    
    if (useEnhancedContext) {
      try {
        // Extract node references from prompt
        const referencedNodes = extractNodeReferences(prompt)
        
        // Build enhanced context with intelligent strategy selection
        const enhancedContext = await buildContextWithStrategy(parentNodeId, prompt, {
          includeSiblings: false, // FIXED: Prevent cross-branch contamination
          maxTokens: 4000, // Increased from 3000 to better support node references
          includeReferences: referencedNodes,
          model: model // Pass model for accurate token counting
        })
        
        contextMetadata = enhancedContext.metadata
        
        // Convert to proper message format and add new prompt
        messages = [
          ...enhancedContext.messages.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content
          })),
          { role: 'user' as const, content: prompt }
        ]
        
        console.log(`Branch enhanced context: ${enhancedContext.metadata.totalTokens} tokens, ${enhancedContext.metadata.siblingCount} siblings, ${referencedNodes.length} references`)
        
      } catch (contextError) {
        console.warn('Enhanced context failed for branch, falling back to basic context:', contextError)
        // Fallback to basic context
        const basicContext = await buildContextForNode(parentNodeId)
        messages = [
          ...basicContext.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content
          })),
          { role: 'user' as const, content: prompt }
        ]
      }
    } else {
      // Use basic context
      const basicContext = await buildContextForNode(parentNodeId)
      messages = [
        ...basicContext.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })),
        { role: 'user' as const, content: prompt }
      ]
    }

    // Initialize OpenRouter client
    const client = new OpenRouterClient()

    // Set model-specific max_tokens for optimal output length
    const getOptimalMaxTokens = (modelId: string, userMaxTokens: number): number => {
      // For reasoning models like Grok-4, allow more tokens for complete responses
      if (modelId === 'x-ai/grok-4') return Math.max(userMaxTokens, 6000)
      
      // For high-context models, use generous limits
      if (modelId.includes('gpt-5') || modelId.includes('claude-opus')) return Math.max(userMaxTokens, 5000)
      
      // For other models, ensure minimum for complete responses
      return Math.max(userMaxTokens, 4000)
    }
    
    const optimalMaxTokens = getOptimalMaxTokens(model, maxTokens)

    // Get response from AI
    const response = await client.createChatCompletion({
      model: model as ModelId,
      messages,
      temperature,
      max_tokens: optimalMaxTokens,
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

    // Clear session cache since new node was added
    clearSessionCache(sessionId)

    return NextResponse.json({
      node: {
        ...newNode,
        response: responseContent,
        status: 'completed',
      },
      context: messages,
      contextMetadata,
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
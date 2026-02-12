import { NextRequest } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { createClient } from '@/lib/supabase/server'
import { ModelId } from '@/types'
import { tavilyClient, WebSearchResponse } from '@/lib/tavily'
import {
  canUseWebSearch,
  trackWebSearchUsage
} from '@/lib/billing/usage-tracker'

// Define tool schemas for function calling
const AVAILABLE_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for current information, news, facts, or any topic that requires up-to-date knowledge',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find information on the web'
          }
        },
        required: ['query']
      }
    }
  }
]

async function executeWebSearch(query: string): Promise<WebSearchResponse | null> {
  if (!tavilyClient.isConfigured()) {
    console.warn('Tavily API not configured, skipping web search')
    return null
  }

  try {
    return await tavilyClient.search(query, {
      maxResults: 5,
      includeAnswer: true,
      searchDepth: 'basic'
    })
  } catch (error) {
    console.error('Web search failed:', error)
    return null
  }
}

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
      parentNodeId,
      enableWebSearch = true
    } = body

    if (!messages || !model) {
      return new Response(
        JSON.stringify({ error: 'Messages and model are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
    let tokenCount = 0
    const searchResults: WebSearchResponse[] = []

    // Check if model supports function calling
    const supportsFunctionCalling = [
      'openai/gpt-4-turbo',
      'openai/gpt-4',
      'openai/gpt-3.5-turbo',
      'anthropic/claude-3-opus',
      'anthropic/claude-3-sonnet',
      'anthropic/claude-3-haiku',
      'google/gemini-pro',
      'google/gemini-2.0-flash-exp:free',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-pro-1.5-latest'
    ].some(m => model.includes(m))

    // Set appropriate timeout
    const timeoutMs = (() => {
      if (model === 'x-ai/grok-4') return 150000
      if (model.startsWith('openai/o1') || model.includes('gpt-5')) return 120000
      if (model.includes('gemini-2.5-pro') || model.includes('gemini-pro-1.5')) return 120000
      return 60000
    })()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages = [...messages]
          
          // If web search is enabled and model supports function calling
          if (enableWebSearch && supportsFunctionCalling && tavilyClient.isConfigured()) {
            // First call with tools to check if search is needed
            const toolCallRequest = {
              model: model as ModelId,
              messages: currentMessages,
              temperature,
              max_tokens,
              tools: AVAILABLE_TOOLS,
              tool_choice: 'auto' as const
            }

            const toolResponse = await client.createChatCompletion(toolCallRequest)
            
            // Check if the model wants to use tools
            if (toolResponse.choices?.[0]?.message?.tool_calls) {
              for (const toolCall of toolResponse.choices[0].message.tool_calls) {
                if (toolCall.function.name === 'web_search') {
                  const args = JSON.parse(toolCall.function.arguments)

                  // Check web search quota before executing search
                  const quotaCheck = await canUseWebSearch(user.id)

                  if (!quotaCheck.allowed) {
                    console.warn('Web search quota exceeded', {
                      userId: user.id,
                      currentUsage: quotaCheck.currentUsage,
                      limit: quotaCheck.limit
                    })

                    // Send quota exceeded notification to client
                    const quotaExceededNotification = JSON.stringify({
                      id: chatNode.id,
                      type: 'search_quota_exceeded',
                      message: `Web search limit reached (${quotaCheck.currentUsage}/${quotaCheck.limit}). Please upgrade your plan to continue using web search.`
                    })
                    controller.enqueue(encoder.encode(`data: ${quotaExceededNotification}\n\n`))

                    // Add error message to tool results
                    currentMessages.push(toolResponse.choices[0].message)
                    currentMessages.push({
                      role: 'tool',
                      content: `Web search limit reached (${quotaCheck.currentUsage}/${quotaCheck.limit}). Please upgrade your plan to continue using web search.`,
                      tool_call_id: toolCall.id
                    })
                    continue // Skip to next tool call
                  }

                  // Send search notification to client
                  const searchNotification = JSON.stringify({
                    id: chatNode.id,
                    type: 'search_start',
                    query: args.query
                  })
                  controller.enqueue(encoder.encode(`data: ${searchNotification}\n\n`))

                  // Execute search
                  const searchResult = await executeWebSearch(args.query)

                  if (searchResult) {
                    // Track web search usage after successful search
                    const tracked = await trackWebSearchUsage(user.id)
                    if (!tracked) {
                      console.warn('Failed to track web search usage', { userId: user.id, query: args.query })
                    }

                    searchResults.push(searchResult)

                    // Send search results to client
                    const searchData = JSON.stringify({
                      id: chatNode.id,
                      type: 'search_results',
                      results: searchResult
                    })
                    controller.enqueue(encoder.encode(`data: ${searchData}\n\n`))

                    // Add search results to context
                    const searchContext = `Web search results for "${args.query}":
${searchResult.answer ? `Summary: ${searchResult.answer}\n\n` : ''}
${searchResult.results.map((r, i) =>
  `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content}\n`
).join('\n')}
`

                    // Add assistant's tool call and search results to messages
                    currentMessages.push(toolResponse.choices[0].message)
                    currentMessages.push({
                      role: 'tool',
                      content: searchContext,
                      tool_call_id: toolCall.id
                    })
                  }
                }
              }
            }
          }

          // Now stream the final response with search context if available
          await client.createStreamingChatCompletion(
            {
              model: model as ModelId,
              messages: currentMessages,
              temperature,
              max_tokens,
              stream: true,
            },
            (chunk) => {
              responseText += chunk
              tokenCount++
              
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

          // Store search results metadata if any
          const metadata = searchResults.length > 0 
            ? { web_searches: searchResults.map(s => ({ query: s.query, resultCount: s.results.length })) }
            : undefined

          // Update chat node with complete response
          await supabase
            .from('chat_nodes')
            .update({
              response: responseText,
              status: 'completed',
              response_tokens: tokenCount,
              metadata
            })
            .eq('id', chatNode.id)

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
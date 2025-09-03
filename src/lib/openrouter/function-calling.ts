/**
 * Function Calling support for OpenRouter API
 * Defines tool schemas and types for web search integration
 */

export interface FunctionCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolMessage {
  role: 'tool'
  content: string
  tool_call_id: string
}

// Define the web search tool schema with current year awareness
export const webSearchTool = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description: `Search the web for current, real-time, or recent information. The current year is ${new Date().getFullYear()}. When searching for "latest" or "current" information, include the year ${new Date().getFullYear()} in your search query. Use this when the user asks about current events, latest updates, prices, weather, news, or any information that might have changed recently.`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: `The search query optimized for finding relevant current information. Include "${new Date().getFullYear()}" for latest/current information searches.`
        },
        search_type: {
          type: 'string',
          enum: ['general', 'news', 'technical', 'product', 'price'],
          description: 'The type of search to perform for better results'
        }
      },
      required: ['query']
    }
  }
}

// Parse function arguments safely
export function parseFunctionArguments(args: string): Record<string, any> {
  try {
    return JSON.parse(args)
  } catch (error) {
    console.error('Failed to parse function arguments:', error)
    return {}
  }
}

// Create a tool result message
export function createToolResultMessage(
  toolCallId: string,
  result: any
): ToolMessage {
  return {
    role: 'tool',
    content: typeof result === 'string' ? result : JSON.stringify(result),
    tool_call_id: toolCallId
  }
}
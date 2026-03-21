/**
 * SSE Stream Reader - Shared utility for parsing Server-Sent Events
 * Used by chat pages to read real-time streaming responses from API routes
 */

export interface StreamReaderCallbacks {
  onNode: (node: any) => void
  onContent: (nodeId: string, chunk: string) => void
  onSearchStart?: (nodeId: string, query: string) => void
  onSearchResults?: (nodeId: string, results: any) => void
  onSearchQuotaExceeded?: (nodeId: string, message: string) => void
  onTitle?: (sessionId: string, title: string) => void
  onDone: (nodeId: string) => void
  onError: (nodeId: string, error: string) => void
}

/**
 * Read and parse an SSE stream from a fetch Response.
 * Calls the appropriate callback for each event type.
 */
export async function readSSEStream(
  response: Response,
  callbacks: StreamReaderCallbacks
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') continue

        try {
          const event = JSON.parse(data)

          switch (event.type) {
            case 'node':
              callbacks.onNode(event.node)
              break
            case 'content':
              callbacks.onContent(event.id, event.content)
              break
            case 'search_start':
              callbacks.onSearchStart?.(event.id, event.query)
              break
            case 'search_results':
              callbacks.onSearchResults?.(event.id, event.results)
              break
            case 'search_quota_exceeded':
              callbacks.onSearchQuotaExceeded?.(event.id, event.message)
              break
            case 'title':
              callbacks.onTitle?.(event.sessionId, event.title)
              break
            case 'done':
              callbacks.onDone(event.id)
              break
            case 'error':
              callbacks.onError(event.id, event.error)
              break
          }
        } catch {
          // Ignore JSON parse errors for malformed chunks
        }
      }
    }

    // Process any remaining data in the buffer
    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6).trim()
      if (data && data !== '[DONE]') {
        try {
          const event = JSON.parse(data)
          if (event.type === 'done') callbacks.onDone(event.id)
          else if (event.type === 'error') callbacks.onError(event.id, event.error)
        } catch {
          // Ignore
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

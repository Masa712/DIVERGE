'use client'

import { ChatNode } from '@/types'
import { AVAILABLE_MODELS } from '@/types'

interface Props {
  nodes: ChatNode[]
}

export function ChatMessages({ nodes }: Props) {
  const getModelName = (modelId: string) => {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId)
    return model ? model.name : modelId
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'streaming':
        return 'text-blue-600'
      case 'failed':
        return 'text-red-600'
      case 'pending':
        return 'text-yellow-600'
      default:
        return 'text-muted-foreground'
    }
  }

  const formatTokens = (promptTokens?: number, responseTokens?: number) => {
    const total = (promptTokens || 0) + (responseTokens || 0)
    return total > 0 ? `${total} tokens` : ''
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">Start a conversation</p>
          <p className="text-sm">Type a message below to begin</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {nodes.map((node) => (
        <div key={node.id} className="space-y-3">
          {/* User Message */}
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-lg bg-primary px-4 py-2 text-primary-foreground">
              <p className="whitespace-pre-wrap">{node.prompt}</p>
            </div>
          </div>

          {/* Assistant Response */}
          <div className="flex justify-start">
            <div className="max-w-[80%] space-y-2">
              <div className="rounded-lg border bg-card px-4 py-2">
                {node.response ? (
                  <p className="whitespace-pre-wrap">{node.response}</p>
                ) : node.status === 'streaming' ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    <span className="text-muted-foreground">Generating response...</span>
                  </div>
                ) : node.status === 'failed' ? (
                  <div className="text-red-600">
                    <p>Failed to generate response</p>
                    {node.errorMessage && (
                      <p className="text-sm mt-1">{node.errorMessage}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <div className="animate-pulse">Waiting for response...</div>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground px-2">
                <span className="font-medium">{getModelName(node.model)}</span>
                <span className={getStatusColor(node.status)}>{node.status}</span>
                {formatTokens(node.promptTokens, node.responseTokens) && (
                  <span>{formatTokens(node.promptTokens, node.responseTokens)}</span>
                )}
                {node.costUsd && node.costUsd > 0 && (
                  <span>${node.costUsd.toFixed(4)}</span>
                )}
                <span>{new Date(node.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
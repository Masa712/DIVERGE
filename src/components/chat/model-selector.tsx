'use client'

import { ModelId, ModelConfig } from '@/types'

interface Props {
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  availableModels: ModelConfig[]
}

export function ModelSelector({ selectedModel, onModelChange, availableModels }: Props) {
  const selectedModelConfig = availableModels.find(m => m.id === selectedModel)

  return (
    <div className="space-y-2">
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value as ModelId)}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {availableModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} ({model.provider})
          </option>
        ))}
      </select>
      
      {selectedModelConfig && (
        <div className="text-xs text-muted-foreground">
          <div>{selectedModelConfig.contextLength.toLocaleString()} tokens</div>
          <div>
            ${selectedModelConfig.costPerMillionTokens.input}/${selectedModelConfig.costPerMillionTokens.output} per 1M tokens
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { ChatNode } from '@/types'
import { CompactTreeView } from './BalancedTreeView'

interface Props {
  nodes: ChatNode[]
  currentNodeId?: string
  onNodeClick?: (nodeId: string) => void
  onBranchCreate?: (parentNodeId: string, prompt: string) => void
  onNodeIdClick?: (nodeReference: string) => void
}

export function ChatTreeView({ 
  nodes: chatNodes, 
  currentNodeId, 
  onNodeClick, 
  onBranchCreate,
  onNodeIdClick
}: Props) {
  // Always use CompactTreeView - simplified implementation
  return (
    <CompactTreeView
      nodes={chatNodes}
      currentNodeId={currentNodeId}
      onNodeClick={onNodeClick}
      onBranchCreate={onBranchCreate}
      onNodeIdClick={onNodeIdClick}
    />
  )
}
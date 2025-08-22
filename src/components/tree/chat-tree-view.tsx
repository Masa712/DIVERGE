'use client'

import { ChatNode } from '@/types'
import { CompactTreeView } from './BalancedTreeView'

interface Props {
  nodes: ChatNode[]
  currentNodeId?: string
  onNodeClick?: (nodeId: string) => void
  onNodeIdClick?: (nodeReference: string) => void
}

export function ChatTreeView({ 
  nodes: chatNodes, 
  currentNodeId, 
  onNodeClick, 
  onNodeIdClick
}: Props) {
  // Always use CompactTreeView - simplified implementation
  return (
    <CompactTreeView
      nodes={chatNodes}
      currentNodeId={currentNodeId}
      onNodeClick={onNodeClick}
      onNodeIdClick={onNodeIdClick}
    />
  )
}
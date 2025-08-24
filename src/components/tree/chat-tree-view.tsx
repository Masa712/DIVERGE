'use client'

import { ChatNode } from '@/types'
import { CompactTreeView } from './BalancedTreeView'

interface Props {
  nodes: ChatNode[]
  currentNodeId?: string
  onNodeClick?: (nodeId: string) => void
  onNodeIdClick?: (nodeReference: string) => void
  onBackgroundClick?: () => void
}

export function ChatTreeView({ 
  nodes: chatNodes, 
  currentNodeId, 
  onNodeClick, 
  onNodeIdClick,
  onBackgroundClick
}: Props) {
  // Always use CompactTreeView - simplified implementation
  return (
    <CompactTreeView
      nodes={chatNodes}
      currentNodeId={currentNodeId}
      onNodeClick={onNodeClick}
      onNodeIdClick={onNodeIdClick}
      onBackgroundClick={onBackgroundClick}
    />
  )
}
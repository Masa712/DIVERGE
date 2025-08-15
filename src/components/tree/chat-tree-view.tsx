'use client'

import { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Position,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ChatNode } from '@/types'
import { MessageNode } from './message-node'

interface Props {
  nodes: ChatNode[]
  currentNodeId?: string
  onNodeClick?: (nodeId: string) => void
  onBranchCreate?: (parentNodeId: string, prompt: string) => void
}

const nodeTypes = {
  message: MessageNode,
}

export function ChatTreeView({ 
  nodes: chatNodes, 
  currentNodeId, 
  onNodeClick, 
  onBranchCreate 
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Convert chat nodes to React Flow nodes and edges with improved layout
  useEffect(() => {
    if (!chatNodes || chatNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    console.log('Processing chat nodes:', chatNodes.length, 'nodes')
    console.log('Sample node structure:', chatNodes[0])

    // Create a map for quick lookup and validate parent-child relationships
    const nodeMap = new Map(chatNodes.map(n => [n.id, n]))
    
    // Build parent-children relationships with validation
    const childrenMap = new Map<string, ChatNode[]>()
    const rootNodes: ChatNode[] = []
    
    chatNodes.forEach(node => {
      if (node.parentId && node.parentId !== null) {
        // Validate that parent exists
        if (!nodeMap.has(node.parentId)) {
          console.warn(`Node ${node.id} references non-existent parent ${node.parentId}`)
          rootNodes.push(node) // Treat as root if parent doesn't exist
          return
        }
        
        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, [])
        }
        childrenMap.get(node.parentId)!.push(node)
      } else {
        rootNodes.push(node)
      }
    })
    
    console.log('Root nodes:', rootNodes.length)
    console.log('Parent-child relationships:', Array.from(childrenMap.entries()).map(([parent, children]) => 
      ({ parent, childCount: children.length })))
    
    // Sort children by creation time to maintain consistent ordering
    childrenMap.forEach(children => {
      children.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    })
    
    // Calculate positions with proper spacing
    const nodePositions = new Map<string, { x: number; y: number }>()
    const horizontalSpacing = 200  // Increased to prevent overlap
    const verticalSpacing = 350    // Spacing between levels
    
    // Track the rightmost position at each depth level
    const maxXAtDepth = new Map<number, number>()
    
    // Recursive function to position nodes
    const positionNode = (node: ChatNode, parentX: number = 0) => {
      const y = node.depth * verticalSpacing
      let x = parentX
      
      // Get children for this node
      const children = childrenMap.get(node.id) || []
      
      // If this node has siblings (branches from same parent)
      if (node.parentId) {
        const siblings = childrenMap.get(node.parentId) || []
        const siblingIndex = siblings.findIndex(s => s.id === node.id)
        
        if (siblingIndex === 0) {
          // First child - position directly below parent
          x = parentX
        } else if (siblingIndex > 0) {
          // Subsequent children (branches) - position to the right
          // Find the rightmost position used at this depth
          const currentMaxX = maxXAtDepth.get(node.depth) || parentX
          x = Math.max(parentX + (siblingIndex * horizontalSpacing), currentMaxX + horizontalSpacing)
        }
      }
      
      // Update max X for this depth
      maxXAtDepth.set(node.depth, Math.max(maxXAtDepth.get(node.depth) || 0, x))
      
      // Set position for this node
      nodePositions.set(node.id, { x, y })
      
      // Position children recursively
      children.forEach(child => {
        positionNode(child, x)
      })
    }
    
    // Position all trees starting from roots
    let startX = 0
    rootNodes.forEach((root, index) => {
      if (index > 0) {
        // Space out multiple root trees
        const maxX = Math.max(...Array.from(maxXAtDepth.values()))
        startX = maxX + horizontalSpacing * 2
      }
      positionNode(root, startX)
    })
    
    // Create React Flow nodes
    const flowNodes: Node[] = chatNodes.map(node => {
      const position = nodePositions.get(node.id) || { x: 0, y: 0 }
      
      return {
        id: node.id,
        type: 'message',
        position,
        data: {
          node,
          isCurrentNode: node.id === currentNodeId,
          onNodeClick,
          onBranchCreate,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }
    })

    // Create edges with proper styling - ensuring all parent-child connections
    const flowEdges: Edge[] = chatNodes
      .filter(node => node.parentId && node.parentId !== null)
      .filter(node => nodeMap.has(node.parentId!)) // Only create edges for valid parent references
      .map(node => {
        const isPartOfCurrentPath = node.id === currentNodeId || 
          (!!currentNodeId && isAncestor(node.id, currentNodeId, nodeMap))
        
        return {
          id: `${node.parentId}-${node.id}`,
          source: node.parentId!,
          target: node.id,
          type: 'smoothstep',
          animated: isPartOfCurrentPath,
          style: {
            stroke: isPartOfCurrentPath ? '#3b82f6' : '#6b7280',
            strokeWidth: isPartOfCurrentPath ? 3 : 2,
          },
        }
      })

    // Debug: Log edges to check if they're being created
    console.log('Created edges:', flowEdges.length, 'edges')
    console.log('Edge details:', flowEdges.map(e => ({ id: e.id, source: e.source, target: e.target })))
    console.log('Created nodes:', flowNodes.length, 'nodes')
    
    // Validate that all edge sources and targets exist
    const nodeIds = new Set(flowNodes.map(n => n.id))
    const invalidEdges = flowEdges.filter(e => !nodeIds.has(e.source) || !nodeIds.has(e.target))
    if (invalidEdges.length > 0) {
      console.warn('Invalid edges detected:', invalidEdges)
    }
    
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [chatNodes, currentNodeId, onNodeClick, onBranchCreate, setNodes, setEdges])

  // Helper function to check if a node is an ancestor of another
  const isAncestor = (
    nodeId: string, 
    targetId: string, 
    nodeMap: Map<string, ChatNode>
  ): boolean => {
    let current = nodeMap.get(targetId)
    while (current && current.parentId) {
      if (current.parentId === nodeId) return true
      current = nodeMap.get(current.parentId)
    }
    return false
  }

  const onNodeClickHandler = useCallback((_event: React.MouseEvent, node: Node) => {
    if (onNodeClick) {
      onNodeClick(node.id)
    }
  }, [onNodeClick])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        edgesFocusable={false}
        edgesUpdatable={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: '#6b7280',
            strokeWidth: 2,
          },
        }}
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => 
            node.data?.isCurrentNode ? '#3b82f6' : '#cbd5e1'
          }
          nodeStrokeWidth={3}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}
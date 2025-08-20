'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Panel,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ChatNode } from '@/types'
import { MessageNode } from './message-node'
import { CompactTreeLayout, TreeNode } from './CompactTreeLayout'

interface Props {
  nodes: ChatNode[]
  currentNodeId?: string
  onNodeClick?: (nodeId: string) => void
  onBranchCreate?: (parentNodeId: string, prompt: string) => void
}

const nodeTypes = {
  message: MessageNode,
}

const COMPACT_LAYOUT_CONFIG = {
  horizontalSpacing: 250,
  verticalSpacing: 350,
  nodeWidth: 280,
  minSubtreeSpacing: 150,
}

export function CompactTreeView({ 
  nodes: chatNodes, 
  currentNodeId, 
  onNodeClick, 
  onBranchCreate 
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showDebugInfo, setShowDebugInfo] = useState(false)

  // Initialize layout engine
  const layoutEngine = useMemo(() => {
    return new CompactTreeLayout(COMPACT_LAYOUT_CONFIG)
  }, [])

  // Convert ChatNodes to TreeNodes
  const convertToTreeNodes = useCallback((chatNodes: ChatNode[]): TreeNode[] => {
    return chatNodes.map(node => ({
      id: node.id,
      parentId: node.parentId,
      depth: node.depth,
      children: [], // Will be populated by layout engine
    }))
  }, [])

  // Convert chat nodes to React Flow nodes and edges with balanced layout
  useEffect(() => {
    if (!chatNodes || chatNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    console.log(`🌳 CompactTreeView: Processing ${chatNodes.length} nodes`)

    try {
      // Convert to tree nodes
      const treeNodes = convertToTreeNodes(chatNodes)
      
      // Calculate positions using compact layout
      const positions = layoutEngine.calculateLayout(treeNodes)

      console.log(`📍 Calculated positions for ${positions.size} nodes`)

      // Create React Flow nodes
      const reactFlowNodes: Node[] = []
      const nodeMap = new Map<string, ChatNode>()
      
      chatNodes.forEach(node => nodeMap.set(node.id, node))

      positions.forEach((position, nodeId) => {
        const chatNode = nodeMap.get(nodeId)
        if (!chatNode) return

        const isCurrentNode = nodeId === currentNodeId
        const subtreeWidth = layoutEngine.getSubtreeWidth(nodeId)

        reactFlowNodes.push({
          id: nodeId,
          type: 'message',
          position: { x: position.x, y: position.y },
          data: {
            node: chatNode,
            isCurrentNode,
            subtreeWidth,
            onNodeClick: onNodeClick,
            onBranchCreate,
          },
          draggable: false,
          selectable: true,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        })
      })

      // Create edges
      const reactFlowEdges: Edge[] = []
      chatNodes.forEach(node => {
        if (node.parentId) {
          const parentPos = positions.get(node.parentId)
          const childPos = positions.get(node.id)
          
          if (parentPos && childPos) {
            reactFlowEdges.push({
              id: `${node.parentId}-${node.id}`,
              source: node.parentId,
              target: node.id,
              type: 'smoothstep',
              animated: false,
              style: { 
                stroke: isCurrentPath(node.id, currentNodeId, chatNodes) ? '#3b82f6' : '#e5e7eb',
                strokeWidth: isCurrentPath(node.id, currentNodeId, chatNodes) ? 3 : 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: isCurrentPath(node.id, currentNodeId, chatNodes) ? '#3b82f6' : '#e5e7eb',
              },
            })
          }
        }
      })

      setNodes(reactFlowNodes)
      setEdges(reactFlowEdges)

      // Debug information
      if (showDebugInfo) {
        console.log('🔍 Compact Layout Debug Info:')
        console.table(Array.from(positions.entries()).map(([id, pos]) => ({
          nodeId: id.slice(-8),
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          subtreeWidth: Math.round(pos.subtreeWidth),
          prompt: nodeMap.get(id)?.prompt?.slice(0, 30) + '...' || 'N/A'
        })))

        // Make debug data globally accessible
        ;(window as any).compactTreeDebugData = {
          positions: Array.from(positions.entries()),
          nodeCount: reactFlowNodes.length,
          edgeCount: reactFlowEdges.length,
          config: layoutEngine.getConfig(),
        }
      }

    } catch (error) {
      console.error('❌ Error in BalancedTreeView layout calculation:', error)
      setNodes([])
      setEdges([])
    }
  }, [chatNodes, currentNodeId, layoutEngine, convertToTreeNodes, onNodeClick, onBranchCreate, showDebugInfo])

  // Check if a node is in the current path
  const isCurrentPath = useCallback((nodeId: string, currentNodeId: string | undefined, nodes: ChatNode[]): boolean => {
    if (!currentNodeId) return false
    
    const nodeMap = new Map<string, ChatNode>()
    nodes.forEach(node => nodeMap.set(node.id, node))
    
    // Build path from current node to root
    const currentPath = new Set<string>()
    let current: ChatNode | undefined = nodeMap.get(currentNodeId)
    
    while (current) {
      currentPath.add(current.id)
      current = current.parentId ? nodeMap.get(current.parentId) : undefined
    }
    
    return currentPath.has(nodeId)
  }, [])



  const fitViewOptions = useMemo(() => ({
    padding: 0.2,
    includeHiddenNodes: false,
    minZoom: 0.1,
    maxZoom: 1.5,
  }), [])

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={fitViewOptions}
        attributionPosition="bottom-left"
        className="bg-gray-50"
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
        <Controls showInteractive={false} />
        <MiniMap 
          nodeStrokeColor="#374151"
          nodeColor="#f3f4f6"
          nodeBorderRadius={8}
          maskColor="rgba(0,0,0,0.1)"
          position="top-right"
        />
        
        {/* Debug Control Panel */}
        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-3 border">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Compact Layout</div>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showDebugInfo}
                onChange={(e) => setShowDebugInfo(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Debug Info</span>
            </label>
            
            {showDebugInfo && (
              <div className="text-xs text-gray-500 space-y-1 border-t pt-2">
                <div>Nodes: {nodes.length}</div>
                <div>Edges: {edges.length}</div>
                <div>Layout: Compact</div>
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

// Test data generator for development
export function generateCompactTestData(): ChatNode[] {
  const nodes: ChatNode[] = []
  
  // Root node
  nodes.push({
    id: 'root-1',
    parentId: null,
    sessionId: 'test-session',
    model: 'openai/gpt-4o',
    systemPrompt: null,
    prompt: 'ホテル経営について教えてください',
    response: 'ホテル経営の基本について説明します...',
    status: 'completed',
    errorMessage: null,
    depth: 0,
    promptTokens: 50,
    responseTokens: 100,
    costUsd: 0.01,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  })
  
  // Child A with 5 grandchildren (unbalanced)
  nodes.push({
    id: 'child-a',
    parentId: 'root-1',
    sessionId: 'test-session',
    model: 'openai/gpt-4o',
    systemPrompt: null,
    prompt: '顧客サービスについて詳しく',
    response: '顧客サービスの詳細について...',
    status: 'completed',
    errorMessage: null,
    depth: 1,
    promptTokens: 40,
    responseTokens: 80,
    costUsd: 0.008,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:01:00Z'),
    updatedAt: new Date('2024-01-01T10:01:00Z'),
  })
  
  // Child B with 1 grandchild
  nodes.push({
    id: 'child-b',
    parentId: 'root-1',
    sessionId: 'test-session',
    model: 'anthropic/claude-3.5-sonnet',
    systemPrompt: null,
    prompt: '運営効率について',
    response: '運営効率の改善方法...',
    status: 'completed',
    errorMessage: null,
    depth: 1,
    promptTokens: 35,
    responseTokens: 70,
    costUsd: 0.007,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:02:00Z'),
    updatedAt: new Date('2024-01-01T10:02:00Z'),
  })
  
  // Child C with no grandchildren
  nodes.push({
    id: 'child-c',
    parentId: 'root-1',
    sessionId: 'test-session',
    model: 'google/gemini-pro',
    systemPrompt: null,
    prompt: '財務管理について',
    response: '財務管理のポイント...',
    status: 'completed',
    errorMessage: null,
    depth: 1,
    promptTokens: 30,
    responseTokens: 60,
    costUsd: 0.005,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:03:00Z'),
    updatedAt: new Date('2024-01-01T10:03:00Z'),
  })
  
  // 5 grandchildren under Child A
  for (let i = 1; i <= 5; i++) {
    nodes.push({
      id: `grandchild-a-${i}`,
      parentId: 'child-a',
      sessionId: 'test-session',
      model: 'openai/gpt-4o',
      systemPrompt: null,
      prompt: `顧客サービスの詳細 ${i}`,
      response: `詳細な回答 ${i}...`,
      status: 'completed',
      errorMessage: null,
      depth: 2,
      promptTokens: 25,
      responseTokens: 50,
      costUsd: 0.004,
      temperature: null,
      maxTokens: null,
      topP: null,
      metadata: {},
      createdAt: new Date(`2024-01-01T10:0${3 + i}:00Z`),
      updatedAt: new Date(`2024-01-01T10:0${3 + i}:00Z`),
    })
  }
  
  // 1 grandchild under Child B
  nodes.push({
    id: 'grandchild-b-1',
    parentId: 'child-b',
    sessionId: 'test-session',
    model: 'anthropic/claude-3.5-sonnet',
    systemPrompt: null,
    prompt: '運営効率の具体例',
    response: '具体的な効率化手法...',
    status: 'completed',
    errorMessage: null,
    depth: 2,
    promptTokens: 30,
    responseTokens: 60,
    costUsd: 0.006,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:09:00Z'),
    updatedAt: new Date('2024-01-01T10:09:00Z'),
  })
  
  return nodes
}

/**
 * SymmetricTreeLayout - Advanced tree layout algorithm for balanced visual presentation
 * Handles unbalanced sibling nodes while maintaining visual symmetry
 */

export type LayoutMode = 'symmetric' | 'compact' | 'distributed'

export interface NodePosition {
  id: string
  x: number
  y: number
  width: number
  subtreeWidth: number
}

export interface LayoutConfig {
  mode: LayoutMode
  horizontalSpacing: number
  verticalSpacing: number
  nodeWidth: number
  minSubtreeSpacing: number
}

export interface TreeNode {
  id: string
  parentId: string | null
  depth: number
  children: TreeNode[]
}

export class SymmetricTreeLayout {
  private config: LayoutConfig
  private positions: Map<string, NodePosition> = new Map()
  private subtreeWidths: Map<string, number> = new Map()

  constructor(config: LayoutConfig) {
    this.config = config
  }

  /**
   * Calculate positions for all nodes in the tree
   */
  calculateLayout(nodes: TreeNode[]): Map<string, NodePosition> {
    this.positions.clear()
    this.subtreeWidths.clear()

    if (nodes.length === 0) return this.positions

    // Build tree structure
    const nodeMap = new Map<string, TreeNode>()
    const rootNodes: TreeNode[] = []

    nodes.forEach(node => {
      nodeMap.set(node.id, node)
      if (!node.parentId) {
        rootNodes.push(node)
      }
    })

    // Build parent-child relationships
    nodes.forEach(node => {
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId)
        if (parent) {
          parent.children.push(node)
        }
      }
    })

    // Sort children by creation order (assuming ID contains timestamp info)
    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => a.id.localeCompare(b.id))
      node.children.forEach(sortChildren)
    }
    rootNodes.forEach(sortChildren)

    // Calculate subtree widths first (bottom-up)
    const calculateSubtreeWidths = (node: TreeNode): number => {
      if (node.children.length === 0) {
        const width = this.config.nodeWidth
        this.subtreeWidths.set(node.id, width)
        return width
      }

      // Calculate children subtree widths
      const childWidths = node.children.map(calculateSubtreeWidths)
      
      let subtreeWidth: number
      
      switch (this.config.mode) {
        case 'compact':
          // Compact mode: minimum spacing
          subtreeWidth = Math.max(
            this.config.nodeWidth,
            childWidths.reduce((sum, width) => sum + width, 0) + 
            (node.children.length - 1) * this.config.horizontalSpacing
          )
          break
          
        case 'distributed':
          // Distributed mode: maximum spacing for visual balance
          const maxChildWidth = Math.max(...childWidths)
          subtreeWidth = Math.max(
            this.config.nodeWidth,
            node.children.length * (maxChildWidth + this.config.minSubtreeSpacing)
          )
          break
          
        case 'symmetric':
        default:
          // Symmetric mode: balanced spacing considering visual weight
          const totalChildWidth = childWidths.reduce((sum, width) => sum + width, 0)
          const spacingNeeded = (node.children.length - 1) * this.config.horizontalSpacing
          const balanceFactor = this.calculateBalanceFactor(childWidths)
          
          subtreeWidth = Math.max(
            this.config.nodeWidth,
            totalChildWidth + spacingNeeded * balanceFactor
          )
          break
      }

      this.subtreeWidths.set(node.id, subtreeWidth)
      return subtreeWidth
    }

    rootNodes.forEach(calculateSubtreeWidths)

    // Position nodes (top-down)
    this.positionRootNodes(rootNodes)
    rootNodes.forEach(root => this.positionSubtree(root))

    return this.positions
  }

  /**
   * Calculate balance factor based on child width distribution
   */
  private calculateBalanceFactor(childWidths: number[]): number {
    if (childWidths.length <= 1) return 1.0

    // Calculate coefficient of variation to measure imbalance
    const mean = childWidths.reduce((sum, w) => sum + w, 0) / childWidths.length
    const variance = childWidths.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / childWidths.length
    const cv = Math.sqrt(variance) / mean

    // Higher imbalance requires more spacing for visual balance
    return 1.0 + Math.min(cv * 2, 1.5) // Cap at 2.5x spacing
  }

  /**
   * Position root nodes with symmetric distribution
   */
  private positionRootNodes(rootNodes: TreeNode[]): void {
    if (rootNodes.length === 0) return

    if (rootNodes.length === 1) {
      // Single root: center at origin
      const root = rootNodes[0]
      const subtreeWidth = this.subtreeWidths.get(root.id) || this.config.nodeWidth
      
      this.positions.set(root.id, {
        id: root.id,
        x: 0,
        y: 0,
        width: this.config.nodeWidth,
        subtreeWidth
      })
      return
    }

    // Multiple roots: distribute symmetrically
    const rootWidths = rootNodes.map(node => this.subtreeWidths.get(node.id) || this.config.nodeWidth)
    const positions = this.calculateChildPositions(0, rootWidths, this.config.minSubtreeSpacing)

    rootNodes.forEach((node, index) => {
      this.positions.set(node.id, {
        id: node.id,
        x: positions[index],
        y: 0,
        width: this.config.nodeWidth,
        subtreeWidth: rootWidths[index]
      })
    })
  }

  /**
   * Position a subtree recursively
   */
  private positionSubtree(node: TreeNode): void {
    const nodePos = this.positions.get(node.id)
    if (!nodePos || node.children.length === 0) return

    const childWidths = node.children.map(child => this.subtreeWidths.get(child.id) || this.config.nodeWidth)
    
    if (node.children.length === 1) {
      // Single child: center under parent
      const child = node.children[0]
      const childWidth = childWidths[0]
      
      this.positions.set(child.id, {
        id: child.id,
        x: nodePos.x, // Center under parent
        y: nodePos.y + this.config.verticalSpacing,
        width: this.config.nodeWidth,
        subtreeWidth: childWidth
      })
    } else {
      // Multiple children: distribute based on their subtree widths
      const childPositions = this.calculateChildPositions(
        nodePos.x, 
        childWidths, 
        this.config.horizontalSpacing
      )

      node.children.forEach((child, index) => {
        this.positions.set(child.id, {
          id: child.id,
          x: childPositions[index],
          y: nodePos.y + this.config.verticalSpacing,
          width: this.config.nodeWidth,
          subtreeWidth: childWidths[index]
        })
      })
    }

    // Recursively position children
    node.children.forEach(child => this.positionSubtree(child))
  }

  /**
   * Calculate optimal positions for children based on their subtree widths
   * This is the core algorithm for beautiful unbalanced tree layout
   */
  calculateChildPositions(parentX: number, childWidths: number[], minSpacing: number): number[] {
    if (childWidths.length === 0) return []
    if (childWidths.length === 1) return [parentX]

    switch (this.config.mode) {
      case 'compact':
        return this.calculateCompactPositions(parentX, childWidths, minSpacing)
      case 'distributed':
        return this.calculateDistributedPositions(parentX, childWidths, minSpacing)
      case 'symmetric':
      default:
        return this.calculateSymmetricPositions(parentX, childWidths, minSpacing)
    }
  }

  /**
   * Compact positioning: minimize total width
   */
  private calculateCompactPositions(parentX: number, childWidths: number[], minSpacing: number): number[] {
    const totalWidth = childWidths.reduce((sum, w) => sum + w, 0) + (childWidths.length - 1) * minSpacing
    const startX = parentX - totalWidth / 2

    const positions: number[] = []
    let currentX = startX

    childWidths.forEach(width => {
      positions.push(currentX + width / 2)
      currentX += width + minSpacing
    })

    return positions
  }

  /**
   * Distributed positioning: equal spacing regardless of subtree size
   */
  private calculateDistributedPositions(parentX: number, childWidths: number[], minSpacing: number): number[] {
    const maxWidth = Math.max(...childWidths)
    const totalWidth = childWidths.length * (maxWidth + minSpacing) - minSpacing
    const startX = parentX - totalWidth / 2

    return childWidths.map((_, index) => 
      startX + index * (maxWidth + minSpacing) + maxWidth / 2
    )
  }

  /**
   * Symmetric positioning: weighted by subtree size for visual balance
   */
  private calculateSymmetricPositions(parentX: number, childWidths: number[], minSpacing: number): number[] {
    // Calculate weighted spacing based on subtree widths
    const totalWeight = childWidths.reduce((sum, w) => sum + w, 0)
    const positions: number[] = []

    if (totalWeight === 0) {
      // Fallback to equal spacing
      const spacing = minSpacing
      const totalWidth = (childWidths.length - 1) * spacing
      const startX = parentX - totalWidth / 2

      return childWidths.map((_, index) => startX + index * spacing)
    }

    // Calculate cumulative positions based on weights
    const weightedSpacing = Math.max(minSpacing, totalWeight / childWidths.length * 0.8)
    const totalWidth = (childWidths.length - 1) * weightedSpacing
    const startX = parentX - totalWidth / 2

    // Adjust positions to account for subtree width influence
    let currentX = startX
    const balanceFactor = this.calculateBalanceFactor(childWidths)

    childWidths.forEach((width, index) => {
      if (index === 0) {
        positions.push(currentX)
      } else {
        const prevWidth = childWidths[index - 1]
        const avgWidth = (width + prevWidth) / 2
        const dynamicSpacing = Math.max(
          minSpacing, 
          weightedSpacing * (avgWidth / (totalWeight / childWidths.length)) * balanceFactor
        )
        currentX += dynamicSpacing
        positions.push(currentX)
      }
    })

    // Center the entire group under parent
    const actualCenter = (positions[0] + positions[positions.length - 1]) / 2
    const offset = parentX - actualCenter

    return positions.map(pos => pos + offset)
  }

  /**
   * Get the total width of a subtree
   */
  getSubtreeWidth(nodeId: string): number {
    return this.subtreeWidths.get(nodeId) || this.config.nodeWidth
  }

  /**
   * Update layout mode and recalculate
   */
  setLayoutMode(mode: LayoutMode): void {
    this.config.mode = mode
  }

  /**
   * Get current layout configuration
   */
  getConfig(): LayoutConfig {
    return { ...this.config }
  }
}

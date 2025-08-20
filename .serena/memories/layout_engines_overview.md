# Tree Layout Engines Overview (2025-08-19)

## Current Layout Engines

The Diverge application now supports two distinct layout engines for tree visualization, each optimized for different use cases.

### 1. Legacy Layout Engine
**Status**: Alternative option
**Location**: `src/components/tree/chat-tree-view.tsx` (main implementation)

**Characteristics**:
- Original implementation with dynamic spacing
- Extensive debug output and overlap detection
- 450px horizontal spacing, 400px vertical spacing
- Best for debugging and development
- Comprehensive coordinate logging

**When to Use**:
- Debugging layout issues
- Need detailed position information
- Testing edge cases
- Large spacing requirements

### 2. Compact Layout Engine
**Status**: Default (enabled by default)
**Location**: `src/components/tree/BalancedTreeView.tsx` + `CompactTreeLayout.ts`

**Characteristics**:
- Space-efficient algorithm
- 250px horizontal spacing, 350px vertical spacing
- Optimized for unbalanced trees
- Minimal width presentation
- Clean, professional appearance

**When to Use**:
- Production environments
- Limited screen space
- Unbalanced tree structures
- Better user experience

## Switching Between Engines

### UI Toggle
Located in top-right panel of tree view:
- **Compact ✨**: Default, space-efficient layout
- **Legacy**: Original layout with extensive debugging

### Code Level
```typescript
// In ChatTreeView component
const [useCompactLayout, setUseCompactLayout] = useState(true) // true for Compact, false for Legacy
```

## Comparison Table

| Feature | Legacy Layout | Compact Layout |
|---------|--------------|----------------|
| **Default** | No | Yes |
| **Horizontal Spacing** | 450px | 250px |
| **Vertical Spacing** | 400px | 350px |
| **Space Efficiency** | Lower | 30-40% better |
| **Debug Output** | Extensive | Moderate |
| **Overlap Detection** | 15 iterations | Built-in prevention |
| **Best For** | Development | Production |
| **Unbalanced Trees** | Good | Excellent |
| **Performance** | Good | Better |
| **Node Width** | Variable | 280px fixed |

## Technical Architecture

### Component Hierarchy
```
ChatTreeView (main component)
├── Legacy Layout (inline implementation)
│   ├── Dynamic spacing calculation
│   ├── Overlap resolution
│   └── Debug output
└── Compact Layout (CompactTreeView)
    ├── CompactTreeLayout class
    ├── Subtree width calculation
    └── Minimal width positioning
```

### Data Flow
1. **Input**: Array of ChatNode objects
2. **Processing**: Layout engine calculates positions
3. **Output**: React Flow nodes and edges
4. **Rendering**: React Flow handles visualization

## Layout Algorithm Differences

### Legacy Algorithm
1. Groups nodes by depth
2. Groups by parent at each depth
3. Calculates dynamic spacing based on children
4. Resolves overlaps iteratively (up to 15 times)
5. Attempts to re-center after overlap resolution
6. Extensive logging at each step

### Compact Algorithm
1. Builds tree structure from flat array
2. Calculates subtree widths (bottom-up)
3. Positions nodes (top-down)
4. Uses minimum necessary spacing
5. No overlap possible by design
6. Single-pass positioning

## Debug Capabilities

### Legacy Layout Debug
```javascript
window.treeDebugData = {
  totalNodes, totalDepths,
  nodesByDepth, overlaps,
  spacingAnalysis
}
```

### Compact Layout Debug
```javascript
window.compactTreeDebugData = {
  positions, nodeCount,
  edgeCount, config
}
```

## Performance Metrics

### Legacy Layout
- **Calculation Time**: O(n * iterations) worst case
- **Memory Usage**: Higher due to debug data
- **Render Time**: Standard React Flow performance

### Compact Layout
- **Calculation Time**: O(n) single pass
- **Memory Usage**: Lower, minimal debug data
- **Render Time**: Slightly faster due to fewer nodes in view

## File Structure

```
src/components/tree/
├── chat-tree-view.tsx         # Main component with Legacy layout
├── BalancedTreeView.tsx       # Compact layout component
├── CompactTreeLayout.ts       # Compact layout algorithm
├── message-node.tsx           # Node rendering component
└── SymmetricTreeLayout.ts     # (Deprecated, replaced by CompactTreeLayout)
```

## Migration Path

### From Legacy to Compact
1. No code changes required (Compact is default)
2. Users can toggle via UI if needed
3. Debug data structure differs slightly

### From Balanced to Compact
1. "Balanced" renamed to "Compact" in UI
2. Algorithm completely replaced
3. Better space efficiency maintained

## Best Practices

### For Development
1. Use Legacy layout for debugging
2. Enable extensive logging
3. Check window.treeDebugData for issues
4. Test with various tree structures

### For Production
1. Use Compact layout (default)
2. Disable debug info for performance
3. Monitor for edge cases
4. Collect user feedback on layout

## Future Roadmap

### Short Term (Q1 2025)
- Mobile-responsive layout engine
- Collapsible branch support
- Performance optimizations for 1000+ nodes

### Medium Term (Q2 2025)
- Radial layout option
- Force-directed layout for exploration
- Custom layout plugins API

### Long Term (Q3-Q4 2025)
- 3D tree visualization
- VR/AR support
- AI-assisted layout optimization
- Real-time collaborative viewing

## Testing Guidelines

### Layout Testing Checklist
- [ ] Single root node
- [ ] Multiple root nodes
- [ ] Deep hierarchy (10+ levels)
- [ ] Wide hierarchy (20+ siblings)
- [ ] Unbalanced tree (varying children)
- [ ] Empty tree
- [ ] Single branch (linear)
- [ ] Performance with 100+ nodes
- [ ] Performance with 500+ nodes
- [ ] Layout switching stability

## Troubleshooting

### Common Issues

1. **Overlapping Nodes**
   - Switch to Legacy layout
   - Check debug output for overlap detection
   - Adjust spacing parameters if needed

2. **Performance Issues**
   - Use Compact layout
   - Disable debug information
   - Consider pagination for large trees

3. **Layout Not Updating**
   - Check React Flow node keys
   - Verify useEffect dependencies
   - Clear and rebuild layout

4. **Incorrect Positioning**
   - Verify parent-child relationships
   - Check depth calculations
   - Review coordinate debug data
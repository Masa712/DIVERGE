# Branching Feature Implementation Details (2025-08-15)

## Architecture Overview

### Data Flow
```
User Input → Branch API → Create Node → Update Tree → Refresh UI
                ↓
         Context Building
                ↓
         OpenRouter API
```

## Implemented Components

### 1. Database Layer

#### Function: `get_node_ancestors`
- **Location**: `supabase/migrations/002_add_ancestor_function.sql`
- **Purpose**: Efficiently retrieve all ancestor nodes using recursive CTE
- **Performance**: O(depth) complexity
- **Usage**: Context reconstruction for AI prompts

### 2. API Layer

#### Endpoint: `/api/chat/branch/route.ts`
- **Method**: POST
- **Required Fields**:
  ```typescript
  {
    parentNodeId: string
    prompt: string
    model: ModelId
    systemPrompt?: string
  }
  ```
- **Process**:
  1. Validate parent node exists
  2. Build context from ancestors
  3. Create new node with pending status
  4. Send to OpenRouter
  5. Update node with response

### 3. Database Operations

#### Module: `src/lib/db/chat-nodes.ts`
- **Key Functions**:
  - `createChatNode()`: Creates new branch node
  - `updateChatNode()`: Updates with AI response
  - `getChatNodeWithAncestors()`: Retrieves full context
  - `buildContextFromNodes()`: Constructs message array

- **Type Conversions**:
  - Consistent snake_case → camelCase mapping
  - Null handling for optional fields
  - Date object conversions

### 4. UI Components

#### ChatTreeView (`src/components/tree/chat-tree-view.tsx`)
- **Layout Algorithm**:
  - Two-pass positioning system
  - First pass: Basic grid layout
  - Second pass: Center parents above children
  - Overlap detection and warnings

- **Edge Validation**:
  ```typescript
  // Only create edges for valid parent references
  .filter(node => node.parentId && nodeMap.has(node.parentId))
  ```

#### MessageNode (`src/components/tree/message-node.tsx`)
- **Branch UI** (Partial):
  - State management for branch input
  - ESC key handling
  - Visual feedback for branching

## Pending Implementation

### 1. Branch Creation UI
```typescript
// TODO: Add to MessageNode
<button onClick={() => setShowBranchDialog(true)}>
  <GitBranch className="w-4 h-4" />
  Create Branch
</button>
```

### 2. Branch Dialog Component
```typescript
// TODO: Create BranchDialog component
interface BranchDialogProps {
  parentNode: ChatNode
  onSubmit: (prompt: string, model: ModelId) => void
  onCancel: () => void
}
```

### 3. Real-time Tree Updates
```typescript
// TODO: Add WebSocket or polling
useEffect(() => {
  const interval = setInterval(() => {
    fetchUpdatedNodes()
  }, 5000)
  return () => clearInterval(interval)
}, [])
```

## Error Handling

### Current Implementation
- Parent node validation
- Type checking for database operations
- Network error catching in API calls
- Fallback for missing ancestors

### Needed Improvements
- User-friendly error messages
- Retry mechanism for failed branches
- Conflict resolution for concurrent edits

## Testing Checklist

### Completed ✅
- [x] Database function creation
- [x] API endpoint basic functionality
- [x] Tree visualization
- [x] Node selection and navigation

### Pending ⏳
- [ ] Branch creation from UI
- [ ] Multiple branch management
- [ ] Context size limits
- [ ] Performance with 100+ nodes

## Known Issues

1. **Branch UI**: Button exists but not connected to API
2. **Model Selection**: Not integrated with branch creation
3. **Context Limits**: No token counting/pruning
4. **Concurrent Edits**: No optimistic locking

## Configuration

### Environment Variables
```env
OPENROUTER_API_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### Model Configuration
- Default: `openai/gpt-4o`
- Available: All OpenRouter models
- Per-branch model selection supported

## Next Implementation Steps

1. **Connect UI to API** (2-3 hours)
   - Wire MessageNode branch button
   - Create dialog component
   - Handle submission

2. **Improve Context Management** (3-4 hours)
   - Add token counting
   - Implement pruning strategy
   - Add caching layer

3. **Enhanced Navigation** (2-3 hours)
   - Add breadcrumb navigation
   - Implement tree search
   - Add node filtering
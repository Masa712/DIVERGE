# ノード削除機能とポーリング改善

## 実装概要
ユーザー任意でのノード削除機能を実装し、リトライ機能でのノード復活バグを修正。子ノードを持たないノードのみ削除可能とし、ポーリング時の不整合問題を解決。

## 主要機能

### 1. ユーザー任意ノード削除機能
**ファイル**: `src/components/chat/node-detail-sidebar.tsx`

- **削除条件**: 子ノードが存在しない場合のみ削除可能
- **UI配置**: 右サイドバー最下部にTrash2アイコン付き削除ボタン
- **安全対策**: 確認ダイアログによる誤操作防止

```typescript
// 子ノード存在チェック
const hasChildren = useCallback((nodeId: string) => {
  return allNodes.some(node => node.parentId === nodeId)
}, [allNodes])

const canDeleteCurrentNode = currentDisplayNode && !hasChildren(currentDisplayNode.id)

// 削除ボタン（子ノードがない場合のみ表示）
{canDeleteCurrentNode && (
  <div className="pt-4 border-t border-white/20">
    <button
      onClick={() => {
        if (window.confirm('Are you sure you want to delete this node? This action cannot be undone.')) {
          onDeleteNode?.(currentDisplayNode.id)
        }
      }}
      className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
    >
      <Trash2 className="w-4 h-4" />
      <span>Delete Node</span>
    </button>
  </div>
)}
```

### 2. セキュアな削除API改善
**ファイル**: `src/app/api/nodes/[id]/route.ts`

**修正された問題**:
- データベースフィールド名の不一致（`parent_node_id` → `parent_id`）
- JOINクエリの複雑さによるエラー
- 不十分なデバッグ情報

```typescript
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  // ノード存在確認
  const { data: nodeData, error: nodeError } = await supabase
    .from('chat_nodes')
    .select('id, session_id')
    .eq('id', nodeId)
    .single()

  // セッション所有権確認
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', nodeData.session_id)
    .single()

  // 子ノード存在チェック（削除防止）
  const { data: childNodes } = await supabase
    .from('chat_nodes')
    .select('id')
    .eq('parent_id', nodeId)
    .limit(1)

  if (childNodes && childNodes.length > 0) {
    return NextResponse.json({ error: 'Cannot delete node with child nodes' }, { status: 400 })
  }

  // 安全な削除実行
  await supabase.from('chat_nodes').delete().eq('id', nodeId)
}
```

### 3. 削除ハンドラーの実装
**ファイル**: `src/app/chat/page.tsx`, `src/app/chat/[id]/page.tsx`

```typescript
const handleDeleteNode = async (nodeId: string) => {
  // フロントエンドでの子ノード存在チェック（安全対策）
  const hasChildren = chatNodes.some(node => node.parentId === nodeId)
  if (hasChildren) {
    showError('Cannot delete node with child nodes')
    return
  }

  const response = await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' })
  
  if (response.ok) {
    // UIからノード削除
    setChatNodes(prev => prev.filter(node => node.id !== nodeId))
    
    // サイドバー状態管理
    if (selectedNodeForDetail?.id === nodeId) {
      setIsSidebarOpen(false)
      setSelectedNodeForDetail(null)
    }
    
    // 現在ノードの切り替え
    if (currentNodeId === nodeId) {
      const remainingNodes = chatNodes.filter(node => node.id !== nodeId)
      setCurrentNodeId(remainingNodes.length > 0 ? remainingNodes[remainingNodes.length - 1].id : undefined)
    }
  }
}
```

### 4. ポーリング機能の重大バグ修正
**問題**: リトライ機能で削除した失敗ノードがポーリング完了時に復活

**原因**: `setChatNodes(updatedNodes)` でサーバーの全ノードデータで上書き

**修正**: 特定ノードのみ更新する方式に変更

```typescript
// 修正前（問題のあるコード）
if (updatedNode && updatedNode.status !== 'streaming') {
  setChatNodes(updatedNodes) // 全ノードを上書き → 削除したノードが復活
  return
}

// 修正後（安全なコード）
if (updatedNode && updatedNode.status !== 'streaming') {
  setChatNodes(prev => {
    // 削除されたノードの存在チェック
    const nodeExists = prev.some(node => node.id === nodeId)
    if (!nodeExists) {
      console.log(`Node ${nodeId} was deleted locally, skipping update`)
      return prev // 削除されたノードは更新しない
    }
    
    // 特定ノードのみ更新
    return prev.map(node => 
      node.id === nodeId ? updatedNode : node
    )
  })
  return
}
```

## 技術的改善

### セキュリティ強化
- ユーザー認証・認可による安全な削除
- 子ノード存在チェックによる整合性保護
- フロントエンド・バックエンド両方での検証

### UX改善
- 削除不可能なノードでは削除ボタン非表示
- 確認ダイアログによる誤操作防止
- 削除後の適切な状態管理（サイドバー、現在ノード）

### バグ修正
- データベースフィールド名の正確な使用
- ポーリング時の状態不整合問題の根本的解決
- デバッグ情報の充実化

## 動作フロー

### 通常の削除
1. 子ノード存在チェック → ボタン表示/非表示
2. 削除ボタンクリック → 確認ダイアログ
3. API呼び出し → セキュリティ検証 → DB削除
4. UI更新 → ノード除去、状態管理

### リトライ機能での削除
1. 失敗ノードをDB・UIから削除
2. 新ノード作成・ポーリング開始
3. ポーリング完了 → **削除ノードの存在チェック**
4. 削除済みノードは更新スキップ → **復活防止**

## 今後の改善可能性
- バッチ削除機能（複数ノード一括削除）
- 削除履歴・アンドゥ機能
- カスケード削除オプション（子ノードも一括削除）
- 削除権限のきめ細かい制御
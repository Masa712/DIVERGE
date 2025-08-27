# リトライ機能の実装 - 失敗ノードの再生成機能

## 実装概要
ネットワークエラーやAPI障害により生成が失敗したノードに対して、ユーザーが簡単にリトライできる機能を実装。失敗したノードは削除され、新しいノードで再生成を行う。

## 主要機能

### 1. 失敗ノード検出とUI表示
**ファイル**: `src/components/chat/node-detail-sidebar.tsx`

- **失敗状態の視覚化**: `status === 'failed'` の場合に専用UIを表示
- **エラーメッセージ表示**: `errorMessage`がある場合は赤色で詳細を表示
- **リトライボタン**: RefreshCwアイコンと「Retry」テキストを含む青色ボタン

```typescript
{currentDisplayNode.status === 'failed' ? (
  <div className="py-4 flex flex-col items-center space-y-3">
    <div className="flex items-center space-x-2 text-red-600">
      <span className="text-sm">Generation failed</span>
    </div>
    {currentDisplayNode.errorMessage && (
      <p className="text-xs text-red-500 text-center">
        {currentDisplayNode.errorMessage}
      </p>
    )}
    <button
      onClick={() => onRetryNode?.(currentDisplayNode.id, currentDisplayNode.prompt)}
      className="flex items-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
    >
      <RefreshCw className="w-4 h-4" />
      <span>Retry</span>
    </button>
  </div>
) : ...
```

### 2. リトライ処理の実装
**ファイル**: `src/app/chat/page.tsx`, `src/app/chat/[id]/page.tsx`

**リトライ機能の特徴**:
- 失敗したノードと同じ親ノードを使用
- 元のプロンプトと同じモデルで再試行
- 失敗したノードは自動削除
- 新しいノードを作成して右サイドバーに表示

```typescript
const handleRetryNode = async (nodeId: string, originalPrompt: string) => {
  // 失敗したノードから親とモデル情報を取得
  const failedNode = chatNodes.find(node => node.id === nodeId)
  const parentNode = failedNode.parentId ? chatNodes.find(node => node.id === failedNode.parentId) : null
  
  // 新しいノード作成API呼び出し
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: originalPrompt }],
      model: failedNode.model,
      sessionId: session.id,
      parentNodeId: parentNode?.id,
      useEnhancedContext: true,
    }),
  })
  
  if (response.ok) {
    // 失敗したノードを削除
    await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' })
    
    // UIを更新: 失敗ノード除去 + 新ノード追加
    setChatNodes(prev => {
      const filteredNodes = prev.filter(node => node.id !== nodeId)
      return [...filteredNodes, newNode]
    })
  }
}
```

### 3. ノード削除API
**ファイル**: `src/app/api/nodes/[id]/route.ts` (新規作成)

**セキュリティ機能**:
- ユーザー認証の確認
- ノード所有権の検証（他のユーザーのノードは削除不可）
- セッション経由での権限チェック

```typescript
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // ノードの存在確認と所有者検証
  const { data: nodeData } = await supabase
    .from('chat_nodes')
    .select('id, session_id, sessions!inner(user_id)')
    .eq('id', nodeId)
    .single()
    
  // 所有者確認
  if (nodeData.sessions.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  
  // 安全な削除処理
  const { error } = await supabase.from('chat_nodes').delete().eq('id', nodeId)
  return NextResponse.json({ success: true })
}
```

### 4. Props拡張
**NodeDetailSidebar コンポーネント**:
```typescript
interface Props {
  // 既存props...
  onRetryNode?: (nodeId: string, prompt: string) => void  // 新規追加
}
```

## 動作フロー

### 通常の失敗パターン
1. ユーザーが質問を送信
2. AI生成中にネットワークエラー発生
3. ノードのステータスが`failed`に変更
4. 右サイドバーに「Generation failed」とリトライボタン表示

### リトライ実行時
1. ユーザーがリトライボタンをクリック
2. **失敗したノードをデータベース・UIから削除**
3. 元のプロンプト・モデル・親ノードで新しいリクエスト送信
4. 新しいノードが作成され、右サイドバーに自動表示
5. ストリーミング開始（通常の生成フローと同じ）

## エラーハンドリング
- データベース削除失敗時もUI更新は継続
- ネットワークエラー時の適切なエラーメッセージ表示
- コンソールログによるデバッグ支援

## 技術的考慮事項
- **クリーンなツリー構造**: 失敗ノードが履歴に残らない
- **セキュアな削除**: 認証・認可による安全な削除処理
- **シームレスなUX**: リトライ後は通常の生成フローと同じ体験
- **非同期処理**: 削除とUI更新の適切な順序制御

## 今後の改善可能性
- リトライ回数の制限機能
- 失敗原因別のリトライ戦略
- バッチ削除機能（複数失敗ノード一括処理）
- リトライ履歴の記録機能
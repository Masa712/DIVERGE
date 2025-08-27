# UI/UX Improvements: ノードセンタリングと右サイドバー機能強化

## 実装概要
ユーザーエクスペリエンスの向上を目的として、新規ノード作成時の自動センタリング機能と右サイドバーの自動表示機能を実装。

## 主要機能

### 1. 動的センタリング機能
**ファイル**: `src/components/tree/BalancedTreeView.tsx`

- **レスポンシブ対応**: 画面サイズに応じたセンタリング位置の動的計算
- **モバイル/タブレット**: シンプルな中央配置（768px未満: 50px調整、768-1024px: 75px調整）
- **デスクトップ**: サイドバー状態を考慮した複雑な計算
  - 左サイドバー状態（展開256px/折りたたみ64px）
  - 右サイドバー状態（開閉とその幅）
  - 左サイドバー折りたたみ時の特別調整（+320px補正）

```typescript
const calculateCenteringOffset = useCallback(() => {
  const screenWidth = window.innerWidth
  const isMobile = screenWidth < 768
  const isTablet = screenWidth >= 768 && screenWidth < 1024
  
  if (isMobile || isTablet) {
    // シンプルなモバイル対応
    const mobileAdjustment = isMobile ? 50 : 75
    xOffset += mobileAdjustment
  } else {
    // デスクトップ: 実際のコンテンツエリア中心を計算
    const availableWidth = screenWidth - leftSidebarWidth - rightSidebarWidth_actual
    const contentAreaCenterX = leftSidebarWidth + (availableWidth / 2)
    let centerAdjustment = contentAreaCenterX - screenWidth / 2
    
    if (isLeftSidebarCollapsed) {
      centerAdjustment += 320 // 折りたたみ時の特別調整
    }
  }
}, [isLeftSidebarCollapsed, isRightSidebarOpen, rightSidebarWidth])
```

### 2. 右サイドバー自動表示機能
**ファイル**: `src/app/chat/page.tsx`, `src/app/chat/[id]/page.tsx`

新規ノード作成時に自動的に右サイドバーが開き、ノード詳細を表示:
```typescript
// 新規ノード作成時の処理
setCurrentNodeId(newNode.id)
setSelectedNodeForDetail(newNode) // 自動でサイドバー対象に設定
setIsSidebarOpen(true) // サイドバーを自動的に開く
```

### 3. ストリーミングアニメーション改善
**ファイル**: `src/components/ui/streaming-animation.tsx`

- **配置変更**: 横並び → 縦並び（`flex-col space-y-1`）
- **アニメーション変更**: 中央伸縮 → 左から右への流れるアニメーション
- **幅拡張**: 8px → 16px（より視認性向上）

```css
@keyframes streamingLineLeftToRight {
  0% { transform: scaleX(0); transform-origin: left; opacity: 0.3; }
  70% { transform: scaleX(1); transform-origin: left; opacity: 1; }
  100% { transform: scaleX(0); transform-origin: left; opacity: 0; }
}
```

### 4. 右サイドバー AI Response強化
**ファイル**: `src/components/chat/node-detail-sidebar.tsx`

- **常時表示**: AI Responseセクションを条件に関係なく表示
- **状態別表示**:
  - `streaming`: 左配置のストリーミングアニメーション
  - `completed`: 生成された回答テキスト
  - `pending`: "Waiting for response..." 表示
- **自動更新**: `allNodes`の更新に連動して最新ノード情報を自動反映

```typescript
const currentDisplayNode = (() => {
  const chainNode = nodeChain[currentNodeIndex]
  if (!chainNode) return chainNode
  // 常に最新バージョンのノードを取得
  const latestNode = allNodes.find(n => n.id === chainNode.id)
  return latestNode || chainNode
})()
```

## Props拡張
各コンポーネントにサイドバー状態情報を追加:
- `isLeftSidebarCollapsed?: boolean`
- `isRightSidebarOpen?: boolean`  
- `rightSidebarWidth?: number`

## 技術的考慮事項
- ReactFlowのsetCenter APIを使用した滑らかなアニメーション（duration: 500-800ms）
- レスポンシブ対応によるマルチデバイス最適化
- リアルタイム更新によるシームレスなUX提供
- コンソールログによるデバッグ支援機能

## 今後の改善可能性
- 画面サイズ変更時のリアルタイム再計算
- ユーザー設定による調整値のカスタマイズ
- アニメーション速度・スタイルの設定可能化
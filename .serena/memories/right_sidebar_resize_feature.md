# 右サイドバーリサイズ機能実装

## Date: 2025-08-25

## Overview
右サイドバーにリサイズ機能を実装し、ユーザーが左端をドラッグすることでサイドバーの幅を調整できるようにしました。視覚的なハンドルは非表示とし、クリーンなデザインを維持しています。

## 主要な実装内容

### 1. リサイズ機能の基本設定
- **デフォルト幅**: 400px
- **最小幅**: 400px（変更後）
- **最大幅**: 800px
- **リサイズ方向**: 左端をドラッグして拡大縮小

### 2. 技術実装詳細

#### State管理
```typescript
const [width, setWidth] = useState(400) // Default width 400px (min 400px)
const [isResizing, setIsResizing] = useState(false)
const [rightSidebarWidth, setRightSidebarWidth] = useState(400)
```

#### リサイズハンドラー
```typescript
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  setIsResizing(true)
}, [])

const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!isResizing || typeof window === 'undefined') return
  
  const sidebarRightEdge = window.innerWidth - 30
  const newWidth = Math.max(400, Math.min(800, sidebarRightEdge - e.clientX))
  
  setWidth(newWidth)
  onWidthChange?.(newWidth)
}, [isResizing, onWidthChange])
```

### 3. 透明なリサイズエリア
- **視覚的なハンドルを削除**: ユーザーリクエストに基づく
- **透明なドラッグエリア**: 左端3pxの範囲
- **カーソル変化**: `cursor: ew-resize`でリサイズ可能を示唆
```tsx
<div 
  className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hidden lg:block z-10"
  onMouseDown={handleMouseDown}
/>
```

### 4. チャット入力エリアとの連携
- **動的な右マージン計算**: `rightSidebarWidth + 60px`
- **レスポンシブ対応**:
  - デスクトップ: 動的に計算された右マージン
  - タブレット/モバイル: 固定390px

#### GlassmorphismChatInputの更新
```typescript
const rightOffset = rightSidebarWidth + 60 // sidebar width + 30px margin + 30px padding

style={isRightSidebarOpen && typeof window !== 'undefined' && window.innerWidth >= 1024 ? {
  right: `${rightOffset}px`
} : isRightSidebarOpen ? {
  right: '390px' // Fixed width for tablet/mobile
} : undefined}
```

### 5. レスポンシブデザイン
- **デスクトップ (≥1024px)**: リサイズ機能有効
- **タブレット/モバイル (<1024px)**: リサイズ無効、固定幅

### 6. パフォーマンス最適化
- **トランジション制御**: リサイズ中はトランジションを無効化
```typescript
transition: isResizing ? 'none' : 'opacity 300ms, transform 300ms, scale 300ms'
```
- **useCallbackの使用**: 不要な再レンダリングを防止

## ファイル変更

### 更新されたファイル
- **src/components/chat/node-detail-sidebar.tsx**:
  - リサイズハンドラーの実装
  - 幅の状態管理
  - 透明なリサイズエリアの追加
  - `onWidthChange` propの追加

- **src/components/chat/glassmorphism-chat-input.tsx**:
  - `rightSidebarWidth` propの追加
  - 動的な右マージン計算
  - レスポンシブな位置調整

- **src/app/chat/page.tsx**:
  - `rightSidebarWidth`状態の管理
  - `onWidthChange`コールバックの接続

- **src/app/chat/[id]/page.tsx**:
  - 同様の更新（chat/page.tsxと同じ）

## イベントフロー
1. ユーザーが左端の透明エリアをマウスダウン
2. `isResizing`がtrueに設定
3. マウス移動でサイドバー幅を計算・更新
4. 親コンポーネントに幅の変更を通知
5. GlassmorphismChatInputが位置を自動調整
6. マウスアップでリサイズ終了

## 制約事項
- リサイズはデスクトップサイズ（lg: ≥1024px）でのみ有効
- 最小幅400px、最大幅800pxの制限
- リサイズ中はbodyのカーソルとユーザー選択を制御

## 状態
✅ リサイズ機能実装完了
✅ 透明なリサイズエリア実装完了
✅ 最小幅400pxに変更完了
✅ チャット入力エリアとの連携完了
✅ レスポンシブ対応完了
✅ パフォーマンス最適化完了
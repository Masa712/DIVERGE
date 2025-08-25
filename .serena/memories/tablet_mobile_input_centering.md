# タブレット/モバイルサイズでの入力エリア中央配置

## Date: 2025-08-25

## Overview
タブレットおよびモバイルサイズにおいて、GlassmorphismChatInputコンポーネントが左寄せになっていた問題を修正し、画面中央に配置されるよう改善しました。

## 問題点
- タブレットサイズ（768px-1023px）で入力エリアが画面左側に固定されていた
- 右サイドバー表示時の中央配置が機能していなかった
- レスポンシブレイアウトが期待通りに動作していなかった

## 実装内容

### 1. コンテナレベルの中央配置
```css
/* 外側のコンテナ */
left-1/2 -translate-x-1/2  /* モバイル中央配置 */
md:left-1/2 md:-translate-x-1/2  /* タブレット中央配置 */
lg:left-[124px/410px] lg:translate-x-0  /* デスクトップは固定位置 */
```

### 2. 右サイドバー表示時のレイアウト分離

#### デスクトップ版
```tsx
<div className="hidden lg:block w-full px-[30px]">
  <div className="max-w-4xl mx-auto">
    <div className="glass-test glass-blur rounded-2xl ...">
      {renderInputContent()}
    </div>
  </div>
</div>
```

#### タブレット/モバイル版
```tsx
<div className="block lg:hidden w-[90vw] max-w-4xl px-[30px]">
  <div className="glass-test glass-blur rounded-2xl ...">
    {renderInputContent()}
  </div>
</div>
```

### 3. デバッグログの追加
```typescript
if (typeof window !== 'undefined') {
  console.log('🔍 GlassmorphismChatInput render:', {
    isRightSidebarOpen,
    isLeftSidebarCollapsed,
    screenWidth: window.innerWidth,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isMobile: window.innerWidth < 768,
    containerClassName: containerClassName,
    rightOffset: rightOffset
  })
}
```

## レスポンシブ仕様

### デスクトップ (≥1024px)
- **配置**: 左サイドバーの右側に固定配置
- **右サイドバー表示時**: 動的な右マージン（rightSidebarWidth + 60px）
- **最大幅**: 制限なし（利用可能な全幅）

### タブレット (768px-1023px)
- **配置**: 画面中央に配置（transform使用）
- **幅**: 90vw（最大4xl）
- **右サイドバー表示時**: 中央配置を維持
- **パディング**: 左右30px

### モバイル (<768px)
- **配置**: 画面中央に配置
- **幅**: 90vw（最大4xl）
- **右サイドバー表示時**: 中央配置を維持
- **パディング**: 左右30px

## 技術的詳細

### 主要な変更点
1. **右サイドバー非表示時のコンテナ**: `w-full`を追加して全幅を確保
2. **右サイドバー表示時の分離**: デスクトップとタブレット/モバイルで異なるレイアウト
3. **幅の制御**: タブレット/モバイルで`w-[90vw] max-w-4xl`使用

### CSSクラス構成
- **位置制御**: `left-1/2 -translate-x-1/2` で中央配置
- **レスポンシブ**: `md:`, `lg:` プレフィックスで画面サイズ別制御
- **表示制御**: `hidden lg:block` と `block lg:hidden` で条件分岐

## ファイル変更
- **src/components/chat/glassmorphism-chat-input.tsx**:
  - コンテナクラスの修正
  - 右サイドバー表示時のレイアウト分離
  - デバッグログの追加

## 状態
✅ タブレットサイズでの中央配置完了
✅ モバイルサイズでの中央配置完了
✅ 右サイドバー表示時の対応完了
✅ デバッグログ追加完了
✅ レスポンシブレイアウトの最適化完了
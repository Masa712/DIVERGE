# レスポンシブチャット入力デザイン実装

## Date: 2025-08-25

## Overview
GlassmorphismChatInputコンポーネントに完全なレスポンシブデザインを実装。左サイドバーの開閉状態と右サイドバーの表示状態に応じて、動的に配置を調整する高度なレイアウトシステムを構築しました。

## 主要な実装内容

### 1. 左サイドバーの折りたたみ対応
- **isLeftSidebarCollapsed prop追加**: 左サイドバーの状態を追跡
- **動的な左マージン計算**:
  - 展開時: 410px (350px幅 + 30px余白 + 30px追加マージン)
  - 折りたたみ時: 124px (64px幅 + 30px余白 + 30px追加マージン)

### 2. レスポンシブブレークポイント
- **デスクトップ (≥1024px)**: 
  - 左サイドバー後に配置
  - 最大幅4xlで中央寄せ
  - 両端に30pxの余白
- **タブレット (768px-1023px)**:
  - 画面幅いっぱいに配置
  - 中央寄せ
- **モバイル (<768px)**:
  - フルワイド表示
  - 左右30pxのパディング

### 3. 右サイドバー表示時の特別処理
- **固定配置モード**: 右サイドバーが開いている場合
  ```css
  lg:left-[124px/410px] lg:right-[460px] (デスクトップ)
  md:left-6 md:right-[390px] (タブレット)
  left-6 right-6 (モバイル)
  ```

### 4. DRYアプローチ
- **renderInputContent関数**: 入力コンテンツの重複を避けるため、共通のレンダリング関数を作成
- **条件付きレンダリング**: 右サイドバーの状態により異なるレイアウトコンテナを使用

### 5. 動的幅計算
- **右サイドバー非表示時**:
  - デスクトップ: `calc(100vw - [左マージン] - 30px)`
  - タブレット/モバイル: フルワイド with max-width制約

## 技術的詳細

### Props拡張
```typescript
interface Props {
  // ... 既存のprops
  isRightSidebarOpen?: boolean
  isLeftSidebarCollapsed?: boolean  // 新規追加
}
```

### レイアウト計算ロジック
```typescript
// 左サイドバー: 30px (左マージン) + 350px (幅) = 380px (展開時)
// 左サイドバー: 30px (左マージン) + 64px (幅) = 94px (折りたたみ時)
// 右サイドバー: 400px (幅) + 30px (右マージン) = 430px

const containerClassName = isRightSidebarOpen 
  ? `fixed bottom-6 z-40
     ${isLeftSidebarCollapsed ? 'lg:left-[124px]' : 'lg:left-[410px]'} lg:right-[460px]
     md:left-6 md:right-[390px]
     left-6 right-6`
  : "fixed bottom-6 z-40 w-full"
```

### デバッグログ追加
```typescript
console.log('🔍 GlassmorphismChatInput render:', {
  isRightSidebarOpen,
  isLeftSidebarCollapsed,
  screenWidth: typeof window !== 'undefined' ? window.innerWidth : 'unknown',
  calculatedLeftPosition: isLeftSidebarCollapsed ? '124px' : '410px',
  containerClassName: containerClassName
})
```

## ファイル変更

### 更新されたファイル
- **src/components/chat/glassmorphism-chat-input.tsx**:
  - isLeftSidebarCollapsed prop追加
  - renderInputContent関数でDRY実装
  - 複雑なレスポンシブレイアウトロジック
  - デバッグログ追加

- **src/app/chat/page.tsx**:
  - isLeftSidebarCollapsed prop をGlassmorphismChatInputに渡す

- **src/app/chat/[id]/page.tsx**:
  - isLeftSidebarCollapsed={true} 固定値で渡す（[id]ページでは左サイドバーが常に非表示）

## レスポンシブ仕様

### デスクトップ (lg: ≥1024px)
- **左サイドバー展開時**: left-410px
- **左サイドバー折りたたみ時**: left-124px
- **右サイドバー表示時**: right-460px固定
- **最大幅**: max-w-4xl
- **余白**: 左右30px

### タブレット (md: 768px-1023px)
- **右サイドバー表示時**: left-6 right-390px
- **右サイドバー非表示時**: フルワイド中央寄せ
- **余白**: 左右30px

### モバイル (sm: <768px)
- **常にフルワイド表示**
- **余白**: 左右30px
- **中央寄せ**: mx-auto

## アニメーションとトランジション
- すべてのレイアウト変更は200msのトランジション
- サイドバー開閉時のスムーズな位置調整
- フォーカス/ホバー時の視覚フィードバック維持

## 状態
✅ 左サイドバー折りたたみ対応完了
✅ フルレスポンシブデザイン実装完了
✅ DRYアプローチでコード最適化完了
✅ デバッグログ追加完了
✅ 動的幅計算実装完了
✅ 全デバイスサイズでのテスト対応完了
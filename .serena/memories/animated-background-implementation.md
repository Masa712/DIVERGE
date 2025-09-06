# AnimatedBackground実装と背景統一完了

## 実装完了状況（2025-09-06）

### 全ページでAnimatedBackground統一完了
- ✅ **メインチャットページ** (`/src/app/chat/page.tsx`): AnimatedBackground実装済み
- ✅ **個別セッション画面** (`/src/app/chat/[id]/page.tsx`): AnimatedBackground実装済み
- ✅ **ダッシュボード** (`/src/app/dashboard/page.tsx`): AnimatedBackground実装済み  
- ✅ **認証ページ** (`/src/app/auth/page.tsx`): AnimatedBackground実装済み

### 解決した問題

#### 1. 個別セッション画面の背景干渉問題
**問題**: 個別セッション画面で古い背景が新しいAnimatedBackgroundを隠してしまっていた

**原因**: `BalancedTreeView.tsx`で古い`GradientBackground`コンポーネントが使用されていた

**解決策**:
```tsx
// 削除前
import { GradientBackground } from './GradientBackground'
// ReactFlow内で
<GradientBackground gap={20} size={1} opacity={0.3} />

// 削除後
// GradientBackground完全削除、親のAnimatedBackgroundが正常表示
```

#### 2. ハイドレーションエラーの修正
**問題**: AnimatedBackgroundでサーバー・クライアント間のID不一致エラー

**解決策**:
```tsx
// 修正前
const uniqueId = React.useMemo(() => Math.random().toString(36).substring(2, 9), [])

// 修正後
const [uniqueId] = React.useState(() => Math.random().toString(36).substring(2, 9))
```

### AnimatedBackground仕様

#### 主な特徴
- **SVGベース**のアニメーション背景
- **4隅からのラジアルグラデーション**（青、紫、ピンク、黄色）
- **なめらかなアニメーション**（10-15秒周期）
- **ブラーエフェクト**によるソフトなブレンド
- **固定配置**（`fixed inset-0 -z-10`）

#### 使用方法
```tsx
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'

<div className="relative">
  <AnimatedBackground opacity={0.4} />
  {/* コンテンツ */}
</div>
```

#### 各ページの透明度設定
- **個別セッション**: `opacity={0.4}` - やや強め（チャット内容のコントラスト）
- **ダッシュボード**: `opacity={0.3}` - 標準
- **認証ページ**: デフォルト（1.0）- フル表示

### 削除したファイル
- `src/components/tree/GradientBackground.tsx` - 古い背景コンポーネント（不要になったため完全削除）

### 技術的詳細

#### SVGアニメーション構造
```tsx
// 4隅のラジアルグラデーション
- gradient-tl: 左上（青系）
- gradient-tr: 右上（紫系）  
- gradient-bl: 左下（ピンク系）
- gradient-br: 右下（黄色系）

// 中央ブレンド + スケールアニメーション
// ブラーエフェクトによるソフトなブレンド
```

#### ユニークID生成
- コンポーネントインスタンス毎に一意のID生成
- 複数のAnimatedBackgroundが同じページに存在してもSVG IDの競合を回避

## 今後の保守について
- 新しいページを追加する際は`AnimatedBackground`を標準で使用
- 透明度は用途に応じて調整（`opacity`プロパティ）
- 古いCSS背景クラス（`bg-background`等）は使用しない
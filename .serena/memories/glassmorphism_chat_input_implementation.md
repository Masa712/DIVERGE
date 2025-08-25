# グラスモーフィズムチャット入力エリア実装

## Date: 2025-08-25

## Overview
従来のChatInputコンポーネントを完全に置き換え、グラスモーフィズムデザインの新しいGlassmorphismChatInputコンポーネントを実装しました。左右サイドバーと統一したデザイン言語を採用し、浮遊型のモダンなUIを実現しています。

## 実装された主要機能

### 1. グラスモーフィズムデザイン
- **半透明背景**: `glass-test` と `glass-blur` クラスによるガラス質感
- **backdrop-filter**: blur効果による背景ぼかし
- **浮遊デザイン**: 画面下部に固定配置（bottom-6）
- **角丸デザイン**: `rounded-2xl` でソフトな印象
- **影効果**: `shadow-[0_20px_50px_rgba(0,0,0,0.15)]` で立体感

### 2. レイアウトと配置
- **動的幅調整**: 右サイドバーの開閉に応じて幅を自動調整
  - 右サイドバー開時: `left-[380px] right-[460px]`
  - 右サイドバー閉時: `left-[380px] right-6 max-w-4xl mx-auto`
- **左サイドバーとの重複防止**: 最小左マージン380px確保
- **z-index**: 40で適切なレイヤー管理

### 3. UI要素の配置
- **入力フィールド**: 半透明背景（bg-white/10）、フォーカス時の視覚フィードバック
- **コントロール要素を外側配置**: 
  - Plusボタン: 左下に配置
  - ModelSelector: 右下にコンパクト版配置
  - 送信ボタン: ModelSelectorの右隣
  - 間隔: `mt-1`で入力フィールドとの適切な余白

### 4. コンテキスト情報表示
- **Continuing from表示**: 
  - フォントサイズ: `text-[10px]`（控えめな表示）
  - 現在のノードのプロンプトを60文字で切り詰め表示
  - メッセージ入力時は非表示

### 5. リファレンス検出機能
- **ノード参照検出**: @node_abc123 または #abc123 形式
- **視覚的フィードバック**: 
  - 有効な参照: 緑色バッジ（bg-green-100）
  - 無効な参照: 赤色バッジ（bg-red-100）
- **リアルタイム検証**: 入力中に即座に検証

### 6. ModelSelectorのコンパクト版
- **compact propの追加**: コンパクト表示モード
- **簡略化された表示**: トークン数・コスト情報を非表示
- **グラスモーフィズムスタイル**: bg-white/10、border-white/20
- **フォーカス時**: bg-white/20、border-white/30

## 技術実装詳細

### コンポーネント構成
```typescript
interface Props {
  onSendMessage: (message: string) => Promise<void>
  disabled?: boolean
  availableNodes?: ChatNode[]
  onInputMount?: (insertFunction: (text: string) => void) => void
  onFocusChange?: (focused: boolean) => void
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  currentNodeId?: string
  currentNodePrompt?: string
  isRightSidebarOpen?: boolean
}
```

### テキストエリアの動的高さ調整
- 最小高さ: 44px
- 最大高さ: 120px
- 自動リサイズ: scrollHeightベース

### キーボードショートカット
- Enter: メッセージ送信
- Shift+Enter: 改行

## ファイル変更

### 新規作成
- **src/components/chat/glassmorphism-chat-input.tsx**: 新しい入力コンポーネント

### 変更
- **src/components/chat/model-selector.tsx**: compact prop追加
- **src/app/chat/page.tsx**: GlassmorphismChatInput統合
- **src/app/chat/[id]/page.tsx**: GlassmorphismChatInput統合、ヘッダー削除

## デザイン仕様

### カラーパレット
- **入力フィールド背景**: rgba(255, 255, 255, 0.10)
- **フォーカス時背景**: rgba(255, 255, 255, 0.15)
- **境界線**: rgba(255, 255, 255, 0.20)
- **フォーカス時境界線**: rgba(255, 255, 255, 0.30)
- **テキスト**: gray-900
- **プレースホルダー**: gray-500
- **送信ボタン**: gradient from-blue-500 to-blue-600

### レスポンシブ対応（PC/フルサイズ）
- **最大幅**: max-w-4xl（右サイドバー非表示時）
- **左マージン**: 380px固定（左サイドバーとの重複防止）
- **右マージン**: 24px（right-6）または460px（右サイドバー表示時）
- **下マージン**: 24px（bottom-6）

## アニメーション
- **トランジション**: all 200ms
- **ホバー効果**: 背景色の変化、スケール変換（送信ボタン）
- **フォーカス効果**: 背景と境界線の明度上昇
- **送信中**: ローディングスピナー表示

## 状態
✅ グラスモーフィズムデザイン実装完了
✅ 浮遊型レイアウト実装完了
✅ コントロール要素の外側配置完了
✅ リファレンス検出機能実装完了
✅ ModelSelectorコンパクト版実装完了
✅ Continuing from表示のフォントサイズ調整完了
✅ 動的幅調整機能実装完了
✅ 左サイドバーとの重複防止実装完了
✅ 余白調整（mt-1）完了

## 今後の改善予定
- タブレット・モバイル向けレスポンシブ対応
- 各サイドバーと入力エリアの幅の最適化
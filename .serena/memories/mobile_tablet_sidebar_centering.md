# モバイル/タブレットサイドバー中央配置実装

## Date: 2025-08-25

## Overview
モバイルおよびタブレットサイズで左右のサイドバーを画面中央に配置し、PCサイズでは従来の端配置を維持する実装を完了しました。

## 実装内容

### 1. 左サイドバー（LeftSidebar）

#### デスクトップ（lg: ≥1024px）
- **配置**: `lg:left-[30px] lg:top-[25px] lg:bottom-[25px]`
- **幅**: `lg:w-[350px]`
- **高さ**: `lg:h-auto lg:max-h-none`で自然な高さ
- **Transform**: `lg:translate-x-0 lg:translate-y-0`で中央配置を無効化

#### タブレット/モバイル（<1024px）
- **配置**: `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`で画面中央
- **サイズ**: 
  - モバイル: `w-[90vw] max-w-[400px] h-[85vh] max-h-[700px]`
  - タブレット: `md:w-[80vw] md:max-w-[400px] md:h-[80vh]`
- **アニメーション**: `scale-95 opacity-0` → `scale-100 opacity-100`

### 2. 右サイドバー（NodeDetailSidebar）

#### デスクトップ（lg: ≥1024px）
- **配置**: `lg:right-[30px] lg:top-[25px] lg:bottom-[25px]`
- **幅**: `lg:w-auto`でリサイズ機能維持
- **高さ**: `lg:h-auto lg:max-h-none`で自然な高さ
- **Transform**: `lg:translate-x-0 lg:translate-y-0`で中央配置を無効化
- **リサイズ**: 左端ドラッグで400px-800px

#### タブレット/モバイル（<1024px）
- **配置**: `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`で画面中央
- **サイズ**: 左サイドバーと同じ
- **リサイズ**: 無効

## 技術的詳細

### CSS優先順位の課題と解決
**問題**:
- モバイル用スタイル（`h-[85vh]`, `left-1/2`など）がPCサイズでも適用
- Tailwindの優先順位により単純な`lg:`プレフィックスでは不十分

**解決策**:
```css
/* すべてのモバイルスタイルをlgで明示的に上書き */
lg:left-[30px] lg:top-[25px] lg:bottom-[25px] 
lg:w-[350px] lg:h-auto lg:max-h-none lg:max-w-none 
lg:translate-x-0 lg:translate-y-0
```

### 折りたたみ状態のサイドバー
- モバイル専用サイドバー: `lg:hidden`で非表示
- デスクトップ専用折りたたみ: `hidden lg:flex`で表示

## ファイル変更

### 更新されたファイル
- **src/components/layout/left-sidebar.tsx**:
  - メインサイドバーとモバイル用サイドバーの両方を修正
  - 完全なレスポンシブ対応実装

- **src/components/chat/node-detail-sidebar.tsx**:
  - 中央配置とデスクトップ配置の両立
  - リサイズ機能の維持

## アニメーション仕様

### モバイル/タブレット
- **開く**: `scale-95 opacity-0` → `scale-100 opacity-100`
- **閉じる**: `scale-100 opacity-100` → `scale-95 opacity-0`
- **Duration**: 300ms
- **Easing**: ease-in-out

### デスクトップ
- 左サイドバー: 常時表示（折りたたみ可能）
- 右サイドバー: フェードイン/アウト

## レスポンシブブレークポイント
- **Mobile**: < 768px
- **Tablet**: 768px - 1023px
- **Desktop**: ≥ 1024px

## 状態
✅ モバイル/タブレット中央配置完了
✅ PCサイズの端配置維持完了
✅ 高さ問題の解決完了
✅ リサイズ機能の維持完了
✅ アニメーション実装完了
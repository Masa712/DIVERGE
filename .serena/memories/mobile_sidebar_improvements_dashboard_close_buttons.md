# モバイルサイドバー改善 - Dashboard項目とクローズボタン調整

## Date: 2025-08-27

## 概要
モバイル/タブレット版の左サイドバーと右サイドバーにおけるUI/UX改善を実装しました。

## 実装内容

### 1. Dashboard項目のホバー効果統一

#### 問題
- モバイル版のDashboard項目でホバー時に白枠（半透明）が表示される
- Sign Out項目は色のみが変化する

#### 解決策
**左サイドバー（src/components/layout/left-sidebar.tsx）**

**モバイル版サイドバー内のDashboard項目（362-367行目）**:
```tsx
<button
  onClick={() => setShowDashboard(true)}
  className="w-full p-3 rounded-lg text-gray-700 hover:bg-white/10 transition-all duration-200 flex items-center space-x-2 group"
>
  <Activity className="w-4 h-4 group-hover:text-blue-600 transition-colors duration-200" />
  <span className="text-sm group-hover:text-blue-600 transition-colors duration-200">Dashboard</span>
</button>
```

**メインサイドバーのDashboard項目（640-652行目）**:
```tsx
<button 
  onClick={() => setShowDashboard(!showDashboard)}
  className="
    w-full mb-2 px-4 py-2 rounded-lg
    text-gray-700 text-sm
    hover:text-blue-600
    transition-all duration-200
    flex items-center gap-2 group
  "
>
  <Activity className="w-4 h-4 group-hover:text-blue-600 transition-colors duration-200" />
  <span className="group-hover:text-blue-600 transition-colors duration-200">Dashboard</span>
</button>
```

#### 変更点
- `hover:bg-white/10` を削除して白枠効果を除去
- `group` クラスとアイコン・テキストに `group-hover:text-blue-600` を追加
- Sign Out項目と同じホバー動作に統一（色のみ変化）

### 2. モバイル版バツボタンの削除

#### 変更理由
- サイドバー外タップによるクローズ機能に統一
- より簡潔なUIの実現

#### 実装箇所

**左サイドバー（src/components/layout/left-sidebar.tsx）**
- 2箇所のモバイル専用クローズボタンを削除
  - モバイル専用サイドバー内（246-253行目）
  - メインサイドバー内（510-517行目）

**右サイドバー（src/components/chat/node-detail-sidebar.tsx）**
- モバイル/タブレット専用クローズボタンを削除（529-537行目）
- 未使用のインポート（X, ChevronLeft, ChevronRight, ArrowUp）を削除

## 技術的詳細

### ホバー効果の統一
```css
/* 変更前（Dashboard） */
hover:bg-white/10 hover:text-blue-600

/* 変更後（Dashboard） */
hover:text-blue-600

/* Sign Outと同様 */
hover:text-red-600
```

### クローズ機能
- **モバイル**: オーバーレイタップでクローズ
- **デスクトップ**: デスクトップ専用のコントロールボタンは保持

## UI/UX向上ポイント

1. **一貫性**: Dashboard/Sign Out項目のホバー動作を統一
2. **シンプル性**: 不要なクローズボタンを削除
3. **直感性**: サイドバー外タップによる統一されたクローズ方法

## ファイル変更

### 更新されたファイル
- **src/components/layout/left-sidebar.tsx**: Dashboard項目ホバー効果とクローズボタン削除
- **src/components/chat/node-detail-sidebar.tsx**: クローズボタン削除と未使用インポート整理

## 状態
✅ Dashboard項目のホバー効果統一完了
✅ 左サイドバーのクローズボタン削除完了
✅ 右サイドバーのクローズボタン削除完了
✅ 未使用インポートのクリーンアップ完了
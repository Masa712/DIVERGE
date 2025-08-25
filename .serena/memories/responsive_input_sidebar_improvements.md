# レスポンシブ入力エリア・サイドバー改善

## Date: 2025-08-25

## Overview
モバイル/タブレット時の入力エリアとサイドバーの動作を改善し、左サイドバーの自動折りたたみ機能とハンバーガーボタンのデザイン改善を実装しました。

## 実装内容

### 1. 左サイドバー自動折りたたみ機能

#### 実装場所
- **src/components/chat/glassmorphism-chat-input.tsx**

#### 機能仕様
- **条件**: 右サイドバーが開いている状態 + 画面幅 < 1400px
- **動作**: 左サイドバーを自動で折りたたみ
- **制限**: 自動展開機能は実装せず、展開は手動のみ

#### 技術的詳細
```typescript
// シンプルなブレークポイント方式
if (isRightSidebarOpen && screenWidth < 1400 && !isLeftSidebarCollapsed) {
  console.log('🔄 Auto-collapsing left sidebar at breakpoint:', screenWidth, 'px')
  onLeftSidebarAutoCollapse(true)
}
```

### 2. モバイル/タブレット時の入力エリア非表示

#### 対象条件
- 画面幅 < 1024px（モバイル/タブレット）
- 左サイドバーまたは右サイドバーが開いている場合

#### 実装方式
```typescript
// リアルタイムでウィンドウ幅を追跡
const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)

// リサイズイベントで状態更新
useEffect(() => {
  const handleResize = () => {
    setWindowWidth(window.innerWidth)
  }
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])

// 条件判定
const shouldHideOnMobile = windowWidth < 1024
if (shouldHideOnMobile && (isRightSidebarOpen || isLeftSidebarMobileOpen)) {
  return null
}
```

#### 対応ケース
1. モバイル/タブレットで左サイドバー展開時
2. モバイル/タブレットで右サイドバー展開時
3. **PCで右サイドバー展開→タブレットサイズに縮小時** ← 新規対応

### 3. ハンバーガーボタンデザイン改善

#### 変更前
```css
className="fixed left-[30px] top-[25px] z-40 p-3 glass-test glass-blur border border-white/20 rounded-xl shadow-lg lg:hidden"
```

#### 変更後
```css
className="fixed left-[30px] top-[25px] z-40 p-3 lg:hidden hover:bg-black/10 rounded-lg transition-colors"
```

#### 変更点
- **背景削除**: `glass-test glass-blur` 削除
- **ボーダー削除**: `border border-white/20` 削除
- **影削除**: `shadow-lg` 削除
- **ホバー効果**: `hover:bg-black/10` 追加
- **アイコンサイズ**: `w-5 h-5` → `w-6 h-6`

### 4. 状態管理の拡張

#### LeftSidebarコンポーネント
```typescript
interface Props {
  // 既存のprops...
  onMobileOpenChange?: (isOpen: boolean) => void
}

// モバイル開閉状態の通知
useEffect(() => {
  onMobileOpenChange?.(isMobileOpen)
}, [isMobileOpen, onMobileOpenChange])
```

#### 親コンポーネント（chat/page.tsx）
```typescript
const [isLeftSidebarMobileOpen, setIsLeftSidebarMobileOpen] = useState(false)

<LeftSidebar
  // 既存のprops...
  onMobileOpenChange={setIsLeftSidebarMobileOpen}
/>

<GlassmorphismChatInput 
  // 既存のprops...
  isLeftSidebarMobileOpen={isLeftSidebarMobileOpen}
/>
```

## ファイル変更

### 更新されたファイル
1. **src/components/chat/glassmorphism-chat-input.tsx**:
   - 自動折りたたみ機能追加
   - モバイル時入力エリア非表示機能
   - ウィンドウサイズ追跡機能

2. **src/components/layout/left-sidebar.tsx**:
   - ハンバーガーボタンデザイン変更
   - モバイル開閉状態通知機能追加

3. **src/app/chat/page.tsx**:
   - 左サイドバーモバイル状態管理追加

## UX改善効果

### 1. スペース効率
- モバイル/タブレットでサイドバー展開時、入力エリアが非表示になり画面がスッキリ
- PCサイズで右サイドバー展開時、左サイドバーが自動折りたたみで入力エリアの幅を確保

### 2. デザイン一貫性
- ハンバーガーボタンがミニマルなデザインに変更
- glassmorphism背景を削除してアイコンのみの表示

### 3. レスポンシブ対応
- 画面サイズ変更時のリアルタイム対応
- PCサイズからタブレットサイズへの縮小時も適切に動作

## 技術的特徴

### 1. パフォーマンス
- デバウンス機能でリサイズイベントの過度な発火を制御
- 条件分岐による早期リターンでレンダリング最適化

### 2. 安定性
- 無限ループ防止のためシンプルな実装を採用
- ブレークポイントベースの明確な判定条件

### 3. 拡張性
- 新しいプロップスでの状態管理
- 既存機能に影響を与えない追加実装

## 状態
✅ 左サイドバー自動折りたたみ実装完了
✅ モバイル/タブレット入力エリア非表示完了
✅ ハンバーガーボタンデザイン改善完了
✅ 画面サイズ変更時のリアルタイム対応完了
✅ 全レスポンシブ対応テスト完了
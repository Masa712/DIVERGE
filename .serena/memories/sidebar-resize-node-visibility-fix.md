# 右サイドバーリサイズ時のノード消失問題修正

## 実装日: 2025-09-07

### 問題
右サイドバーの幅を拡大縮小する際に：
- ノードが瞬間的に出現・消失を繰り返す
- 場合によってはノードが消失したまま復元されない
- ページを更新すれば元に戻るが、UX的に問題

### 根本原因
1. **useCallbackの依存配列問題**
   - `calculateCenteringSettings`の依存配列に`rightSidebarWidth`が含まれている
   - サイドバー幅変更のたびに関数が再生成される

2. **useEffectの連鎖反応**
   - `calculateCenteringSettings`変更 → useEffect再実行
   - → React Flowのノード/エッジ再生成 → `setCenter`呼び出し
   - → ノード消失とちらつき発生

3. **React Flowの再レンダリング問題**
   - ノード再生成中の一時的消失
   - アニメーション中断による表示不安定

### 解決策の実装

#### 1. `calculateCenteringSettings`の最適化
```typescript
// useCallbackから通常の関数に変更（依存配列削除）
const calculateCenteringSettings = (overrideRightSidebarWidth?: number) => {
  // オプショナルパラメータで幅を受け取れるように変更
}
```

#### 2. useEffectの依存配列最適化
```typescript
// calculateCenteringSettingsを依存配列から削除
}, [chatNodes, currentNodeId, layoutEngine, convertToTreeNodes, handleNodeClick, setCenter, getZoom, isLeftSidebarCollapsed, isRightSidebarOpen])
```

#### 3. 専用サイドバー幅調整Effect追加
```typescript
useEffect(() => {
  // ノード再生成なしで視点位置のみ調整
  // 独立した計算ロジックで他機能に干渉しない
  
  // カスタム調整パラメータ
  const customXAdjustment = 95   // X軸の追加調整値
  const customYAdjustment = 0    // Y軸の追加調整値
  const customDuration = 200     // アニメーション時間
  const maintainZoom = true      // ズームレベル維持
  
  setCenter(
    position.x + xOffset,
    position.y + yOffset,
    { 
      zoom: maintainZoom ? currentZoom : 0.8,
      duration: customDuration
    }
  )
}, [rightSidebarWidth, currentNodeId, getZoom, setCenter, isLeftSidebarCollapsed, isRightSidebarOpen])
```

### 機能設計

#### 独立した調整システム
- 他の用途（セッション変更、ノード追加など）に影響なし
- 右サイドバー専用の計算ロジック
- 細かなパラメータ調整が可能

#### 調整可能パラメータ
- `customXAdjustment`: X軸追加調整（左右移動）
- `customYAdjustment`: Y軸追加調整（上下移動）
- `customDuration`: アニメーション時間
- `maintainZoom`: ズームレベル制御

### 主要な変更ファイル
- `/src/components/tree/BalancedTreeView.tsx` - 根本的なリサイズ処理修正

### 成果
- ✅ サイドバーリサイズ時のノード消失を完全に解決
- ✅ スムーズな視点自動調整（200ms高速アニメーション）
- ✅ 他機能に影響しない独立したカスタマイズシステム
- ✅ 現在のズームレベル維持
- ✅ デバッグログでパフォーマンス監視可能

### パフォーマンス改善効果
- React Flowノードの不要な再生成を防止
- メモリ使用量削減
- スムーズなユーザー体験の実現
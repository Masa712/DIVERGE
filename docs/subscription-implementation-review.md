# サブスクリプション機能実装レビュー

## 📅 レビュー日: 2025-10-19

---

## ✅ 実装済み機能

### 1. **サブスクリプション解除機能**
**実装状況**: ✅ **完全実装済み**

#### 実装詳細:
- **Stripe Billing Portal**: ユーザーがセルフサービスでサブスクリプション管理可能
  - ファイル: `src/app/api/stripe/create-portal/route.ts`
  - UI: `/settings` の "Manage Billing" ボタン

- **解除関数**: `cancelSubscription()`
  - ファイル: `src/lib/stripe/server.ts:108-127`
  - デフォルト: `atPeriodEnd = true` （期間終了時に解除）
  - 即座解除も可能: `atPeriodEnd = false`

#### Webhook処理:
```typescript
// Webhook: customer.subscription.deleted
// ファイル: src/app/api/stripe/webhook/route.ts:112-146
async function handleSubscriptionDeleted(subscription) {
  // 1. user_subscriptions.status を 'canceled' に更新
  // 2. user_profiles.subscription_plan を 'free' に戻す
  // 3. usage_quotas を free プランに更新
}
```

#### ユーザー体験:
1. ユーザーが `/settings` の "Manage Billing" をクリック
2. Stripe Billing Portalにリダイレクト
3. "Cancel subscription" オプションが表示
4. 解除後も期間終了まで利用可能

---

### 2. **解除後の残日数利用**
**実装状況**: ✅ **完全実装済み**

#### 実装詳細:
- **期間終了まで利用可能**: `cancel_at_period_end: true` がデフォルト
  - ファイル: `src/lib/stripe/server.ts:114`

- **データベース記録**:
  ```sql
  user_subscriptions テーブル:
  - status: 'active' (解除手続き中でも期間内は active)
  - cancel_at_period_end: true (解除予定フラグ)
  - current_period_end: '2025-11-16' (この日まで利用可能)
  ```

- **Webhook処理**:
  - `customer.subscription.updated`: 解除予約時にフラグ更新
  - `customer.subscription.deleted`: 期間終了時に free に戻す

#### ユーザー体験:
- 10月16日に解除手続き → 11月16日まで Plus プランとして利用可能
- 11月16日以降、自動的に Free プランに降格
- データ損失なし

---

### 3. **プランアップグレード時の日割り計算**
**実装状況**: ✅ **完全実装済み**

#### 実装詳細:
- **Proration（日割り計算）**: Stripeが自動計算
  - ファイル: `src/lib/stripe/server.ts:129-156`
  - 設定: `proration_behavior: 'create_prorations'`

```typescript
export async function updateSubscription(
  subscriptionId: string,
  priceId: string
): Promise<Stripe.Subscription> {
  const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: priceId,
    }],
    proration_behavior: 'create_prorations', // 日割り計算
  })
  return updatedSubscription
}
```

#### 日割り計算の仕組み:

**例**: Plus ($19/月) → Pro ($99/月) に10月16日にアップグレード

1. **未使用期間の計算**:
   - Plus の残り期間: 10月16日〜11月1日 = 15日
   - 未使用金額: $19 × (15日 / 30日) = $9.50

2. **新プランの日割り計算**:
   - Pro の残り期間: 10月16日〜11月1日 = 15日
   - 日割り料金: $99 × (15日 / 30日) = $49.50

3. **即座請求額**:
   - $49.50 (Pro 日割り) - $9.50 (Plus 返金) = **$40.00**

4. **次回請求**:
   - 11月1日: $99 (Pro 月額)

#### Webhookでの処理:
```typescript
// customer.subscription.updated イベント
await upsertSubscription(userId, subscription)
// → plan_id を 'pro' に更新
// → usage_quotas を Pro の制限に更新 (15M tokens, unlimited sessions)
```

---

## 🚧 追加実装推奨機能

### 優先度: 高

#### 1. **ダウングレード処理の明示的対応**
**現状**: アップグレードと同じ `proration_behavior: 'create_prorations'` で処理

**問題点**:
- Plus → Free へのダウングレード時、差額が即座に返金されない
- Stripeのデフォルト動作: 期間終了時にダウングレード

**推奨実装**:
```typescript
export async function downgradeSubscription(
  subscriptionId: string,
  priceId: string
): Promise<Stripe.Subscription> {
  // 期間終了時にダウングレード（即座の返金なし）
  return await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: priceId,
    }],
    proration_behavior: 'none', // 日割り計算なし
    billing_cycle_anchor: 'unchanged', // 請求サイクル維持
  })
}
```

#### 2. **支払い失敗時の処理改善**
**現状**: ログ出力のみ
```typescript
// src/app/api/stripe/webhook/route.ts:150-159
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  log.error('Payment failed', { ... })
  // TODO: ユーザー通知、猶予期間の設定
}
```

**推奨実装**:
- ステータスを 'past_due' に更新
- メール通知（支払い方法の更新を促す）
- 猶予期間（7日間）の設定
- 猶予期間後、サービス制限または一時停止

#### 3. **メール通知システム**
**必要な通知**:
- サブスクリプション開始
- 支払い成功
- 支払い失敗
- サブスクリプション解除予約
- サブスクリプション解除完了
- プランアップグレード/ダウングレード
- 使用量アラート（80%, 95%）

**推奨ツール**:
- Resend, SendGrid, または Stripe の組み込みメール機能

#### 4. **使用量アラート**
**推奨実装**:
```typescript
// src/lib/billing/usage-alerts.ts
export async function checkUsageAlerts(userId: string) {
  const quota = await getUsageQuota(userId)

  if (quota.tokensUsedPercentage >= 80 && !quota.alert80Sent) {
    await sendUsageAlert(userId, 80)
    await markAlertSent(userId, '80')
  }

  if (quota.tokensUsedPercentage >= 95 && !quota.alert95Sent) {
    await sendUsageAlert(userId, 95)
    await markAlertSent(userId, '95')
  }
}
```

---

### 優先度: 中

#### 5. **請求履歴の表示**
**現状**: Stripe Billing Portal でのみ確認可能

**推奨実装**:
- `/settings` 内の請求履歴タブ (例: `/settings?tab=billing-invoices`)
- 過去の請求書一覧
- PDFダウンロード
- 支払い履歴

**API**:
```typescript
// src/app/api/billing/invoices/route.ts
export async function GET(request: NextRequest) {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit: 12,
  })
  return NextResponse.json({ invoices })
}
```

#### 6. **サブスクリプション一時停止**
**ユースケース**:
- 長期休暇中の一時停止
- 財政的な理由での一時的な解約回避

**Stripe機能**:
```typescript
await stripe.subscriptions.update(subscriptionId, {
  pause_collection: {
    behavior: 'void', // 請求をスキップ
  },
})
```

#### 7. **トライアル期間**
**推奨設定**:
- 14日間の無料トライアル
- クレジットカード登録必須（自動移行）

**実装**:
```typescript
// Checkout時にトライアル設定
await stripe.checkout.sessions.create({
  // ...
  subscription_data: {
    trial_period_days: 14,
    metadata,
  },
})
```

---

### 優先度: 低

#### 8. **クーポン/プロモーションコード**
**実装**:
- Stripe Dashboardでクーポン作成
- Checkout時に `allow_promotion_codes: true` （既に実装済み）

#### 9. **年間プランへの切り替え割引**
**例**:
- Plus Monthly: $19/月 → Plus Yearly: $190/年（$228 → $190, 16%割引）

**実装**:
```typescript
// src/types/subscription.ts に既に yearly プランあり
{
  id: 'plus-yearly',
  price: 190,
  interval: 'year',
}
```

#### 10. **チームプラン（複数シート）**
**将来的な機能**:
- シート数に応じた課金
- チームメンバー管理
- 権限設定

---

## 📊 機能実装状況サマリー

| 機能 | 実装状況 | 優先度 | 備考 |
|------|----------|--------|------|
| サブスクリプション解除 | ✅ 完全実装 | - | Billing Portal経由 |
| 残日数利用 | ✅ 完全実装 | - | `cancel_at_period_end: true` |
| 日割り計算（アップグレード） | ✅ 完全実装 | - | `proration_behavior: 'create_prorations'` |
| ダウングレード処理 | ⚠️ 要改善 | 高 | 期間終了時に変更 |
| 支払い失敗処理 | ⚠️ 基本のみ | 高 | 通知・猶予期間が必要 |
| メール通知 | ❌ 未実装 | 高 | 重要な顧客体験 |
| 使用量アラート | ❌ 未実装 | 高 | オーバーチャージ防止 |
| 請求履歴表示 | ⚠️ 外部のみ | 中 | UX向上 |
| 一時停止 | ❌ 未実装 | 中 | 解約防止 |
| トライアル期間 | ❌ 未実装 | 中 | コンバージョン向上 |
| クーポン | ✅ 基本対応 | 低 | Stripe側で管理 |
| 年間プラン切替 | ✅ 構造あり | 低 | UIで選択可能 |
| チームプラン | ❌ 未実装 | 低 | 将来の拡張 |

---

## 🎯 推奨実装順序

### フェーズ1: 緊急対応（1-2週間）
1. **支払い失敗時の処理改善**
   - past_due ステータスの処理
   - 猶予期間の設定

2. **基本的なメール通知**
   - 支払い成功
   - 支払い失敗
   - サブスクリプション解除

### フェーズ2: UX向上（2-4週間）
3. **使用量アラート**
   - 80%, 95% でアラート
   - メール + ダッシュボード通知

4. **ダウングレード処理の明確化**
   - UI上で「期間終了時に変更」を明示
   - 確認ダイアログ

5. **請求履歴の表示**
   - ダッシュボードに統合

### フェーズ3: 成長施策（1-2ヶ月）
6. **トライアル期間**
   - 14日間無料トライアル

7. **サブスクリプション一時停止**
   - チャーン防止策

---

## 📝 技術的考慮事項

### Stripe Billing Portalの設定
**必要な設定** (Stripe Dashboard):
1. Billing Portal を有効化
2. 許可する操作:
   - ✅ サブスクリプションのキャンセル
   - ✅ プランの変更
   - ✅ 支払い方法の更新
   - ✅ 請求書の表示

3. キャンセルポリシー:
   - ✅ 期間終了時にキャンセル（推奨）
   - ⚠️ 即座キャンセル（オプション）

### Webhookイベントの完全性
**現在処理中**:
- ✅ checkout.session.completed
- ✅ customer.subscription.created
- ✅ customer.subscription.updated
- ✅ customer.subscription.deleted
- ✅ invoice.payment_succeeded
- ✅ invoice.payment_failed

**追加推奨**:
- customer.subscription.trial_will_end
- customer.subscription.paused
- customer.subscription.resumed

---

## 🔒 セキュリティ考慮事項

1. **Webhook署名検証**: ✅ 実装済み
2. **RLS（Row Level Security）**: ✅ 実装済み
3. **サーバー側API**: ✅ `/api/billing` で実装
4. **環境変数管理**: ✅ Stripeキーは環境変数

---

## 結論

**現在の実装**は、基本的なサブスクリプション管理において**非常に堅牢**です。

✅ **実装済み**:
- サブスクリプション解除（期間終了まで利用可能）
- 日割り計算によるアップグレード
- Stripe Billing Portalによる管理

⚠️ **改善推奨**:
- 支払い失敗時の処理
- メール通知システム
- 使用量アラート

本番環境デプロイ前に**フェーズ1（緊急対応）**の実装を強く推奨します。

---

**レビュー担当**: Claude Code
**レビュー完了日**: 2025-10-19

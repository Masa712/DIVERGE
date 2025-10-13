# Stripe商品カタログ作成ガイド

## 概要
Divergeの3段階サブスクリプションプラン（Free, Plus, Pro）をStripe Dashboardで設定します。

---

## 前提条件
- Stripeアカウント作成済み
- テストモード/本番モードを確認

---

## 📦 作成する商品・価格

### 1. Free Plan
**商品名**: Diverge Free Plan
**価格**: $0
**説明**: Basic features with 5 AI models, 500K tokens/month

**特徴**:
- 5 AI models
- 500,000 tokens/month
- 3 sessions/month
- 10 web searches/month

---

### 2. Plus Plan

#### Plus Monthly
**商品名**: Diverge Plus Plan
**請求間隔**: Monthly
**価格**: $20/月
**説明**: Full access to all AI models with 4M tokens/month

**特徴**:
- All AI models
- 4,000,000 tokens/month
- Unlimited sessions
- 200 web searches/month
- Priority support

#### Plus Yearly
**商品名**: Diverge Plus Plan (Annual)
**請求間隔**: Yearly
**価格**: $200/年 ($16.67/月相当、2ヶ月無料)
**説明**: Full access to all AI models with 4M tokens/month (save 2 months!)

**特徴**: Monthly版と同じ + 年間2ヶ月分無料

---

### 3. Pro Plan

#### Pro Monthly
**商品名**: Diverge Pro Plan
**請求間隔**: Monthly
**価格**: $50/月
**説明**: Unlimited tokens, web searches, and advanced features

**特徴**:
- All AI models
- 15,000,000 tokens/month
- Unlimited sessions
- Unlimited web searches
- Priority support
- API access (10K calls/month)
- Advanced analytics

#### Pro Yearly
**商品名**: Diverge Pro Plan (Annual)
**請求間隔**: Yearly
**価格**: $500/年 ($41.67/月相当、2ヶ月無料)
**説明**: Unlimited tokens, web searches, and advanced features (save 2 months!)

**特徴**: Monthly版と同じ + 年間2ヶ月分無料

---

## 🛠️ Stripeダッシュボード作成手順

### ステップ1: Stripeダッシュボードにログイン
1. https://dashboard.stripe.com にアクセス
2. 右上のモード切替で **テストモード** または **本番モード** を選択

### ステップ2: 商品を作成

#### Plus Monthly の例

1. **左サイドバー** → **商品カタログ (Product catalog)**
2. **+ 商品を追加 (+ Add product)** をクリック
3. 以下を入力：

   **商品情報**:
   - 名前: `Diverge Plus Plan`
   - 説明: `Full access to all AI models with 4M tokens/month`
   - 画像: （任意）プロダクトロゴをアップロード

   **料金情報**:
   - 料金モデル: `Standard pricing`
   - 価格: `20` USD
   - 請求期間: `Monthly`
   - 請求方法: `Charge automatically`

   **追加オプション**:
   - 無料トライアル: なし（または希望する期間）
   - メタデータ（任意）:
     - `plan_id`: `plus`
     - `tokens_limit`: `4000000`
     - `sessions_limit`: `-1`
     - `web_searches_limit`: `200`

4. **商品を保存 (Save product)** をクリック
5. **Price ID をコピー** (例: `price_1ABC123xyz...`)

### ステップ3: 残りの商品を作成

同様の手順で以下を作成：
- Plus Yearly ($200/year)
- Pro Monthly ($50/month)
- Pro Yearly ($500/year)

**注意**: Freeプランは商品作成不要（Stripe決済なし）

---

## 📋 作成する Price ID 一覧表

作成後、以下の表を埋めてください：

| プラン | 請求間隔 | 価格 | Price ID |
|--------|----------|------|----------|
| Plus | Monthly | $20 | `price_________________` |
| Plus | Yearly | $200 | `price_________________` |
| Pro | Monthly | $50 | `price_________________` |
| Pro | Yearly | $500 | `price_________________` |

---

## 🔧 コードへの反映方法

作成したPrice IDを取得したら、私に教えてください。
コードを自動更新します。

必要な情報：
```
Plus Monthly: price_xxxxx
Plus Yearly: price_yyyyy
Pro Monthly: price_zzzzz
Pro Yearly: price_wwwww
```

---

## 🔐 Webhook設定

### エンドポイントを追加

1. **Stripe Dashboard** → **開発者 (Developers)** → **Webhooks**
2. **+ エンドポイントを追加 (+ Add endpoint)** をクリック
3. エンドポイントURL: `https://yourdomain.com/api/stripe/webhook`
4. 監視するイベントを選択:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. **エンドポイントを追加 (Add endpoint)** をクリック
6. **署名シークレット (Signing secret)** をコピー
7. 環境変数 `STRIPE_WEBHOOK_SECRET` に設定

---

## ✅ 動作確認チェックリスト

### テストモード
- [ ] Plus Monthly の商品・価格が作成された
- [ ] Plus Yearly の商品・価格が作成された
- [ ] Pro Monthly の商品・価格が作成された
- [ ] Pro Yearly の商品・価格が作成された
- [ ] Price ID がすべてコピーされた

---

## 📞 次のステップ

1. Stripeダッシュボードで4つの商品を作成
2. 4つの Price ID をコピー
3. 私に Price ID を教えてください → コードを自動更新します

---

## 🔗 参考リンク
- [Stripe 商品・価格の作成](https://stripe.com/docs/products-prices/overview)
- [Stripe Webhook](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)

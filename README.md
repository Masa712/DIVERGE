# Diverge - Node-Based Multi-Model AI Chat Platform

<div align="center">

**次世代のノードベースAIチャットプラットフォーム**

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-purple)](https://stripe.com/)

[デモを見る](#) | [ドキュメント](#) | [報告する](https://github.com/diverge/diverge/issues)

</div>

---

## 📖 概要

Divergeは、会話をツリー構造で可視化し、任意のノードから分岐できる次世代AIチャットプラットフォームです。GPT-5、Claude Opus 4.1、Gemini 2.5 Proなど、最先端のAIモデルに統一されたインターフェースでアクセスできます。

### 🌟 主な特徴

- **🌳 ノードベース会話**: 任意のノードから分岐し、複数の会話パスを同時に探索
- **🤖 マルチモデル対応**: 15以上のAIモデル（GPT-5, Claude Opus 4.1, Gemini 2.5 Pro等）を統一インターフェースで利用
- **🔍 Web検索統合**: Tavily APIによるリアルタイムWeb検索とAIへの自動統合
- **🧠 推論モード**: o1, o3, Grok等の推論モデル対応
- **⚡ 強化コンテキスト**: 祖先・兄弟・参照ノードを含む多次元コンテキスト構築（8000トークン対応）
- **💬 コメント機能**: ノード単位でのコラボレーション
- **💰 柔軟な課金**: Free/Plus/Proプランによるモデル・機能制限
- **📊 使用量監視**: トークン・Web検索・セッション数のリアルタイム追跡
- **🎨 ガラスモーフィズムUI**: モダンで美しいユーザーインターフェース
- **📱 完全レスポンシブ**: モバイル・タブレット・デスクトップ対応

---

## 🚀 技術スタック

### フロントエンド
- **Next.js 14** (App Router) - React Server Components
- **React 18** - フロントエンドフレームワーク
- **TypeScript 5** - 型安全性
- **Tailwind CSS 3** - ユーティリティファーストCSS
- **React Flow 11** - インタラクティブツリー可視化

### バックエンド
- **Next.js API Routes** - サーバーレスAPI
- **Supabase** (PostgreSQL) - データベース・認証
- **Redis** - 分散キャッシュ（オプション）
- **OpenRouter** - マルチAIモデルAPI
- **Tavily** - Web検索API
- **Stripe** - 決済・サブスクリプション管理

### 監視・分析
- **Sentry** - エラートラッキング
- **PostHog** - プロダクトアナリティクス
- **Vercel Analytics** - パフォーマンス監視

---

## 📋 前提条件

- **Node.js**: 20 LTS以上
- **npm**: 9以上 または **yarn**: 1.22以上
- **Supabase アカウント**: [supabase.com](https://supabase.com)
- **OpenRouter API キー**: [openrouter.ai](https://openrouter.ai)
- **Stripe アカウント**: [stripe.com](https://stripe.com) （課金機能を使う場合）
- **Tavily API キー**: [tavily.com](https://tavily.com) （Web検索を使う場合）

---

## 🛠️ セットアップ手順

### 1. リポジトリのクローンと依存関係のインストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/diverge.git
cd diverge

# 依存関係をインストール
npm install
```

### 2. 環境変数の設定

`.env.local.example` を `.env.local` にコピーして編集：

```bash
cp .env.local.example .env.local
```

#### 必須の環境変数

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# OpenRouter (AI Models)
OPENROUTER_API_KEY=your_openrouter_api_key

# Stripe (Billing)
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

#### オプションの環境変数

```bash
# Tavily (Web Search)
TAVILY_API_KEY=your_tavily_api_key

# Redis (Caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Monitoring
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Debug
DEBUG_ENHANCED_CONTEXT=false
```

### 3. Supabase データベースのセットアップ

1. [Supabase](https://supabase.com) で新しいプロジェクトを作成
2. SQL Editorで以下のマイグレーションを順番に実行：

```bash
# マイグレーションファイルの場所
supabase/migrations/
├── 001_initial_schema.sql          # 基本スキーマ
├── 002_add_usage_logs.sql          # 使用ログ
├── 003_add_context_cache.sql       # コンテキストキャッシュ
├── 004_add_user_quotas.sql         # ユーザークォータ
├── 020_make_sessions_unlimited.sql # セッション無制限化
└── ...                              # その他のマイグレーション
```

3. OAuth設定（Google, X/Twitter）:
   - Supabase Dashboard > Authentication > Providers
   - Google/Twitterを有効化し、Redirect URLsを設定

### 4. Stripe Webhookの設定

1. Stripe Dashboardで新しいWebhookエンドポイントを作成
2. URL: `https://yourdomain.com/api/stripe/webhook`
3. イベント選択:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

---

## 📁 プロジェクト構造

```
diverge/
├── src/
│   ├── app/                        # Next.js 14 App Router
│   │   ├── api/                    # APIエンドポイント
│   │   │   ├── chat/               # チャットAPI（メイン）
│   │   │   ├── stripe/             # Stripe統合
│   │   │   ├── sessions/           # セッション管理
│   │   │   ├── profile/            # ユーザープロフィール
│   │   │   └── comments/           # コメントシステム
│   │   ├── auth/                   # 認証ページ
│   │   ├── chat/[id]/              # チャット画面
│   │   ├── pricing/                # 料金プラン
│   │   ├── settings/               # 設定画面
│   │   └── page.tsx                # ランディングページ
│   │
│   ├── components/                 # Reactコンポーネント
│   │   ├── chat/                   # チャット関連
│   │   │   ├── glassmorphism-chat-input.tsx
│   │   │   ├── node-detail-sidebar.tsx
│   │   │   └── model-selector.tsx
│   │   ├── layout/                 # レイアウト
│   │   │   ├── left-sidebar.tsx
│   │   │   └── SessionList.tsx
│   │   ├── tree/                   # ツリー可視化
│   │   │   ├── BalancedTreeView.tsx
│   │   │   ├── message-node.tsx
│   │   │   └── CompactTreeLayout.ts
│   │   ├── ui/                     # 共通UI
│   │   │   ├── AnimatedBackground.tsx
│   │   │   └── MarkdownRenderer.tsx
│   │   └── providers/              # Context Providers
│   │
│   ├── lib/                        # コアライブラリ
│   │   ├── db/                     # データベース操作
│   │   │   ├── enhanced-context.ts        # 強化コンテキスト
│   │   │   ├── flexible-context.ts        # 柔軟なコンテキスト戦略
│   │   │   ├── node-summarizer.ts         # AI要約
│   │   │   └── pooled-operations.ts       # 接続プール操作
│   │   ├── openrouter/             # OpenRouter統合
│   │   │   ├── client.ts
│   │   │   └── function-calling.ts
│   │   ├── billing/                # 課金システム
│   │   │   ├── usage-tracker.ts
│   │   │   └── model-restrictions.ts
│   │   ├── stripe/                 # Stripe統合
│   │   │   ├── server.ts
│   │   │   └── client.ts
│   │   ├── redis/                  # Redisキャッシュ
│   │   │   └── client.ts
│   │   ├── supabase/               # Supabase設定
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── connection-pool.ts
│   │   ├── errors/                 # エラーハンドリング
│   │   │   ├── error-handler.ts
│   │   │   └── error-monitoring.ts
│   │   ├── posthog/                # アナリティクス
│   │   ├── utils/                  # ユーティリティ
│   │   └── tavily.ts               # Web検索
│   │
│   ├── hooks/                      # カスタムReact Hooks
│   │   ├── useSessionManagement.ts
│   │   ├── useComments.ts
│   │   └── useNodeChain.ts
│   │
│   └── types/                      # TypeScript型定義
│       ├── index.ts
│       └── subscription.ts
│
├── supabase/
│   └── migrations/                 # データベースマイグレーション
│
├── public/                         # 静的ファイル
├── .env.local.example              # 環境変数テンプレート
├── next.config.js                  # Next.js設定
├── tailwind.config.ts              # Tailwind CSS設定
└── tsconfig.json                   # TypeScript設定
```

---

## 💻 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm run start

# Lintチェック
npm run lint

# 型チェック
npm run typecheck

# すべてのチェックを実行
npm run lint && npm run typecheck
```

---

## 🎯 実装済み機能

### ✅ Phase 1: 基盤 (完了)
- ✅ データベーススキーマ設定
- ✅ プロジェクト構造
- ✅ 認証実装（Email + Google + X/Twitter）
- ✅ 基本CRUD操作
- ✅ OpenRouter統合

### ✅ Phase 2: コア機能 (完了)
- ✅ マルチモデルルーティング（15+モデル）
- ✅ 強化コンテキスト再構築ロジック（祖先・兄弟・参照ノード）
- ✅ Redisキャッシング層
- ✅ ストリーミングレスポンス
- ✅ AI要約機能（8000トークン対応）
- ✅ ノード参照システム（@node_xxx, #xxx, [[node:xxx]]）

### ✅ Phase 3: 可視化 (完了)
- ✅ React Flow統合
- ✅ BalancedTreeViewによる最適化されたツリーナビゲーション
- ✅ ブランチ比較（右サイドバー）
- ✅ デバイス別センタリング（モバイル・タブレット・デスクトップ）

### ✅ Phase 4: ポリッシュ (完了)
- ✅ パフォーマンス最適化（接続プール、クエリキャッシュ）
- ✅ 包括的エラーハンドリング（Sentry統合）
- ✅ PostHogアナリティクス統合
- ✅ ガラスモーフィズムUIデザイン

### ✅ Phase 5: 課金・インフラ (完了)
- ✅ Stripe統合（Checkout, Billing Portal, Webhooks）
- ✅ プラン別モデル制限（Free: 5モデル、Plus/Pro: 全モデル）
- ✅ 使用量クォータ管理（トークン、Web検索、セッション）
- ✅ サブスクリプションサイクル基準のリセット日
- ✅ アカウント削除フロー（サブスク解約含む）

### ✅ Phase 6: 高度な機能 (完了)
- ✅ Web検索統合（Tavily API）
- ✅ Web検索クォータ制御とユーザートグル
- ✅ 推論モード対応（o1, o3, Grok等）
- ✅ コメントシステム
- ✅ システムプロンプトカスタマイズ
- ✅ リトライ機能（失敗ノード）

---

## 📊 パフォーマンス指標

### レスポンスタイム
- **コンテキスト構築**: 45ms（77%改善、キャッシュ使用時）
- **データベースクエリ**: 50-150ms（接続プール使用）
- **AI応答**: モデル依存（平均2-8秒）

### スケーラビリティ
- **同時接続**: 接続プール最大20接続
- **キャッシュヒット率**: 90%+（Redis使用時）
- **トークン効率**: 94%削減（AI要約使用時）

---

## 🔐 セキュリティ

### 実装済みセキュリティ対策

- **環境変数管理**: すべてのAPIキーは環境変数で管理
- **Row-Level Security**: Supabaseのすべてのテーブルで有効化
- **認証**: Supabase Auth（Email, OAuth）
- **HTTPS**: 本番環境では必須
- **CSRFトークン**: Next.js組み込み保護
- **入力バリデーション**: Zodによるスキーマバリデーション
- **エラーハンドリング**: 機密情報を含まないエラーメッセージ
- **レート制限**: Stripeクォータ、使用量制限

### ベストプラクティス

- API keyは`.env.local`で管理（`.gitignore`に含まれる）
- Service Role Keyはサーバーサイドでのみ使用
- ユーザー入力は常にサニタイズ
- SQLインジェクション対策（Supabaseクライアント使用）

---

## 🚀 デプロイ

### Vercelへのデプロイ（推奨）

1. GitHubリポジトリにプッシュ
2. [Vercel](https://vercel.com)でプロジェクトをインポート
3. 環境変数を設定
4. デプロイ

```bash
# Vercel CLIを使う場合
npm i -g vercel
vercel
```

### 環境変数の設定

Vercel Dashboardで以下の環境変数を設定：
- すべての`NEXT_PUBLIC_*`変数
- `SUPABASE_SERVICE_KEY`
- `OPENROUTER_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- その他のオプション変数

### Stripe Webhookの更新

本番URLでStripe Webhookエンドポイントを更新：
```
https://yourdomain.com/api/stripe/webhook
```

---

## 🧪 テスト

```bash
# ユニットテスト
npm run test

# E2Eテスト
npm run test:e2e

# カバレッジ
npm run test:coverage
```

---

## 🤝 コントリビューション

このプロジェクトは現在プライベートです。コントリビューションガイドラインは後日公開予定です。

---

## 📝 最新の改善

### 2025-11-03
- ✅ Web検索クォータ制御とユーザートグル実装
- ✅ API層での強制クォータチェック

### 2025-11-01
- ✅ サブスクリプションサイクル基準の課金システム修正
- ✅ Enhanced Context 8000トークン対応
- ✅ AI要約機能実装

### 2025-10-29
- ✅ 課金タイムゾーンバグ修正
- ✅ ノード参照機能の強化

### 2025-10-19
- ✅ Stripe Billing Portal統合完了

### 2025-09-17
- ✅ Stripe課金システム実装完了

---

## 📄 ライセンス

Private - All rights reserved

---

## 📞 サポート

- 🐛 バグ報告: [Issues](https://github.com/yourusername/diverge/issues)
- 💬 ディスカッション: [Discussions](https://github.com/yourusername/diverge/discussions)
- 📧 Email: support@diverge.ai

---

<div align="center">

**Built with ❤️ using Next.js, Supabase, and OpenRouter**

[トップに戻る](#diverge---node-based-multi-model-ai-chat-platform)

</div>

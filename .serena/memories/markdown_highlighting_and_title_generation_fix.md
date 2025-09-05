# マークダウン・コードハイライト機能とタイトル生成機能修正

## 実装完了事項

### 1. マークダウン・コードハイライト機能
- **パッケージ追加**: react-markdown, rehype-highlight, remark-gfm, remark-math, rehype-katex
- **MarkdownRenderer コンポーネント作成**: src/components/ui/MarkdownRenderer.tsx
  - シンタックスハイライト（GitHub Dark テーマ）
  - コードブロックのコピー機能
  - KaTeX による数式レンダリング
  - GitHub Flavored Markdown 対応（テーブル、チェックリストなど）
  - カスタムスタイリング（見出し、リスト、引用、リンクなど）
- **右サイドバー統合**: src/components/chat/node-detail-sidebar.tsx
  - AI応答とコメントでMarkdownRenderer使用
  - プレーンテキスト表示からリッチマークダウン表示に変更

### 2. セッションタイトル自動生成機能修正
- **問題**: マークダウン実装後にタイトル生成機能が停止
- **原因**: 
  - HTTPフェッチでのローカルAPI呼び出しが失敗
  - Next.jsサーバーサイドからの同一サーバーAPI呼び出し問題
- **解決策**: src/app/api/chat/with-tools/route.ts
  - 外部APIフェッチを削除
  - OpenRouterClientを直接使用したタイトル生成に変更
  - タイトル生成ロジックを統合

## 機能詳細

### MarkdownRenderer 機能
- **コードハイライト**: 各言語のシンタックスハイライト
- **コピー機能**: コードブロックにホバーでコピーボタン表示
- **数式レンダリング**: インライン数式（$E=mc^2$）とブロック数式対応
- **テーブル**: GitHub Flavored Markdownテーブル
- **チェックリスト**: タスクリスト表示
- **カスタムスタイル**: 見出し、リスト、引用、リンクの統一スタイル

### タイトル生成機能
- **条件**: 最初のノード（depth=0, parentNodeId=null）
- **生成方法**: OpenRouter GPT-4o使用
- **多言語対応**: ユーザーメッセージと同じ言語でタイトル生成
- **キャッシュクリア**: 生成後にクエリキャッシュをクリア

## テスト済み機能
- マークダウンレンダリング（http://localhost:3001/test-markdown）
- 右サイドバーでのマークダウン表示
- タイトル生成API単体テスト
- 統合されたタイトル生成機能

## ファイル変更一覧
- src/components/ui/MarkdownRenderer.tsx（新規作成）
- src/components/chat/node-detail-sidebar.tsx（マークダウン統合）
- src/app/api/chat/with-tools/route.ts（タイトル生成修正）
- src/app/test-markdown/page.tsx（テスト用）
- package.json（マークダウン関連依存関係追加）
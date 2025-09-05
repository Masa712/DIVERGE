'use client'

import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'

const testContent = `# マークダウン・コードハイライトテスト

## 基本的なマークダウン機能

### テキストフォーマット
- **太字テキスト**
- *イタリック*
- \`インラインコード\`
- ~~取り消し線~~

### リスト
1. 順序付きリスト
2. 2つ目の項目
   - ネストされたリスト
   - もう一つのアイテム

### コードブロック

#### JavaScript
\`\`\`javascript
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5)); // 120
\`\`\`

#### Python
\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
\`\`\`

#### TypeScript/React
\`\`\`tsx
interface User {
  id: number;
  name: string;
  email: string;
}

const UserCard: React.FC<{ user: User }> = ({ user }) => {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
};
\`\`\`

### テーブル
| 機能 | 対応状況 | 説明 |
|------|---------|------|
| マークダウン | ✅ | 基本的なマークダウン記法 |
| コードハイライト | ✅ | シンタックスハイライト |
| 数式 | ✅ | KaTeX対応 |
| テーブル | ✅ | GitHub Flavored Markdown |

### 引用
> これは引用文です。
> 複数行にわたる引用も
> 適切に表示されます。

### リンク
[OpenAI](https://openai.com)へのリンクです。

### 数式（KaTeX）
インライン数式: $E = mc^2$

ブロック数式:
$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

### チェックリスト
- [x] マークダウンパーサー実装
- [x] コードハイライト機能
- [ ] 数式レンダリング
- [ ] カスタムスタイル調整`

export default function TestMarkdownPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">
            マークダウンレンダラーテスト
          </h1>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <MarkdownRenderer content={testContent} />
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              右サイドバーでのマークダウン表示をテストするために、
              チャットでAIにマークダウン形式の応答を依頼してください。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
#!/bin/bash

# モデルアクセス制限APIテストスクリプト
# フリープランユーザーが高度なモデルにアクセスできないことを確認

echo "🧪 モデルアクセス制限APIテスト"
echo "================================"
echo ""

# 設定（ブラウザから取得した値に置き換えてください）
SESSION_ID="f11ed08b-b2d3-4129-988b-6a39d5bb17bb"  # 既存のセッションID
BASE_URL="http://localhost:3000"

# 認証Cookieを取得する方法:
# 1. ブラウザでログイン
# 2. 開発者ツール (F12) を開く
# 3. Application/Storage タブ → Cookies → localhost:3000
# 4. sb-<project-id>-auth-token の値をコピー
# 5. 環境変数 AUTH_COOKIE に設定するか、以下で直接入力

# 環境変数が設定されていなければ入力を求める
if [ -z "$AUTH_COOKIE" ]; then
    AUTH_COOKIE="base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSklVekkxTmlJc0ltdHBaQ0k2SW00eWJIcGljV3RuWVd0MlppOUZTRFlpTENKMGVYQWlPaUpLVjFRaWZRLmV5SnBjM01pT2lKb2RIUndjem92TDIxc2NXZGxlRzl3Ym5aeVltcHRlbnBtYVdWMkxuTjFjR0ZpWVhObExtTnZMMkYxZEdndmRqRWlMQ0p6ZFdJaU9pSXlZbVV6TVdWaFl5MDJPV0ZtTFRRell6TXRPR1JqTlMwek1UVTRaVGMwTVdVMFlXWWlMQ0poZFdRaU9pSmhkWFJvWlc1MGFXTmhkR1ZrSWl3aVpYaHdJam94TnpVNU5qTTFNelF5TENKcFlYUWlPakUzTlRrMk16RTNORElzSW1WdFlXbHNJam9pYldGellYbDFhMmt1YTNWc1lXNUFaMjFoYVd3dVkyOXRJaXdpY0dodmJtVWlPaUlpTENKaGNIQmZiV1YwWVdSaGRHRWlPbnNpY0hKdmRtbGtaWElpT2lKbGJXRnBiQ0lzSW5CeWIzWnBaR1Z5Y3lJNld5SmxiV0ZwYkNKZGZTd2lkWE5sY2w5dFpYUmhaR0YwWVNJNmV5SmxiV0ZwYkNJNkltMWhjMkY1ZFd0cExtdDFiR0Z1UUdkdFlXbHNMbU52YlNJc0ltVnRZV2xzWDNabGNtbG1hV1ZrSWpwMGNuVmxMQ0p3YUc5dVpWOTJaWEpwWm1sbFpDSTZabUZzYzJVc0luTjFZaUk2SWpKaVpUTXhaV0ZqTFRZNVlXWXRORE5qTXkwNFpHTTFMVE14TlRobE56UXhaVFJoWmlKOUxDSnliMnhsSWpvaVlYVjBhR1Z1ZEdsallYUmxaQ0lzSW1GaGJDSTZJbUZoYkRFaUxDSmhiWElpT2x0N0ltMWxkR2h2WkNJNkluQmhjM04zYjNKa0lpd2lkR2x0WlhOMFlXMXdJam94TnpVNU16TXpPRE0zZlYwc0luTmxjM05wYjI1ZmFXUWlPaUppWVdGa04yRTVOUzAyWTJKbExUUmlZV0l0WVRjMk5pMDJaR0psWXpNM1kyWTFOamtpTENKcGMxOWhibTl1ZVcxdmRYTWlPbVpoYkhObGZRLmgyVFhManFhMmxfdnl4Mkhyek1ybWVJcGRpTkx1bXNzT3RjeV9oeVhMWlUiLCJ0b2tlbl90eXBlIjoiYmVhcmVyIiwiZXhwaXJlc19pbiI6MzYwMCwiZXhwaXJlc19hdCI6MTc1OTYzNTM0MiwicmVmcmVzaF90b2tlbiI6InQ0NnB4azNzc3YzYSIsInVzZXIiOnsiaWQiOiIyYmUzMWVhYy02OWFmLTQzYzMtOGRjNS0zMTU4ZTc0MWU0YWYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6Im1hc2F5dWtpLmt1bGFuQGdtYWlsLmNvbSIsImVtYWlsX2NvbmZpcm1lZF9hdCI6IjIwMjUtMDktMzBUMTQ6MTU6MDQuNjk0OTI1WiIsInBob25lIjoiIiwiY29uZmlybWF0aW9uX3NlbnRfYXQiOiIyMDI1LTA5LTMwVDE0OjE0OjQ3LjUzNDg4MVoiLCJjb25maXJtZWRfYXQiOiIyMDI1LTA5LTMwVDE0OjE1OjA0LjY5NDkyNVoiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI1LTEwLTAxVDE1OjUwOjM3LjY0NjgxM1oiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6Im1hc2F5dWtpLmt1bGFuQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjJiZTMxZWFjLTY5YWYtNDNjMy04ZGM1LTMxNThlNzQxZTRhZiJ9LCJpZGVudGl0aWVzIjpbeyJpZGVudGl0eV9pZCI6Ijg0ZDQ1MzNiLTA2NjItNDk2ZS1hNzVjLTc2NGRiMzM3MGE5YSIsImlkIjoiMmJlMzFlYWMtNjlhZi00M2MzLThkYzUtMzE1OGU3NDFlNGFmIiwidXNlcl9pZCI6IjJiZTMxZWFjLTY5YWYtNDNjMy04ZGM1LTMxNThlNzQxZTRhZiIsImlkZW50aXR5X2RhdGEiOnsiZW1haWwiOiJtYXNheXVraS5rdWxhbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiIyYmUzMWVhYy02OWFmLTQzYzMtOGRjNS0zMTU4ZTc0MWU0YWYifSwicHJvdmlkZXIiOiJlbWFpbCIsImxhc3Rfc2lnbl9pbl9hdCI6IjIwMjUtMDktMzBUMTQ6MTQ6NDcuNTEyNTUzWiIsImNyZWF0ZWRfYXQiOiIyMDI1LTA5LTMwVDE0OjE0OjQ3LjUxMjYxN1oiLCJ1cGRhdGVkX2F0IjoiMjAyNS0wOS0zMFQxNDoxNDo0Ny41MTI2MTdaIiwiZW1haWwiOiJtYXNheXVraS5rdWxhbkBnbWFpbC5jb20ifV0sImNyZWF0ZWRfYXQiOiIyMDI1LTA5LTMwVDE0OjE0OjQ3LjQ4OTA2M1oiLCJ1cGRhdGVkX2F0IjoiMjAyNS0xMC0wNVQwMjozNTo0Mi44MDYyNDRaIiwiaXNfYW5vbnltb3VzIjpmYWxzZX19"
    read -p "認証Cookie (sb-*-auth-token) を入力してください: " AUTH_COOKIE
fi

if [ -z "$AUTH_COOKIE" ]; then
    echo "❌ エラー: 認証Cookieが設定されていません"
    exit 1
fi

echo ""
echo "📝 テストケース準備完了"
echo "  - Base URL: $BASE_URL"
echo "  - Session ID: $SESSION_ID"
echo ""

# テスト1: フリープランモデル（成功するはず）
echo "テスト1: フリープランモデルでのリクエスト（GPT-4o）"
echo "-------------------------------------------------------"
RESPONSE1=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{
    \"messages\": [{\"role\": \"user\", \"content\": \"Hello, this is a test\"}],
    \"model\": \"openai/gpt-4o-2024-11-20\",
    \"sessionId\": \"$SESSION_ID\",
    \"max_tokens\": 100
  }")

HTTP_CODE1=$(echo "$RESPONSE1" | tail -n1)
BODY1=$(echo "$RESPONSE1" | sed '$d')

if [ "$HTTP_CODE1" -eq 200 ]; then
    echo "✅ 成功: HTTPステータス $HTTP_CODE1"
    echo "📄 レスポンス: $(echo $BODY1 | jq -r '.success // .error' 2>/dev/null || echo $BODY1)"
else
    echo "❌ 失敗: HTTPステータス $HTTP_CODE1"
    echo "📄 レスポンス: $BODY1"
fi

echo ""
echo "================================================================"
echo ""

# テスト2: 高度なモデル（403エラーになるはず）
echo "テスト2: 高度なモデルでのリクエスト（GPT-5 - 制限されるべき）"
echo "-------------------------------------------------------"
RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{
    \"messages\": [{\"role\": \"user\", \"content\": \"Hello, this is a test\"}],
    \"model\": \"openai/gpt-5\",
    \"sessionId\": \"$SESSION_ID\",
    \"max_tokens\": 100
  }")

HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | sed '$d')

if [ "$HTTP_CODE2" -eq 403 ]; then
    echo "✅ 成功: HTTPステータス $HTTP_CODE2 (アクセス拒否)"
    echo "📄 エラーメッセージ: $(echo $BODY2 | jq -r '.error' 2>/dev/null || echo $BODY2)"
else
    echo "❌ 失敗: HTTPステータス $HTTP_CODE2 (403であるべき)"
    echo "📄 レスポンス: $BODY2"
fi

echo ""
echo "================================================================"
echo ""

# テスト3: Claude Opus 4（403エラーになるはず）
echo "テスト3: 高度なモデルでのリクエスト（Claude Opus 4 - 制限されるべき）"
echo "-------------------------------------------------------"
RESPONSE3=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{
    \"messages\": [{\"role\": \"user\", \"content\": \"Hello, this is a test\"}],
    \"model\": \"anthropic/claude-opus-4\",
    \"sessionId\": \"$SESSION_ID\",
    \"max_tokens\": 100
  }")

HTTP_CODE3=$(echo "$RESPONSE3" | tail -n1)
BODY3=$(echo "$RESPONSE3" | sed '$d')

if [ "$HTTP_CODE3" -eq 403 ]; then
    echo "✅ 成功: HTTPステータス $HTTP_CODE3 (アクセス拒否)"
    echo "📄 エラーメッセージ: $(echo $BODY3 | jq -r '.error' 2>/dev/null || echo $BODY3)"
else
    echo "❌ 失敗: HTTPステータス $HTTP_CODE3 (403であるべき)"
    echo "📄 レスポンス: $BODY3"
fi

echo ""
echo "================================================================"
echo ""
echo "📊 テスト結果サマリー"
echo "================================================================"
echo "テスト1 (GPT-4o/許可): $([ "$HTTP_CODE1" -eq 200 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "テスト2 (GPT-5/拒否): $([ "$HTTP_CODE2" -eq 403 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "テスト3 (Opus 4/拒否): $([ "$HTTP_CODE3" -eq 403 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo ""

# 全テスト合格判定
if [ "$HTTP_CODE1" -eq 200 ] && [ "$HTTP_CODE2" -eq 403 ] && [ "$HTTP_CODE3" -eq 403 ]; then
    echo "🎉 全テスト合格！モデルアクセス制限が正常に機能しています。"
    exit 0
else
    echo "⚠️  一部のテストが失敗しました。上記の詳細を確認してください。"
    exit 1
fi

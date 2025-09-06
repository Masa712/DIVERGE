# OAuth認証設定とトラブルシューティング

## 設定完了状況（2025-09-06）

### 動作確認済みプロバイダー
- ✅ **Google OAuth**: 正常動作
- ✅ **X (Twitter) OAuth**: 正常動作  
- ✅ **メール認証**: 正常動作

### 削除済み
- ❌ **Apple OAuth**: 設定困難のため削除

## 主要な問題と解決

### 1. データベーストリガー問題の解決
**問題**: 新規ユーザー登録時に「Database error saving new user」エラー

**原因**: `user_profiles`テーブルへの自動挿入トリガーが不適切

**解決策**: 正しいトリガー関数を作成
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
AS $func$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$func$
LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
```

### 2. Apple OAuth設定の問題（未解決のため削除）
**問題**: "Unable to exchange external code" エラー

**試行した解決策**:
- Services ID完全再作成: `app.divergeai.signin`
- Key完全再作成
- Return URLsとDomains設定確認
- Supabase設定の完全リセット

**最終判断**: 設定が複雑で解決困難のため削除

## 現在のOAuth設定

### Supabase設定
- **Base URL**: `https://divergeai.app`
- **Google Provider**: 有効
- **X (Twitter) Provider**: 有効
- **Apple Provider**: 無効・削除済み

### コールバックURL
```
https://mlqgexopnvrbjmzzfiev.supabase.co/auth/v1/callback
```

### X (Twitter)設定の重要点
- **Request email from users**: 必須で有効化
- **App permissions**: Read and write以上が必要
- Developer アカウントとテスト用アカウントは別にする

## 削除したファイル内容

### src/app/auth/page.tsx
- Apple認証ボタンとAppleIconコンポーネント削除
- handleSocialLogin関数からApple処理削除

### src/components/providers/auth-provider.tsx  
- signInWithApple関数削除
- AuthContextTypeからApple関連削除

## ドメイン移行対応
- 独自ドメイン `divergeai.app` への移行完了
- OAuth認証は新ドメインで正常動作
- ローカル環境でも動作確認済み
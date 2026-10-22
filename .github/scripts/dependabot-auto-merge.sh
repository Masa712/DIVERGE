#!/usr/bin/env bash
# Dependabot のセキュリティ更新PRのうち、安全に取り込めるものだけを自動マージする。
# 条件: 自動検証している依存の種類 / パッチ・マイナー更新 / main に追従済み / すべてのチェックが成功。
# それ以外は「要確認」ラベルとコメントを付けて手動確認に回す。DRY_RUN=true なら判定だけ表示する。
set -euo pipefail

repo="${GITHUB_REPOSITORY}"
base="${BASE_BRANCH:-main}"
auto_ecosystems=" ${AUTO_MERGE_ECOSYSTEMS:-npm_and_yarn pip uv} "
dry_run="${DRY_RUN:-false}"
label="要確認"

if [ "$dry_run" != "true" ]; then
  gh label create "$label" --repo "$repo" --color D93F0B \
    --description "自動マージされなかった依存更新（手動で確認してください）" --force >/dev/null
fi

# 手動確認に回す。コメントはラベルが付いていないとき（初回）だけ残す
flag() {
  local n=$1 reason=$2
  echo "#$n: 手動確認 — $reason"
  [ "$dry_run" = "true" ] && return 0
  if ! gh pr view "$n" --repo "$repo" --json labels --jq '.labels[].name' | grep -qx "$label"; then
    gh pr edit "$n" --repo "$repo" --add-label "$label" >/dev/null
    gh pr comment "$n" --repo "$repo" \
      --body "自動マージの対象外です（${reason}）。内容を確認してからマージしてください。" >/dev/null
  fi
}

# メジャー更新か。0.x はマイナー番号の変化も互換性のない変更として扱う
is_major() {
  local fa fb ta tb
  IFS=. read -r fa fb _ <<<"${1#v}"
  IFS=. read -r ta tb _ <<<"${2#v}"
  [ "$fa" != "$ta" ] && return 0
  [ "$fa" = "0" ] && [ "${fb:-}" != "${tb:-}" ] && return 0
  return 1
}

merged=0
while read -r pr; do
  n=$(jq -r .number <<<"$pr")
  title=$(jq -r .title <<<"$pr")
  branch=$(jq -r .headRefName <<<"$pr")
  sha=$(jq -r .headRefOid <<<"$pr")
  eco=$(cut -d/ -f2 <<<"$branch")

  if [[ "$auto_ecosystems" != *" $eco "* ]]; then
    flag "$n" "自動検証していない種類の依存（$eco）"; continue
  fi
  if [[ ! "$title" =~ from\ v?([0-9][^ ]*)\ to\ v?([0-9][^ ]*) ]]; then
    flag "$n" "複数の依存をまとめた更新"; continue
  fi
  from=${BASH_REMATCH[1]} to=${BASH_REMATCH[2]}
  if is_major "$from" "$to"; then
    flag "$n" "メジャー更新 $from → $to"; continue
  fi

  # main の最新を含む状態で検証されたものだけを対象にする（遅れていれば Dependabot のリベース待ち）
  behind=$(gh api "repos/$repo/compare/$base...$sha" --jq .behind_by)
  if [ "$behind" != "0" ]; then
    echo "#$n: main に追従していないため次回に回す"; continue
  fi

  statuses=$(gh api "repos/$repo/commits/$sha/status" --jq '[.statuses[].state]')
  checks=$(gh api "repos/$repo/commits/$sha/check-runs?per_page=100" \
    --jq '[.check_runs[] | {name, status, conclusion}]')
  if jq -e 'any(.[]; . == "pending")' <<<"$statuses" >/dev/null ||
     jq -e 'any(.[]; .status != "completed")' <<<"$checks" >/dev/null; then
    echo "#$n: チェックが終わっていないため次回に回す"; continue
  fi
  if ! jq -e 'any(.[]; .name == "verify" and .conclusion == "success")' <<<"$checks" >/dev/null; then
    flag "$n" "依存更新の検証（verify）が成功していない"; continue
  fi
  if jq -e 'any(.[]; . != "success")' <<<"$statuses" >/dev/null ||
     jq -e 'any(.[]; (.conclusion // "") as $c | $c != "success" and $c != "skipped" and $c != "neutral")' <<<"$checks" >/dev/null; then
    flag "$n" "失敗しているチェックがある"; continue
  fi

  if [ "$dry_run" = "true" ]; then
    echo "#$n: 自動マージ対象（試行のためマージしない） — $title"; continue
  fi
  if gh pr merge "$n" --repo "$repo" --merge --delete-branch; then
    echo "#$n: 自動マージ — $title"
    merged=$((merged + 1))
  else
    echo "#$n: マージできなかったため次回に回す"
  fi
done < <(gh pr list --repo "$repo" --author "app/dependabot" --state open --base "$base" \
  --json number,title,headRefName,headRefOid --jq '.[] | @json')

echo "自動マージ: ${merged} 件"

# GITHUB_TOKEN によるマージでは push トリガーのワークフローが動かないため、必要なら明示的に起動する
if [ "$merged" -gt 0 ] && [ -n "${POST_MERGE_WORKFLOW:-}" ]; then
  gh workflow run "$POST_MERGE_WORKFLOW" --repo "$repo" --ref "$base"
  echo "$POST_MERGE_WORKFLOW を起動しました"
fi

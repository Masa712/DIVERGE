#!/usr/bin/env bash
# Dependabot のセキュリティ更新PRのうち、安全に取り込めるものだけを自動マージする。
# 条件: 自動検証している依存の種類 / 含まれる更新がすべてパッチ・マイナー / 衝突なし / すべてのチェックが成功。
# 同じディレクトリの更新は1回の実行で1件だけマージし、残りは次回に回す（組み合わせの影響を小さくするため）。
# 条件を満たさないものは「要確認」ラベルとコメントを付けて手動確認に回す。DRY_RUN=true なら判定だけ表示する。
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
merged_dirs=" "
while read -r pr; do
  n=$(jq -r .number <<<"$pr")
  title=$(jq -r .title <<<"$pr")
  branch=$(jq -r .headRefName <<<"$pr")
  sha=$(jq -r .headRefOid <<<"$pr")
  eco=$(cut -d/ -f2 <<<"$branch")

  if [[ "$auto_ecosystems" != *" $eco "* ]]; then
    flag "$n" "自動検証していない種類の依存（$eco）"; continue
  fi

  # タイトルと、本文のうち Dependabot が書く「Bumps …」「Updates `x` from A to B」の行から
  # バージョンの組を拾い、1つでもメジャー更新があれば手動確認にする（リリースノートの引用は対象外）
  pairs=$({ echo "$title"; gh pr view "$n" --repo "$repo" --json body --jq .body | grep -E '^(Bumps|Updates) ' || true; } |
    grep -oE 'from v?[0-9][0-9A-Za-z.+-]*[0-9A-Za-z] to v?[0-9][0-9A-Za-z.+-]*[0-9A-Za-z]' || true)
  if [ -z "$pairs" ]; then
    flag "$n" "更新前後のバージョンを判別できない"; continue
  fi
  major=""
  while read -r _ from _ to; do
    if is_major "$from" "$to"; then major="$from → $to"; break; fi
  done <<<"$pairs"
  if [ -n "$major" ]; then
    flag "$n" "メジャー更新を含む（$major）"; continue
  fi

  dirs=$(gh pr view "$n" --repo "$repo" --json files --jq '[.files[].path | split("/") | .[:-1] | join("/")] | unique | join(",")')
  dirs=${dirs:-/}
  if [[ "$merged_dirs" == *" $dirs "* ]]; then
    echo "#$n: 同じディレクトリを今回すでに更新したため次回に回す"; continue
  fi

  # mergeable は GitHub が問い合わせを受けてから計算するため、UNKNOWN の間は少し待って聞き直す
  for _ in 1 2 3 4 5 6; do
    mergeable=$(gh pr view "$n" --repo "$repo" --json mergeable --jq .mergeable)
    [ "$mergeable" != "UNKNOWN" ] && break
    sleep 5
  done
  if [ "$mergeable" != "MERGEABLE" ]; then
    echo "#$n: 衝突の解消待ち（$mergeable）のため次回に回す"; continue
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
    echo "#$n: 自動マージ対象（試行のためマージしない） — $title"
    merged_dirs+="$dirs "
    continue
  fi
  if gh pr merge "$n" --repo "$repo" --merge --delete-branch; then
    echo "#$n: 自動マージ — $title"
    merged=$((merged + 1))
    merged_dirs+="$dirs "
  else
    echo "#$n: マージできなかったため次回に回す"
  fi
done < <(gh pr list --repo "$repo" --author "app/dependabot" --state open --base "$base" \
  --json number,title,headRefName,headRefOid --jq 'sort_by(.number) | .[] | @json')

echo "自動マージ: ${merged} 件"

# GITHUB_TOKEN によるマージでは push トリガーのワークフローが動かないため、必要なら明示的に起動する
if [ "$merged" -gt 0 ] && [ -n "${POST_MERGE_WORKFLOW:-}" ]; then
  gh workflow run "$POST_MERGE_WORKFLOW" --repo "$repo" --ref "$base"
  echo "$POST_MERGE_WORKFLOW を起動しました"
fi

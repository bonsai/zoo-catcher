#!/usr/bin/env bash
#
# zoo-catcher ゲーム設計の自動化スクリプト
#
# 1回の実行 = 1イテレーション:
#   - CAMEL でゲーム設計セッションを実行
#   - 結果を design/versions/game-design-v{N}.md に保存
#   - design/CHANGELOG.md と design/README.md を更新
#   - game-design ブランチにコミット＆プッシュ
#   - design-v{N} タグを作成
#
# 使い方:
#   bash design/run_iteration.sh
#
# 環境変数:
#   CAMEL_STEPS   会話ステップ数 (default: 4)
#   CAMEL_MODEL   OpenRouter の無料モデル slug (default: openrouter/free)
#   CAMEL_OUTPUT  出力先 (default: design/versions/game-design-v{N}.md)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DESIGN_DIR="design"
VERSIONS_DIR="$DESIGN_DIR/versions"
CHANGELOG="$DESIGN_DIR/CHANGELOG.md"
README="$DESIGN_DIR/README.md"
BRANCH="${DESIGN_BRANCH:-game-design}"
PYTHON_BIN="${PYTHON_BIN:-$HOME/agent/hermes/venv/bin/python}"

echo "==> [1/6] git を最新化"
git fetch origin --tags

echo "==> [2/6] game-design ブランチを確保"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
  git merge --ff-only origin/"$BRANCH" 2>/dev/null || true
else
  git checkout -b "$BRANCH" origin/main
fi
git checkout "$BRANCH" 2>/dev/null || git switch "$BRANCH"

echo "==> [3/6] イテレーション番号を決定"
NEXT=$(ls "$VERSIONS_DIR"/game-design-v*.md 2>/dev/null | wc -l | tr -d ' ')
NEXT=$((NEXT + 1))
OUT="${CAMEL_OUTPUT:-$VERSIONS_DIR/game-design-v$NEXT.md}"
mkdir -p "$VERSIONS_DIR"

echo "==> [4/6] CAMEL 設計セッションを実行 (v$NEXT)"
CAMEL_OUTPUT="$OUT" CAMEL_ITERATION="$NEXT" \
  CAMEL_STEPS="${CAMEL_STEPS:-4}" \
  CAMEL_MODEL="${CAMEL_MODEL:-openrouter/free}" \
  "$PYTHON_BIN" "$DESIGN_DIR/camel_game_design.py"

echo "==> [5/6] CHANGELOG を更新"
DESIGN_SUMMARY="${DESIGN_SUMMARY:-v$NEXT 設計を追加}"
{
  echo "## v$NEXT ($(date '+%Y-%m-%d %H:%M:%S'))"
  echo "- モデル: ${CAMEL_MODEL:-openrouter/free} (free)"
  echo "- ステップ数: ${CAMEL_STEPS:-4}"
  echo "- 成果物: \`$OUT\`"
  echo "- サマリー: $DESIGN_SUMMARY"
  echo ""
} >> "$CHANGELOG"

# README のバージョンテーブルに行を追加
python3 - "$README" "$NEXT" "$DESIGN_SUMMARY" <<'PYEOF'
import sys
readme, n, summary = sys.argv[1], sys.argv[2], sys.argv[3]
with open(readme, encoding="utf-8") as f:
    lines = f.readlines()
row = f"| v{n} | {__import__('datetime').date.today().isoformat()} | OpenRouter free | {summary} | [game-design-v{n}.md](./versions/game-design-v{n}.md) |\n"
out = []
inserted = False
for line in lines:
    if not inserted and line.startswith("|---"):
        out.append(line)
        out.append(row)
        inserted = True
    else:
        out.append(line)
if not inserted:
    out.append(row)
with open(readme, "w", encoding="utf-8") as f:
    f.writelines(out)
print(f"README に v{n} を追記しました")
PYEOF

echo "==> [6/6] コミット・プッシュ"
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
fi

git add "$VERSIONS_DIR" "$CHANGELOG" "$README" "$DESIGN_DIR/camel_game_design.py" "$DESIGN_DIR/run_iteration.sh"
git commit -m "design: game-design v$NEXT — $DESIGN_SUMMARY" || echo "(コミットなし)"

if [ -n "${GITHUB_ACTIONS:-}" ]; then
  git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "$BRANCH"
else
  git push origin "$BRANCH"
fi

if git rev-parse -q --verify "refs/tags/design-v$NEXT" >/dev/null; then
  git tag -d "design-v$NEXT"
fi
git tag "design-v$NEXT"

if [ -n "${GITHUB_ACTIONS:-}" ]; then
  git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "refs/tags/design-v$NEXT"
else
  git push origin "refs/tags/design-v$NEXT"
fi

echo ""
echo "==> 完了: design-v$NEXT を $BRANCH ブランチにプッシュしました"

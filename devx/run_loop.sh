#!/usr/bin/env bash
#
# 自律開発ループ実行ラッパー
#
# 実行: bash devx/run_loop.sh [--max-iterations 3] [--steps 4]
#
# 動作:
#   1. 自律ループ (設計→実装→テスト→評価) を実行
#   2. PASS したら:
#      - Vercel に本番デプロイ (ユーザーがプレイできる状態)
#      - game-design ブランチにコミット・タグ
#   3. 未PASS なら改善コメントを残して終了
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PYTHON_BIN="${PYTHON_BIN:-$HOME/agent/hermes/venv/bin/python}"

echo "==> [1/2] 自律ループ実行"
"$PYTHON_BIN" devx/autonomous_loop.py "$@"
LOOP_EXIT=$?

if [ "$LOOP_EXIT" -ne 0 ]; then
  echo ""
  echo "==> ループがPASSしませんでした。devx/feedback/user_comments.md にコメントを追加して再実行してください。"
  exit "$LOOP_EXIT"
fi

echo ""
echo "==> [2/2] PASS! デプロイ & コミット"
ITERATION=$(python3 -c "import json;print(json.load(open('devx/state.json'))['iteration'])" 2>/dev/null || echo "?")
SCORE=$(python3 -c "import json;print(json.load(open('devx/state.json'))['score'])" 2>/dev/null || echo "?")

# ゲームを Vercel へ本番デプロイ
if command -v vercel >/dev/null 2>&1; then
  echo "==> Vercel にデプロイ..."
  vercel --prod --yes 2>&1 | tail -5 || echo "!! Vercel デプロイに失敗（後で手動で実行可）"
fi

# game-design ブランチにコミット
git fetch origin --tags 2>/dev/null || true
if git show-ref --verify --quiet refs/heads/game-design; then
  git checkout game-design
else
  git checkout -b game-design origin/main
fi

git add public/ devx/ design/ issues/
git commit -m "game: autonomous loop v${ITERATION} (score=${SCORE})" || echo "(コミットなし)"
git push origin game-design 2>&1 | tail -2 || echo "!! プッシュに失敗"

TAG="game-v${ITERATION}"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then git tag -d "$TAG"; fi
git tag "$TAG"
git push origin "refs/tags/$TAG" 2>&1 | tail -1 || true

echo ""
echo "==> 完了: iteration ${ITERATION} (score=${SCORE})"
echo "   プレイURL: https://zoo-catcher.vercel.app/"
echo "   コメントを追加して再度ループ: bash devx/run_loop.sh"

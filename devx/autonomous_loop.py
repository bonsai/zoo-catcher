#!/usr/bin/env python3
"""
zoo-catcher 自律開発ループ

設計 → 実装 → テスト → 評価 → (ループ)

- 設計:   CAMEL RolePlaying (Game Designer × Game Director) で設計書を生成
- 実装:   OpenRouter 無料モデルで 設計書→ public/index.html を生成
- テスト: node devx/test_game.mjs で構造 + 純粋関数ロジックを検証
- 評価:   LLM が設計×実装×テストを採点 (0-100)。閾値以上で PASS
- ループ: PASS するまで (max_iterations 以内) 繰り返す。失敗理由と
          ユーザーコメント (devx/feedback/user_comments.md) を次回に反映

使い方:
  python3 devx/autonomous_loop.py [--max-iterations 3] [--steps 4]
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEVX = ROOT / "devx"
PUBLIC_HTML = ROOT / "public" / "index.html"
VENV_PY = Path(os.environ.get("PYTHON_BIN", Path.home() / "agent/hermes/venv/bin/python"))

sys.path.insert(0, str(ROOT))

from devx.llm import chat, extract_code_block  # noqa: E402

EVALUATE_THRESHOLD = int(os.environ.get("EVALUATE_THRESHOLD", "75"))
REQUIREMENTS = """# Issue 006: ゲームループ改善の要件
1. ゲーム状態: start-screen / game-screen / end-screen の3画面
2. タイム制ラウンド: 60秒カウントダウン
3. キャッチ機構: 照らした動物をクリック/タップで捕獲、スコア加算
4. エスケープ機構: 照らされ続けた動物は逃げる
5. コンボ倍率: 連続捕獲でスコア倍率アップ
6. レア動物: 低確率で出現し高得点 (5倍)
7. 難易度スケーリング: 時間経過で速度・動物数が増加
8. ハイスコア: localStorage で永続化
9. タッチ対応: モバイル対応
"""

TEST_CONTRACT = """# window.ZooCatcherTest 公開契約（テストが依存）
ゲームの <script> 内で以下の純粋関数を window.ZooCatcherTest に公開すること:
- calcPoints({base, combo, rare}) -> number   (combo で増倍、rare は5倍)
- roundDuration() -> number                   (60)
- animalSpeed({level}) -> number              (level が上がると増加)
- nextCombo({combo, success, maxCombo}) -> number (successで+1, 失敗で0, maxCombo上限)
- maxAnimals({level, base}) -> number         (level が上がると base 以上に増加)
DOM に依存しない純粋関数にすること（テストはヘッドレス実行）。"""


def read_feedback() -> str:
    path = DEVX / "feedback" / "user_comments.md"
    if path.exists():
        text = path.read_text(encoding="utf-8").strip()
        if text:
            return text
    return "(ユーザーコメントなし)"


def run_camel_design(iteration: int, steps: int, feedback: str, out_path: Path) -> str:
    """CAMEL RolePlaying で設計書を生成。"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env["CAMEL_OUTPUT"] = str(out_path)
    env["CAMEL_ITERATION"] = str(iteration)
    env["CAMEL_STEPS"] = str(steps)
    script = ROOT / "design" / "camel_game_design.py"
    print(f"  [design] CAMEL セッション実行 (iteration={iteration})")
    try:
        subprocess.run([str(VENV_PY), str(script)], check=True, env=env, capture_output=True, text=True, timeout=1800)
    except subprocess.CalledProcessError as e:
        print("  [design] CAMEL エラー:", e.stderr[-500:])
        raise
    text = out_path.read_text(encoding="utf-8")
    print(f"  [design] 生成: {out_path.name} ({len(text)} bytes)")
    return text


def phase_implement(iteration: int, design_text: str, feedback: str) -> str:
    """LLM で public/index.html を生成。"""
    current = PUBLIC_HTML.read_text(encoding="utf-8") if PUBLIC_HTML.exists() else "(なし)"
    system = (
        "あなたは熟練のウェブゲーム開発者です。与えられた設計書と要件から、"
        "vanilla HTML/CSS/JavaScript の単一ファイルゲームを実装します。"
        "出力は ```html のコードブロック1つのみ。説明は不要。"
    )
    user = f"""{REQUIREMENTS}

{TEST_CONTRACT}

# 最新の設計書
{design_text[:8000]}

# ユーザーのプレイコメント（次の改善に反映）
{feedback}

# 現在の実装
```html
{current[:3000]}
```

# 指示
- 上記設計書・要件に沿って、改善したゲームを HTML1ファイルで実装し ```html で出力してください。
- start-screen / game-screen / end-screen の3画面、canvas、スコア・タイマー・コンボ表示を必ず含めること。
- ライト（懐中電灯）で暗闇の動物を探すオリジナルの遊び心を維持しつつ、キャッチ・スコア・コンボ・レア動物・難易度スケーリング・ハイスコアを実装すること。
- window.ZooCatcherTest に上記の純粋関数を必ず公開すること。
- タッチ/クリック両対応にすること。
"""
    print("  [implement] LLM が実装を生成中...")
    resp = chat(system, user, max_tokens=6000, temperature=0.4)
    code = extract_code_block(resp, language="html")
    if not code:
        # コードブロック無し → 応答全体を使う（<html> を含む場合）
        if "<html" in resp or "<!doctype" in resp:
            code = resp
    if not code:
        raise RuntimeError("実装フェーズ: HTML コードブロックを抽出できませんでした")
    PUBLIC_HTML.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_HTML.write_text(code.strip() + "\n", encoding="utf-8")
    print(f"  [implement] public/index.html を更新 ({len(code)} bytes)")
    return code


def phase_test(iteration: int) -> dict:
    """node テストランナーを実行。"""
    print("  [test] node devx/test_game.mjs 実行")
    try:
        proc = subprocess.run(
            ["node", "devx/test_game.mjs"],
            cwd=str(ROOT), capture_output=True, text=True, timeout=120,
        )
        output = proc.stdout + proc.stderr
    except subprocess.CalledProcessError as e:
        output = e.stdout + e.stderr
    # RESULT 行から pass/fail を抽出
    m = re.search(r"RESULT:\s*(\d+)/(\d+) passed", output)
    passed = int(m.group(1)) if m else 0
    total = int(m.group(2)) if m else 0
    report = {"passed": passed, "total": total, "output": output}
    print(f"  [test] {passed}/{total} passed")
    return report


def phase_evaluate(iteration: int, design_text: str, implement_text: str, test: dict, feedback: str) -> dict:
    """LLM で採点。"""
    system = (
        "あなたは厳しいゲーム設計レビュアーです。設計書・実装・テスト結果を評価し、"
        "JSON のみを返してください。"
    )
    user = f"""{REQUIREMENTS}

# 設計書
{design_text[:6000]}

# 実装 (public/index.html, 先頭4000文字)
{implement_text[:4000]}

# テスト結果
{test['output'][:2000]}

# ユーザーコメント
{feedback}

以下のJSONで回答してください:
{{"score": 0-100の整数, "passed": true/false, "summary": "1-2行の総評", "suggestions": ["改善点1", "改善点2", "改善点3"]}}
スコアの目安: 要件9項目をどれだけ満たし、実装が機能するか。{EVALUATE_THRESHOLD}点以上で passed=true。
"""
    print("  [evaluate] LLM が採点中...")
    resp = chat(system, user, max_tokens=1500, temperature=0.2)
    m = re.search(r"\{[\s\S]*\}", resp)
    raw = m.group(0) if m else resp
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {"score": 0, "passed": False, "summary": f"JSONパース失敗: {resp[:200]}", "suggestions": []}
    data["score"] = int(data.get("score", 0))
    data["passed"] = bool(data.get("passed", False))
    print(f"  [evaluate] score={data['score']} passed={data['passed']}")
    return data


def save_report(iteration: int, phase: str, text: str) -> None:
    dirp = DEVX / "reports"
    dirp.mkdir(parents=True, exist_ok=True)
    (dirp / f"loop-{iteration}-{phase}.md").write_text(text, encoding="utf-8")


def save_state(state: dict) -> None:
    (DEVX / "state.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def load_state() -> dict:
    path = DEVX / "state.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"iteration": 0, "score": 0, "passed": False}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-iterations", type=int, default=int(os.environ.get("MAX_ITERATIONS", "3")))
    ap.add_argument("--steps", type=int, default=int(os.environ.get("CAMEL_STEPS", "4")))
    ap.add_argument("--force", action="store_true", help="PASS済みでも最初から実行")
    args = ap.parse_args()

    state = load_state()
    start = 0 if args.force else state.get("iteration", 0)
    feedback = read_feedback()

    print(f"== 自律ループ開始 (max_iterations={args.max_iterations}, start={start}) ==")
    print(f"== ユーザーコメント: {feedback[:100]} ==")

    for i in range(1, args.max_iterations + 1):
        iteration = start + i
        print(f"\n### iteration {iteration}")

        # 1. 設計
        design_path = DEVX / "designs" / f"design-v{iteration}.md"
        try:
            design_text = run_camel_design(iteration, args.steps, feedback, design_path)
        except Exception as e:
            print(f"設計フェーズ失敗: {e}")
            return 1

        # 2. 実装
        try:
            implement_text = phase_implement(iteration, design_text, feedback)
        except Exception as e:
            print(f"実装フェーズ失敗: {e}")
            return 1
        # バージョンコピーを保存
        game_dir = DEVX / "game"
        game_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PUBLIC_HTML, game_dir / f"game-v{iteration}.html")

        # 3. テスト
        test = phase_test(iteration)
        save_report(iteration, "test", test["output"])

        # 4. 評価
        evaluation = phase_evaluate(iteration, design_text, implement_text, test, feedback)
        save_report(iteration, "evaluate", json.dumps(evaluation, ensure_ascii=False, indent=2))

        state.update({"iteration": iteration, "score": evaluation["score"], "passed": evaluation["passed"]})
        save_state(state)

        if evaluation["passed"]:
            print(f"\n== PASS: iteration {iteration} (score={evaluation['score']}) ==")
            print("総評:", evaluation["summary"])
            return 0
        else:
            print(f"== 未PASS (score={evaluation['score']})。次イテレーションへ。 ==")
            # 評価サジェスチョンをフィードバックに追記して次回へ
            suggestions = evaluation.get("suggestions", [])
            if suggestions:
                feedback_path = DEVX / "feedback" / "auto_feedback.md"
                lines = [f"## iteration {iteration} の自動フィードバック"] + [f"- {s}" for s in suggestions]
                feedback_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"\n== {args.max_iterations} 回でPASSしませんでした。最後のスコア: {state.get('score')} ==")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

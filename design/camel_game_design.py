#!/usr/bin/env python3
"""
CAMEL (Communicative Agents) による zoo-catcher ゲーム設計ワークフロー

RolePlaying society を使って、Game Designer（アシスタント）と
Game Director（ユーザー役）の対話でゲーム設計を生成する。

実行: ~/agent/hermes/venv/bin/python design/camel_game_design.py
"""
import os
import sys
import json
from datetime import datetime

from camel.models import ModelFactory
from camel.types import ModelPlatformType, ModelType
from camel.societies import RolePlaying

OUTPUT_MD = os.environ.get(
    "CAMEL_OUTPUT",
    os.path.join(os.path.dirname(__file__), "zoo-catcher-game-design.md"),
)
STEPS = int(os.environ.get("CAMEL_STEPS", "6"))
ITERATION = os.environ.get("CAMEL_ITERATION", "?")
# OpenRouter の無料モデル slug のみ指定可能
DEFAULT_MODEL_SLUG = "openrouter/free"
MODEL_SLUG = os.environ.get("CAMEL_MODEL", DEFAULT_MODEL_SLUG)

TASK_PROMPT = """# タスク: zoo-catcher ゲーム設計書の作成

「Zoo Catcher」は、暗い部屋を🔦ライトで照らして動物を探すフラッシュライトゲームです。
現在の実装は「ライトを5秒間つける」だけのシンプルなものです。

以下のゲームループ改善（Issue 006 参照）を盛り込んだ、具体的で実装可能なゲーム設計書を
日本語で作成してください。

要件:
1. ゲーム状態: スタート画面 → プレイ中 → ゲームオーバー → もう一度
2. タイム制ラウンド: 60秒のカウントダウン
3. キャッチ機構: 照らした動物をクリックで捕獲
4. エスケープ機構: 照らされ続けた動物は逃げる
5. コンボ倍率: 連続捕獲でスコア倍率アップ
6. レア動物: 低確率で出現し高得点
7. 難易度スケーリング: 時間経過で速度・数を増加
8. ハイスコア: localStorage で永続化
9. タッチ対応: モバイル対応

設計書には以下を含めてください:
- ゲームコンセプトと遊びの流れ
- 詳細なゲームルール（数値: スコア、コンボ、タイマー、難易度曲線）
- スコアリング仕様
- 動物の種類と特性
- UI/画面レイアウト
- ゲームフロー図（テキスト）
- 実装上の注意点（バランス調整パラメータ）
"""


def msg_text(msg) -> str:
    """BaseMessage からテキストを取り出す（multimodal 対応）。"""
    content = getattr(msg, "content", "")
    if isinstance(content, str):
        return content
    parts = []
    for item in content:
        if isinstance(item, dict):
            if item.get("type") == "text":
                parts.append(item.get("text", ""))
        elif isinstance(item, str):
            parts.append(item)
    return "\n".join(p for p in parts if p)


def make_model():
    """OpenRouter の無料モデル（:free slug）のみを使用する。
    モデルは環境変数 CAMEL_MODEL で指定（デフォルト: google/gemma-4-31b-it:free）。
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise SystemExit("OPENROUTER_API_KEY が設定されていません")
    if not MODEL_SLUG.endswith(":free"):
        print(f"警告: {MODEL_SLUG} は :free ではありません。無料モデルのみ使用します。", file=sys.stderr)
    model = ModelFactory.create(
        model_platform=ModelPlatformType.OPENROUTER,
        model_type=MODEL_SLUG,
        api_key=api_key,
    )
    print(f"==> モデル: OpenRouter / {MODEL_SLUG} (free only)", flush=True)
    return model


def main() -> int:
    model = make_model()

    print("==> RolePlaying society を初期化中...", flush=True)
    role_play = RolePlaying(
        assistant_role_name="Game Designer",
        user_role_name="Game Director",
        task_prompt=TASK_PROMPT,
        with_task_specify=True,
        output_language="Japanese",
        model=model,
    )

    print("==> 対話を開始...", flush=True)
    assistant_msg = role_play.init_chat()

    transcript = [
        f"# CAMEL Game Design Session",
        f"- 日時: {datetime.now().isoformat()}",
        f"- イテレーション: v{ITERATION}",
        f"- モデル: OpenRouter / {MODEL_SLUG} (free) (CAMEL {__import__('camel').__version__})",
        f"- ステップ数: {STEPS}",
        "",
        f"## Task Prompt",
        "```",
        TASK_PROMPT,
        "```",
        "",
    ]

    for i in range(STEPS):
        try:
            user_response, assistant_response = role_play.step(assistant_msg)
        except Exception as exc:
            transcript.append(f"\n### Step {i+1} エラー\n```\n{exc}\n```\n")
            break

        user_text = msg_text(user_response.msg)
        assistant_text = msg_text(assistant_response.msg)

        transcript.append(f"## Step {i+1}")
        transcript.append(f"\n**Game Director (user):**\n{user_text}\n")
        transcript.append(f"**Game Designer (assistant):**\n{assistant_text}\n")

        print(f"\n--- Step {i+1} ---", flush=True)
        print(f"[Director] {user_text[:300]}", flush=True)
        print(f"[Designer] {assistant_text[:300]}", flush=True)

        assistant_msg = assistant_response.msg

        if assistant_response.terminated:
            print("\n==> 会話が終了しました (terminated)", flush=True)
            break

    os.makedirs(os.path.dirname(OUTPUT_MD), exist_ok=True)
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(transcript))
    print(f"\n==> 設計書を保存しました: {OUTPUT_MD}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

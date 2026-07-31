# DevX — 自律開発ループ

エージェントが **設計 → 実装 → テスト → 評価** を自律的にループし、
あなたはプレイしてコメントするだけでゲームが進化する仕組み。

## ループの流れ

```
┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ 設計    │ →  │ 実装    │ →  │ テスト  │ →  │ 評価    │ ── PASS ──→ デプロイ 🎮
│ CAMEL  │    │ OpenRouter│   │ Node    │   │ LLM採点 │       │
└────────┘    └────────┘    └────────┘    └────────┘       │
     ↑                                          │          │
     └────── 未PASS: 改善案 + ユーザーコメント ──┘          │
                                                            ↓
                                        Vercelでプレイ → コメント追加 → 再ループ
```

## 使い方

### 1. 実行（PASSまで自動ループ）

```bash
bash devx/run_loop.sh --max-iterations 3 --steps 4
```

PASSしたら自動で：
- Vercel本番デプロイ → https://zoo-catcher.vercel.app/
- `game-design`ブランチにコミット＋`game-v{N}`タグ

### 2. プレイしてコメント

`devx/feedback/user_comments.md` に感想・要望を追記：

```markdown
- 暗すぎて動物が見えない
- 捕まえた時の音が欲しい
```

### 3. 再実行

```bash
bash devx/run_loop.sh
```

コメントが次回の設計・実装に反映されます。

## 構成

```
devx/
├── autonomous_loop.py      # オーケストレーター（設計→実装→テスト→評価→ループ）
├── llm.py                  # OpenRouter無料モデル呼び出し
├── test_game.mjs           # Node自動テスト（構造 + 純粋関数ロジック）
├── run_loop.sh             # 実行ラッパー（デプロイ・コミット）
├── feedback/
│   └── user_comments.md    # ★ ユーザーコメント（あなたが書く場所）
├── designs/                # 各イテレーションの設計書
├── game/                   # 各イテレーションのゲームHTML
└── reports/                # テスト・評価レポート
```

## 環境変数

| 変数 | 説明 | デフォルト |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouterキー（freeのみ） | 必須 |
| `CAMEL_MODEL` | モデルslug | `openrouter/free` |
| `CAMEL_STEPS` | 設計セッションのステップ数 | 4 |
| `MAX_ITERATIONS` | 最大ループ回数 | 3 |
| `EVALUATE_THRESHOLD` | PASS判定スコア | 75 |

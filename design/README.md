# zoo-catcher ゲーム設計（自動生成）

CAMEL（Communicative Agents）の RolePlaying 対話で、ゲーム設計書を自動生成・進化させる。

## 設計の進化

| バージョン | 日時 | モデル | サマリー | 成果物 |
|---|---|---|---|---|
| v2 | 2026-08-01 | OpenRouter free | v2: クラス設計（Player/Animal/GameManager）を追加 | [game-design-v2.md](./versions/game-design-v2.md) |
| v1 | 2026-08-01 | OpenRouter free | 初版（手動実行） | [game-design-v1.md](./versions/game-design-v1.md) |

最新の一覧は [CHANGELOG.md](./CHANGELOG.md) を参照。

## 実行方法

### ローカル

```bash
bash design/run_iteration.sh
```

環境変数で調整可能:

```bash
CAMEL_STEPS=6 CAMEL_MODEL=openrouter/free bash design/run_iteration.sh
```

### GitHub Actions（自動）

- 毎週月曜 09:00 UTC に自動実行（`.github/workflows/game-design.yml`）
- Actions タブの **Run workflow** から手動実行も可能
- 秘密情報 `OPENROUTER_API_KEY` をリポジトリシークレットに設定すること

## ブランチ戦略

- `game-design` ブランチに全イテレーションの設計書が蓄積される
- 各イテレーションは `design-v{N}` タグで特定可能
- git の履歴（コミット・タグ・差分）がそのまま「進化の過程」になる

## 構成

```
design/
├── camel_game_design.py   # CAMEL RolePlaying セッション
├── run_iteration.sh       # 自動化ラッパー（実行→保存→コミット→プッシュ→タグ）
├── CHANGELOG.md           # 進化ログ
├── README.md              # 本ファイル
└── versions/
    └── game-design-v{N}.md  # バージョン別設計書
```

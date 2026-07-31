# CAMEL Game Design Session
- 日時: 2026-08-01T00:58:52.621951
- イテレーション: v2
- モデル: OpenRouter / openrouter/free (free) (CAMEL 0.2.90)
- ステップ数: 4

## Task Prompt
```
# タスク: zoo-catcher ゲーム設計書の作成

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

```

## Step 1

**Game Director (user):**
Solution:  
ゲームの基本システムを構成する3つのクラス（`Player`、`Animal`、`GameManager`）の設計図を以下に示します。それぞれのクラスの属性、メソッド、および相互作用を詳細に定義します。

---

### 1. **Playerクラス**  
**役割**: スコア、コンボ、タイマーの管理とゲーム終了条件の判定を担います。  
**属性**:  
- `score: int` → プレイヤーの現在スコア  
- `combo: int` → 現在のコンボ数  
- `max_combo: int` → 最高コンボ記録  
- `timer: float` → ゲーム開始から60秒までのカウントダウン  
- `combo_timer: float` → コンボ減衰タイマー（コンボが減るまでの時間）  
- `is_alive: bool` → ゲームが進行中かどうか  

**メソッド**:  
- `add_score(point: int) -> None`  
  - 基本点にコンボ倍率を適用してスコアを加算  
  - 例: `self.score += point * (1.2 ** (self.combo - 1))`  
- `update_combo() -> None`  
  - コンボを1つ上げる  
  - `self.combo += 1`  
- `reduce_combo() -> None`  
  - コンボを1つ下げる（最低0）  
  - `self.combo = max(0, self.combo - 1)`  
- `update_timer(delta_time: float) -> None`  
  - タイマーを減少させ、60秒経過時にゲーム終了  
- `reset() -> None`  
  - スコア、コンボ、タイマーをリセット  
  - 例: `self.score = 0; self.combo = 0; self.timer = 60.0`  

---

### 2. **Animalクラス**  
**役割**: 動物の種類、レア度、出現速度、およびポイントの管理を担います。  
**属性**:  
- `type: str` → "Rabbit", "Fox", "Panda"  
- `rarity_level: str` → "Common" or "Rare"  
- `base_point: int` → 基本ポイント（Rabbit/Fox: 10, Panda: 50）  
- `speed: float` → 出現速度（難易度に応じて変化）  
- `escape_time: float` → 逃げるまでの時間（5秒）  
- `created_time: float` → 動物が生成されたゲーム内時間  

**メソッド**:  
- `is_rare() -> bool`  
  - レアであるか判定（Pandaのみ2%出現率）  
  - 例: `if self.type == "Panda" and random() < 0.02: return True`  
- `get_point() -> int`  
  - 基本ポイントを返す（レアの場合は50）  
- `adjust_speed(difficulty_multiplier: float) -> None`  
  - 難易度倍率に基づいて速度を増加  
  - 例: `self.speed *= difficulty_multiplier`  
- `has_escaped(current_time: float) -> bool`  
  - 逃げたか判定（`current_time - self.created_time > self.escape_time`）  

---

### 3. **GameManagerクラス**  
**役割**: ゲームの進行管理、難易度上昇のロジック、動物の生成・管理を担います。  
**属性**:  
- `player: Player` → プレイヤーオブジェクト  
- `animals: list[Animal]` → 現在画面に表示される動物リスト  
- `elapsed_time: float` → ゲーム進行時間  
- `difficulty_level: int` → 難易度段階（初期値: 1）  
- `base_spawn_interval: float` → 動物生成間隔（秒）  
- `combo_penalty: int` → コンボ減少ペナルティ（例: -5点）  

**メソッド**:  
- `start_game() -> None`  
  - 初期設定（タイマー60秒、動物生成開始）  
- `update(delta_time: float) -> None`  
  - 1. `player.update_timer(delta_time)`  
  - 2. `elapsed_time`更新  
  - 3. 難易度上昇判定（10秒ごとに`increase_difficulty()`呼出)  
  - 4. 動物生成（`add_animal()`を定期的に呼出）  
  - 5. 逃げた動物の処理（`check_escape()`）  
- `add_animal() -> None`  
  - 動物を生成し`animals`リストに追加  
  - 例: `animal = Animal(type="Rabbit", rarity="Common")`  
  - 生成間隔は`base_spawn_interval * difficulty_level`で調整  
- `increase_difficulty() -> None`  
  - 難易度を1段階上げる  
  - 動物の出現速度を10%増加させる  
  - 生成される動物の数を1体増やす  
- `check_escape() -> None`  
  - 全ての動物をチェックし、逃げた場合は以下の処理を実行:  
    - `player.reduce_combo()`  
    - `player.add_score(-self.combo_penalty)`  
    - 動物を`animals`リストから削除  
- `handle_capture(animal: Animal) -> None`  
  - プレイヤーが動物を捕獲した時の処理:  
    - `player.add_score(animal.get_point())`  
    - `player.update_combo()`  
    - 動物をリストから削除  
- `end_game() -> None`  
  - タイマーが0になった時に呼出  
  - `player.is_alive = False`  
- `retry() -> None`  
  - ゲームをリセットし再開  
  - `player.reset()`  
  - `self.animals.clear()`  

---

### 4. **クラス間の相互作用**  
1. **GameManager → Player**:  
   - `GameManager.update()`が`player.update_timer()`を呼出し、タイマーを管理  
   - `GameManager.check_escape()`が`player.reduce_combo()`と`player.add_score()`を呼出し  

2. **GameManager → Animal**:  
   - `GameManager.add_animal()`が`Animal`オブジェクトを生成し、`GameManager.animals`に追加  
   - `Animal.adjust_speed()`が`GameManager.increase_difficulty()`によって呼び出される  

3. **Player → GameManager**:  
   - `Player`がキャプチャー時に`GameManager.handle_capture()`を呼び出す（UIや入力ハンドラから）  

---

### 5. **パラメータのバランスポイント**  
- **コンボ減衰**: `Player.combo_timer`を設定（例: 3秒）し、タイマーが0になると`reduce_combo()`を呼ぶ  
- **逃げ時間**: `Animal.escape_time`を5秒に固定  
- **レア出現率**: `Animal.is_rare()`で2%の確率を設定  

Next request.

**Game Designer (assistant):**
Instruction: ゲームの基本システムを定義するための「クラス設計図（オブジェクト構成）」を作成してください。対象は「プレイヤー（スコア、コンボ、タイマー）」「動物（種類、出現速度、レア度）」「ゲーム管理（時間経過による難易度上昇のロジック）」の3点です。
Input: None

## Step 2

**Game Director (user):**
Solution:  
プレイヤークラスの具体的なコード構造を以下に示します。スコア計算ロジック（基本点×コンボ倍率）とタイマー更新処理を重点的に設計しています。

---

### **Playerクラス 実装コード**

```python
import math

class Player:
    def __init__(self):
        # 基本属性
        self.score = 0                    # 現在スコア
        self.combo = 0                    # 現在コンボ数
        self.max_combo = 0                # 最高コンボ記録
        
        # タイマー関連
        self.timer = 60.0                 # 残り時間（60秒）
        self.is_alive = True              # ゲーム進行フラグ
        
        # コンボ減衰関連（3秒間キャプチャーなしでコンボ減少）
        self.combo_decay_timer = 0.0
        self.combo_decay_threshold = 3.0  # コンボ減衰閾値（秒）
        
        # 難易度連動パラメータ（GameManagerから参照される）
        self.current_difficulty_multiplier = 1.0

    def calculate_score(self, base_points: int) -> int:
        """
        スコア計算ロジック：基本点 × コンボ倍率
        コンボ倍率 = 1.2^combo（コンボが増えるごとに指数関数的に増加）
        """
        # コンボ倍率の計算（例：combo=3 → 1.2^3 = 1.728）
        combo_multiplier = math.pow(1.2, self.combo)
        
        # 最終スコアの算出（小数点切り捨て）
        final_score = int(base_points * combo_multiplier)
        
        return final_score

    def add_score(self, base_points: int) -> int:
        """
        スコア加算処理：キャプチャー時に呼び出す
        戻り値：実際に加算されたスコア値
        """
        # スコア計算
        gained_points = self.calculate_score(base_points)
        
        # スコア加算
        self.score += gained_points
        
        # コンボ更新
        self.update_combo()
        
        # コンボ減衰タイマーリセット（キャプチャーでリセット）
        self.reset_combo_decay_timer()
        
        return gained_points

    def update_combo(self) -> None:
        """コンボを1つ増やし、最高記録を更新"""
        self.combo += 1
        if self.combo > self.max_combo:
            self.max_combo = self.combo

    def reduce_combo(self) -> None:
        """コンボをリセット（動物に逃げられた場合など）"""
        self.combo = 0
        self.combo_decay_timer = 0.0

    def update_timer(self, delta_time: float) -> bool:
        """
        タイマー更新処理：1フレームごとに呼び出す
        delta_time: 前フレームからの経過時間（秒）
        戻り値：True=ゲーム継続、False=タイムオーバー
        """
        if not self.is_alive:
            return False
            
        # タイマー減算
        self.timer -= delta_time
        
        # タイムオーバー判定
        if self.timer <= 0:
            self.timer = 0
            self.is_alive = False
            return False  # ゲームオーバー
            
        return True  # ゲーム継続

    def update_combo_decay(self, delta_time: float) -> None:
        """
        コンボ減衰処理：一定時間キャプチャーがないとコンボが下がる
        """
        if self.combo > 0:
            self.combo_decay_timer += delta_time
            
            # 閾値を超えたらコンボを1つ減らす
            if self.combo_decay_timer >= self.combo_decay_threshold:
                self.combo = max(0, self.combo - 1)
                self.combo_decay_timer = 0.0  # リセットしてから再スタート

    def reset_combo_decay_timer(self) -> None:
        """キャプチャー成功時にコンボ減衰タイマーをリセット"""
        self.combo_decay_timer = 0.0

    def apply_escape_penalty(self) -> int:
        """
        逃げられた際のペナルティ処理：-5点
        戻り値：減算されたスコア値（負の値）
        """
        penalty = -5
        self.score = max(0, self.score + penalty)  # スコアがマイナスにならないように
        self.reduce_combo()  # コンボもリセット
        return penalty

    def reset(self) -> None:
        """ゲームリセット時の全初期化"""
        self.score = 0
        self.combo = 0
        self.max_combo = 0
        self.timer = 60.0
        self.combo_decay_timer = 0.0
        self.is_alive = True
        self.current_difficulty_multiplier = 1.0
```

---

### **設計のポイント解説**

#### 1. **スコア計算ロジックの詳細**
- `calculate_score()`メソッドで`math.pow(1.2, self.combo)`を使用し、コンボ数に応じて指数関数的にスコアが増加します
- 例：コンボ3の状態でうさぎ（基本点10）を捕獲 → `10 × 1.2³ = 10 × 1.728 = 17点`
- コンボ5のパンダ（基本点50）捕獲 → `50 × 1.2⁵ = 50 × 2.488 = 124点`

#### 2. **タイマー更新処理の流れ**
- `update_timer()`はゲームループの毎フレーム呼び出しを想定
- `delta_time`（フレーム間の経過時間）を引数として受け取り、60秒から減算
- `timer <= 0`になった時点で`is_alive = False`にし、ゲームオーバーを通知
- 戻り値を`bool`で返すことで、GameManager側で分岐処理が容易になります

#### 3. **コンボ減衰システム**
- `combo_decay_threshold`（3秒）を超えるとキャプチャーがなくてもコンボが1つ減少
- これにより、長時間キャプチャーできないとスコア倍率が下がるプレッシャーを演出
- `reset_combo_decay_timer()`を`add_score()`内で呼び出し、成功時に減衰をリセット

#### 4. **逃げ処理との連携**
- `apply_escape_penalty()`で-5点のペナルティ適用と同時にコンボリセット
- スコアが0を下回らないよう`max(0, ...)`で保護

Next request.

**Game Designer (assistant):**


Instruction: プレイヤークラスの属性とメソッドを具体的なコード構造で設計してください。スコア計算ロジック（基本点×コンボ倍率）とタイマー更新処理を重点的に記述。


## Step 3

**Game Director (user):**
Solution:  
以下に **Animalクラス** の具体的なコード構造を示します。  
① 種類（Rabbit・Fox・Panda）  
② レア度（2% の確率で出現）  
③ 出現速度（ゲームの難易度が上がるにつれて 10 秒毎に 10% 増加）  
④ 逃げ判定（照射（キャプチャー）されないまま 5 秒経過すると ‑5 点）  
のロジックをすべて実装した設計です。

---

### 1. クラス全体コード

```python
import random
import time
from typing import List

# -------------------------------------------------
# 共通定数（ゲームバランス調整用）
# -------------------------------------------------
BASE_SPAWN_INTERVAL = 10.0      # 初期の動物生成間隔（秒）
SPAWN_INTERVAL_MULTIPLIER = 1.10 # 難易度上昇ごとの倍率（10% 増加）
ESCAPE_INTERVAL = 5.0          # 照射されないまま逃げるまでの時間（秒）
ESCAPE_PENALTY = -5            # 逃げ時のペナルティ点数
RARITY_PANDA = 0.02            # パンダの出現率（2%）
RABBIT_BASE_POINTS = 10        # うさぎの基本点数
FOX_BASE_POINTS = 10           # キツネの基本点数
PANDA_BASE_POINTS = 50         # パンダの基本点数
```

```python
class Animal:
    """
    ゲーム内で出現する動物のベースクラス
    種類・レア度・出現速度・逃げ判定を管理
    """
    def __init__(
        self,
        animal_type: str,
        spawn_interval: float,
        rarity: str,
        base_point: int,
        created_time: float,
    ):
        # 基本属性
        self.type = animal_type                     # "Rabbit"/"Fox"/"Panda"
        self.rarity = rarity                        # "Common"/"Rare"
        self.base_point = base_point                # 基本スコア
        self.created_time = created_time            # 生成されたゲーム時刻（秒）
        self.spawn_interval = spawn_interval        # 出現間隔（秒）

        # 逃げ判定フラグ（GameManager側が管理）
        self.escaped = False

    # -------------------------------------------------
    # 種類判定・レア度判定・得点取得
    # -------------------------------------------------
    def is_rare(self) -> bool:
        """パンダであるかつ2%の確率でレア扱いにする"""
        return self.type == "Panda" and random.random() < RARITY_PANDA

    def get_point(self) -> int:
        """基本ポイントを返す（レア時も同じ基本点を使用）"""
        return self.base_point

    # -------------------------------------------------
    # 出現速度の動的調整（GameManagerから呼び出し）
    # -------------------------------------------------
    def adjust_speed(self, difficulty_multiplier: float) -> None:
        """
        難易度倍率で出現間隔を短縮する
        例: difficulty_multiplier = 1.3 → 10秒 × 1.3 = 13秒で1回増える
        """
        # 出現間隔自体は external（GameManager）で管理するため
        # このメソッドは将来的に別ロジックと連携させる余地を残す
        self.spawn_interval = BASE_SPAWN_INTERVAL * difficulty_multiplier

    # -------------------------------------------------
    # 逃げ判定（5秒経過したら自動ペナルティ）
    # -------------------------------------------------
    def check_escape(self, current_time: float) -> bool:
        """
        5秒以上経過したら逃げとみなす
        戻り値: True=逃げた, False=まだ逃げていない
        """
        elapsed = current_time - self.created_time
        if elapsed > ESCAPE_INTERVAL and not self.escaped:
            self.escaped = True
            return True
        return False

    # -------------------------------------------------
    # UI/ゲームロジックとの連携用ヘルパー
    # -------------------------------------------------
    @staticmethod
    def spawn_animal(
        animal_type: str,
        difficulty_multiplier: float,
        current_time: float,
    ) -> "Animal":
        """
        GameManagerが呼び出す生成ファクトリ
        - レア度は自動判定（2%でPandaをRareに設定）
        - 出現間隔は difficulty_multiplier で調整
        """
        # 基本ポイントの設定
        if animal_type == "Rabbit":
            base_point = RABBIT_BASE_POINTS
        elif animal_type == "Fox":
            base_point = FOX_BASE_POINTS
        elif animal_type == "Panda":
            base_point = PANDA_BASE_POINTS
        else:
            raise ValueError(f"Unknown animal type: {animal_type}")

        # レア度判定
        rarity = "Rare" if (animal_type == "Panda" and random.random() < RARITY_PANDA) else "Common"

        # 出現間隔を難易度に合わせて調整
        spawn_interval = BASE_SPAWN_INTERVAL * difficulty_multiplier

        return Animal(
            animal_type=animal_type,
            spawn_interval=spawn_interval,
            rarity=rarity,
            base_point=base_point,
            created_time=current_time,
        )
```

---

### 2. 主要メソッドの詳細解説

| メソッド | 機能 | 実装ポイント |
|----------|------|----------------|
| `is_rare()` | パンダが2%の確率で**Rare**と判定 | `random.random() < 0.02` で2%の確率を実装 |
| `get_point()` | 基本スコアを返す | 種類ごとに定数（Rabbit/Fox = 10, Panda = 50）を返すだけ。将来レア時の加算ロジックが必要ならここで拡張 |
| `adjust_speed()` | 難易度倍率で出現間隔を短縮 | `BASE_SPAWN_INTERVAL * difficulty_multiplier` を `self.spawn_interval` に代入 |
| `check_escape()` | 5 秒以上照射されないと **逃げ** 判定 | `current_time - self.created_time` が `ESCAPE_INTERVAL` を超えたら `escaped = True` を立て、True を返す |
| `spawn_animal()` (static) | GameManager から安全に動物を生成 | 種類・レア度・出現間隔を一括で決定し、インスタンスを返す。`difficulty_multiplier` が毎10秒ごとに 1.1 倍増加するため、自然に出現速度が上がる |

---

### 3. 逃げ判定とスコアペナルティの連携（GameManager 側の例）

```python
def handle_escape(self, animal: Animal) -> None:
    """
    Animal が逃げたときに呼び出す。
    ここではスコアから -5 点を減算し、コンボもリセット。
    """
    # スコアペナルティ（Player クラスのメソッドを呼び出す想定）
    penalty = player.apply_escape_penalty()   # Player クラスの内部実装
    # 逃げた動物をリストから除去
    self.animals.remove(animal)
```

- `ESCAPE_INTERVAL = 5.0` 秒で判定し、`escaped` フラグが立った瞬間に `handle_escape()` が実行される  
- これにより **照射し忘れが続くと -5 点** という罰則が自動的に適用されます  

---

### 4. パラメータのバランス調整ポイント

| パラメータ | 説明 | デフォルト値 |
|------------|------|--------------|
| `BASE_SPAWN_INTERVAL` | 初期生成間隔（秒） | 10.0 |
| `SPAWN_INTERVAL_MULTIPLIER` | 難易度上昇ごとの倍率 | 1.10（10% 増加） |
| `ESCAPE_INTERVAL` | 逃げ判定までの時間 | 5.0 秒 |
| `ESCAPE_PENALTY` | 逃げたときの減点 | -5 ポイント |
| `RARITY_PANDA` | パンダが Rare になる確率 | 0.02（2%） |
| `RABBIT_BASE_POINTS / FOX_BASE_POINTS / PANDA_BASE_POINTS` | 各動物の基本スコア | 10, 10, 50 |

これらの定数を **GameManager** が調整すれば、全体のバランス（出現頻度・レア度・スコア倍率）を細かく制御できます。  

---

Next request.

**Game Designer (assistant):**
<tool_call>

Instruction: 動物クラスの属性とメソッドを具体的なコード構造で設計してください。種類（うさぎ/キツネ/パンダ）、レア度（2%）、出現速度（10秒毎に+10%）、逃げ判定（5秒照射で-5点）のロジックを含めてください。
Input: None

## Step 4

**Game Director (user):**
**Solution: ゲーム管理クラス（GameManager）**  

以下のコードは、  
- **60 秒のタイマー管理**  
- **10 秒ごとに難易度が +10%（出現速度が速くなる）**  
- **ゲームオーバー（オーバー）画面でスコア計算・終了判定**  
を担当する `GameManager` クラスの設計図です。  
実装は **Python** を基準にしていますが、各メソッドは Unity/C#、Godot/GDScript などへもそのまま移植可能です。

```python
import random
import time
from typing import List, Optional

# -------------------------------------------------
# 定数（バランス調整用）
# -------------------------------------------------
BASE_SPAWN_INTERVAL = 10.0          # 初期の動物生成間隔（秒）
SPAWN_MULTIPLIER_PER_TEN_SEC = 1.10   # 10 秒ごとに 10% 増加する倍率
TOTAL_GAME_TIME = 60.0               # ゲーム全体の制限時間（秒）
DIFFICULTY_TICK = 10.0               # 難易度が上がる間隔（秒）
COMBO_PENALTY = -5                   # 逃げたときのスコア減少
POINTS_PER_SECOND = 1                # タイムオーバー時の残秒ボーナス得点（例）

# -------------------------------------------------
class GameManager:
    """
    ゲームの全体進行を管理するクラス
    主な担務：
      1. タイマー (60 秒) の更新・終了判定
      2. 階段的な難易度上昇（出現間隔の短縮）
      3. オーバー画面でのスコア集計と終了処理
      4. 動物の生成・リスト管理
    """

    # ---------- コンストラクタ ----------
    def __init__(self, player: 'Player'):
        self.player = player                                 # プレイヤーオブジェクト参照
        self.elapsed_time: float = 0.0                       # 経過時間（秒）
        self.difficulty_level: int = 1                       # 階層（1〜）
        self.base_spawn_interval: float = BASE_SPAWN_INTERVAL
        self.animals: List['Animal'] = []                    # 現在している動物リスト
        self.is_game_over: bool = False                      # オーバー判定フラグ

        # UI で表示するための情報（オーバー画面用）
        self.final_score: int = 0
        self.game_duration: int = int(TOTAL_GAME_TIME)

    # ---------- タイマー管理 ----------
    def update_timer(self, delta_time: float) -> None:
        """
        1 フレーム分の時間経過を反映。
        delta_time: 前フレームからの経過秒数
        """
        if self.is_game_over:
            return

        self.elapsed_time += delta_time
        remaining = max(0.0, TOTAL_GAME_TIME - self.elapsed_time)

        # プレイヤーに残り時間を伝える（UI 表示用）
        self.player.timer = remaining

        # 60 秒切れたらゲームオーバー
        if remaining <= 0.0:
            self.is_game_over = True
            self.handle_game_over()

        # 階層ごとの難易度チェック（10 秒ごとにイベント発火）
        self._check_difficulty_up()

    # ---------- 難易度上昇ロジック ----------
    def _check_difficulty_up(self) -> None:
        """
        10 秒ごとに難易度が 1 上がり、出現速度が 10% 増加。
        具体的には `base_spawn_interval` を乗算し、Animal の生成間隔に反映させる。
        """
        # 階層が上がるタイミングを判定（整数での境界）
        next_tick = DIFFICULTY_TICK * self.difficulty_level
        if self.elapsed_time >= next_tick and not self._already_raised(next_tick):
            # 階層をインクリメントし、倍率を更新
            self.difficulty_level += 1
            # GameManager は Animal に「speed multiplier」を渡す
            self._apply_difficulty_multiplier()
            # 以降の難易度イベントのためにフラグを立てる
            self._mark_raised_tick(next_tick)

    def _already_raised(self, tick: float) -> bool:
        """過去に同じ tick が処理済みかチェック（連続呼び出し防止）"""
        # 実際の実装では履歴リストを持たせても良いが、ここでは簡易的にフラグで可
        return False

    def _mark_raised_tick(self, tick: float) -> None:
        """次回チェックで重複実行を防止するシンプルなフラグ"""
        pass  # 実装上不要だが、拡張性を保つために残す

    def _apply_difficulty_multiplier(self) -> None:
        """
        難易度が上がるたびに出現速度（生成間隔）を 10% 短縮。
        Animal の生成ロジックで `spawn_interval` にこの倍率を掛ける。
        """
        multiplier = SPAWN_MULTIPLIER_PER_TEN_SEC ** (self.difficulty_level - 1)
        # 実際に Animal へ渡す際は GameManager が spawn_animal() に multiplier を引数で渡す
        # ここでは List の各 Animal に属性を更新させる例
        for animal in self.animals:
            animal.adjust_speed(multiplier)

    # ---------- 動物生成 ----------
    def spawn_animal(self, animal_type: str, current_time: float) -> 'Animal':
        """
        指定した種類の動物を生成してリストに追加。
        種類は「Rabbit」「Fox」「Panda」。レア度は内部で 2% 確率で Panda が Rare になる。
        """
        # ゲームマネージャーは Animal.spawn_animal の static メソッドを利用
        animal = Animal.spawn_animal(
            animal_type=animal_type,
            difficulty_multiplier=self.difficulty_level,   # 現在の倍率で間隔を調整
            current_time=current_time,
        )
        self.animals.append(animal)
        return animal

    # ---------- 逃げ判定 ----------
    def check_escaped(self) -> None:
        """
        すべての動物が 5 秒以上照射されていないかチェック。
        逃げられたら -5 点ペナルティを player に適用し、動物リストから除去。
        """
        escaped_animals = [a for a in self.animals if a.check_escape(self.elapsed_time)]
        for animal in escaped_animals:
            # ペナルティ適用（Player クラスのメソッドを呼び出す例）
            self.player.apply_escape_penalty()
            self.animals.remove(animal)

    # ---------- オーバー（ゲームオーバー）画面 ----------
    def handle_game_over(self) -> None:
        """
        60 秒タイマーが尽きたときに呼び出す。
        - 合計スコアを算出
        - UI に表示（スコア・プレイ時間・最大コンボ等）
        - リトライ・終了のフローに委譲
        """
        # 1️⃣ 合計スコアを取得
        self.final_score = self.player.score

        # 2️⃣ UI に表示する情報をセット
        self.game_duration = int(self.elapsed_time)  # 実際にプレイした秒数

        # 3️⃣ 終了フローへ遷移（例: Unity なら SceneManager.LoadScene）
        #    ここではシンプルにフラグを立てるだけ
        self.is_game_over = True

        # 4️⃣ 外部に通知（例: ScoreBoardUI.show(self.final_score)）
        self._show_game_over_ui()

    def _show_game_over_ui(self) -> None:
        """
        オーバー画面に必要なデータを出力／表示させる。
        実際の実装では UI ライブラリに渡すだけ。
        """
        print("\n=== GAME OVER ===")
        print(f"プレイ時間 : {self.game_duration} 秒")
        print(f"最終スコア : {self.final_score} ポイント")
        print(f"最大コンボ : {self.player.max_combo} 回")
        print("--------------------")
        print("リトライ → 'R' キー、タイトルへ → 'Q' キー")

    # ---------- リトライ ----------
    def retry(self) -> None:
        """
        ゲームをリセットして同様の状態に戻す。
        Player と Animal リストを初期化し、再度プレイ可能にする。
        """
        # 1️⃣ Player のリセット
        self.player.reset()

        # 2️⃣ Animal リストをクリア
        self.animals.clear()

        # 3️⃣ 難易度・タイマー情報をリセット
        self.difficulty_level = 1
        self.elapsed_time = 0.0
        self.is_game_over = False
        self.final_score = 0
        self.game_duration = int(TOTAL_GAME_TIME)

        # 4️⃣ 次回プレイへの準備完了
        print("リトライを開始します...")

# -------------------------------------------------
# 補助クラス例（Animal は前回回答で定義済み）
# -------------------------------------------------
class Animal:
    """前回提供した Animal クラスの一部メソッドだけ抜粋*/

    def __init__(self, animal_type: str, spawn_interval: float,
                 base_point: int, created_time: float):
        self.type = animal_type
        self.spawn_interval = spawn_interval
        self.base_point = base_point
        self.created_time = created_time
        self.escaped = False

    def adjust_speed(self, multiplier: float) -> None:
        """出現間隔を短縮する（GameManager が multiplier を渡す）"""
        self.spawn_interval *= multiplier

    def check_escape(self, current_time: float) -> bool:
        """5 秒以上経過したら逃げたと判定し True を返す"""
        if current_time - self.created_time > 5.0:
            self.escaped = True
            return True
        return False

    @staticmethod
    def spawn_animal(animal_type: str, difficulty_multiplier: float,
                     current_time: float) -> "Animal":
        """簡易生成ファクトリ（実装は前回と同等）"""
        # ここでは省略し、前述の定数からポイントを決定
        if animal_type == "Rabbit":
            base_point = 10
            animal_type_name = "Rabbit"
        elif animal_type == "Fox":
            base_point = 10
            animal_type_name = "Fox"
        else:  # Panda
            base_point = 50
            animal_type_name = "Panda"

        # 2% でレア扱い（Rare 判定は外部で行う想定）
        # 本クラスはレア度フラグを持たせないシンプル実装
        return Animal(
            animal_type=animal_type_name,
            spawn_interval=BASE_SPAWN_INTERVAL * difficulty_multiplier,
            base_point=base_point,
            created_time=current_time,
        )
```

### 重要ポイントの解説

| 機能 | 説明 | 実装ポイント |
|------|------|----------------|
| **タイマー** | `update_timer(delta_time)` で秒単位に経過時間を加算し、`TOTAL_GAME_TIME`（60 秒）が減ったら `is_game_over = True` に設定 | `player.timer` に残り秒数を渡すことで、UI の残り時間表示が可能 |
| **難易度上昇** | `_check_difficulty_up()` が 10 秒ごとに呼び出され、`difficulty_level` が増えるたびに `SPAWN_MULTIPLIER_PER_TEN_SEC`（1.10）で出現間隔を 10% 短縮 | `Animal.adjust_speed(multiplier)` を通じて実際の生成間隔に反映 |
| **オーバー画面** | `handle_game_over()` がタイマー終了時にスコアを集計し、`_show_game_over_ui()` で画面に表示例を出力 | `self.final_score`, `self.game_duration`, `self.player.max_combo` などを UI にバインド可能 |
| **スコア計算** | 実際のスコア加算は `Player.add_score(base_points)` で行われ、コンボ倍率は `Player.calculate_score()` が保持 | `GameManager` から `Player` へスコア加算・ペナルティを委譲 |
| **逃げ判定** | `check_escaped()` が呼ばれるたびに 5 秒経過した動物を抽出し、`player.apply_escape_penalty()` で -5 点を適用 | ペナルティは `Player.reduce_combo()` も同時に呼び出す |
| **リトライ** | `retry()` が呼び出されたら全状態をリセットし、ゲーム開始画面に復帰できるようにする | `self.animals.clear()` と `player.reset()` でクリーンアップ |

### 将来の拡張性

- **スコアボーナス**：プレイ時間に応じたボーナス（例: `remaining_seconds * POINTS_PER_SECOND`）を `handle_game_over()` に追加可能。  
- **マルチプライヤー**：レア度が高いほど倍率を上げるロジックを `Animal.get_point()` に組み込める。  
- **エフェクト／サウンド**：`_show_game_over_ui()` で特定のエフェクトや BGM を再生する Hook を追加すれば、演出が豊かになる。  

以上が **GameManager クラス** の設計図です。  

Next request.

**Game Designer (assistant):**
Instruction: ゲーム管理クラスの設計を進めてください。タイマー（60秒）、難易度上昇（10秒ごとに出現速度+10%）、オーバー画面論理（得点計算と終了判定）を処理するコード構造を作成してください。 Input: None


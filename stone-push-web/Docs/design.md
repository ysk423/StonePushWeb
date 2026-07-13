# Stone Push Web版 — 現状の設計（design.md）

> Web版（Vite + TypeScript、フレームワーク無し）の**実装済みアーキテクチャ**をまとめた設計書。
> 元となったAndroid版の設計は `IMPLEMENTATION_SPEC.md` を参照。本書はWeb版で実際にどう作ったかを記す。

---

## 1. アーキテクチャ概要

```
┌───────────────────────────────────────────────┐
│                  main.ts                       │
│  ・アプリ全体の状態（AppState）を保持            │
│  ・ユーザー操作のハンドラを定義し render.ts に渡す │
│  ・CPU手番を setTimeout で非同期的にトリガー       │
└───────────────┬─────────────────┬──────────────┘
                │ 呼び出し           │ 呼び出し
┌───────────────▼──────┐  ┌────────▼──────────────┐
│   ui/render.ts        │  │   game/engine.ts       │
│  ・DOM描画（innerHTML  │  │  ・状態遷移の純粋関数群  │
│    による全体再描画）   │  │  ・合法手列挙・押し出し │
│  ・クリックイベント登録  │  │    判定・勝利判定       │
│  ・ハイライト計算のため  │  └────────┬──────────────┘
│    engineの関数を呼ぶ   │           │
└────────────────────────┘  ┌────────▼──────────────┐
                             │   game/ai.ts           │
                             │  ・CPU（ランダム合法手） │
                             └────────┬──────────────┘
                             ┌────────▼──────────────┐
                             │   game/types.ts        │
                             │  ・ドメインモデル（型・  │
                             │    定数・純粋ヘルパー）  │
                             └────────────────────────┘
```

**設計方針：**
- `game/` は DOM に非依存の純粋な TypeScript（Android版の `game/` パッケージと同じ思想）。すべての状態遷移関数は `GameState` を受け取り、新しい `GameState` を返す（既存オブジェクトは変更しない）
- `ui/` は DOM操作・描画のみを担当し、ゲームルールの判定ロジックは持たない（ハイライト計算のために `engine.ts` の合法手列挙関数を呼び出すだけ）
- `main.ts` が唯一の可変状態（`appState`）を持ち、Reduxのような単方向データフロー（操作 → 状態遷移関数 → 新state → 全体再描画）を素朴に実装している
- 状態管理ライブラリやフレームワークは使わず、`container.innerHTML = ...` による全体再描画＋イベントリスナー再登録という最もシンプルな方式を採用（MVPの規模では十分なパフォーマンス）

---

## 2. ファイル構成（実装済み）

```
stone-push-web/
├── index.html
├── vite.config.ts          # 未作成（GitHub Pages公開時に追加予定）
├── src/
│   ├── main.ts              # エントリーポイント／アプリ状態管理／CPU手番トリガー
│   ├── style.css             # 全体スタイル（ボード配色・ハイライト・レイアウト）
│   ├── game/
│   │   ├── types.ts          # ドメインモデル（型定義・定数・純粋ヘルパー関数）
│   │   ├── engine.ts          # ゲームロジック（状態遷移の純粋関数）
│   │   └── ai.ts             # CPU AI（やさしい＝ランダム合法手のみ）
│   └── ui/
│       └── render.ts          # 画面描画・DOM操作・クリックイベント登録
├── public/
│   ├── favicon.svg
│   └── icons.svg             # 現在未使用（旧テンプレート由来、参照は削除済み）
└── Docs/                     # 設計・仕様・進捗ドキュメント一式
```

未使用の旧テンプレート資産（`src/assets/typescript.svg`, `vite.svg`, `hero.png`）は参照を外したがファイル自体は残存している（削除は今後の課題）。

---

## 3. ドメインモデル（`game/types.ts`）

### 型定義

| 型 | 内容 |
|----|------|
| `Player` | `'BLACK' \| 'WHITE'` |
| `BoardColor` | `'DARK' \| 'LIGHT'` |
| `BoardPosition` | `'TOP_LEFT' \| 'TOP_RIGHT' \| 'BOTTOM_LEFT' \| 'BOTTOM_RIGHT'` |
| `TurnPhase` | `'PASSIVE_SELECT' \| 'PASSIVE_CONFIRM' \| 'AGGRESSIVE_SELECT' \| 'GAME_OVER'` |
| `Difficulty` | `'EASY' \| 'NORMAL' \| 'HARD'`（現状 `EASY` のみ実装が存在） |
| `GameMode` | `'VS_CPU' \| 'VS_HUMAN'` |
| `Pos` | `{ row: number; col: number }`（0〜3） |
| `Direction` | `{ dr: number; dc: number }`。8方向定数 `ALL_DIRECTIONS` として保持 |
| `StoneMap` | `Partial<Record<string, Player>>`。key は `` `${row}_${col}` ``（`posKey()`） |
| `BoardState` | `{ position, color, stones: StoneMap }`。1枚のボードの状態 |
| `Move` | `{ boardPosition, from, to, direction, steps }` |
| `GameState` | ゲーム全体のスナップショット（下記） |

### `GameState` の構造

```ts
interface GameState {
  boards: Record<BoardPosition, BoardState>
  currentPlayer: Player
  phase: TurnPhase
  mode: GameMode
  difficulty: Difficulty
  humanPlayer: Player
  selectedPassiveFrom: { boardPosition: BoardPosition; pos: Pos } | null
  passiveMove: Move | null
  winner: Player | null
}
```

Android版の `GameState` と異なり、`selectedPassiveFrom` と `passiveMove` を state 自体に持たせることで、「選択中の石」「確定済みパッシブ移動（方向・歩数の引き継ぎ＆キャンセル時の巻き戻し用）」をViewModel層を介さず素直に表現している（Web版にはViewModel層が無く、`GameState` がその役割も兼ねる）。

### 定数・純粋ヘルパー

- `BOARD_COLOR_OF` / `HOME_PLAYER_OF`：ボード位置→色／ホームプレイヤーの対応表
- `homeBoardsOf(player)`：プレイヤーのホームボード2枚を返す
- `oppositeColorBoards(color)`：指定色と逆色のボード2枚を返す（アグレッシブ移動対象の算出に使用）
- `posKey` / `posEquals` / `isInBounds` / `opponentOf`

---

## 4. ゲームエンジン（`game/engine.ts`）

すべて `GameState` を受け取り新しい `GameState`（または `Move[]`）を返す純粋関数。Android版の `GameEngine` + `MoveValidator` を1ファイルに統合した構成。

### 主要関数

| 関数 | 役割 |
|------|------|
| `initialState(mode, difficulty, humanPlayer, firstPlayer)` | 初期盤面生成（全4ボードで黒=row3全列・白=row0全列） |
| `legalPassiveMoves(state)` | 現在の手番の合法パッシブ移動を列挙（**デッドエンドフィルタ込み**） |
| `legalAggressiveMoves(state, passiveMove)` | 指定のパッシブ移動に対応する合法アグレッシブ移動を列挙 |
| `applyPassiveMove(state, move)` | パッシブ移動を適用し `AGGRESSIVE_SELECT` へ遷移 |
| `applyAggressiveMove(state, move)` | アグレッシブ移動を適用（押し出し処理）→ 勝利判定 → ターン交代 or `GAME_OVER` |
| `selectPassiveStone(state, boardPosition, pos)` | `PASSIVE_SELECT` → `PASSIVE_CONFIRM` |
| `cancelPassiveSelection(state)` | `PASSIVE_CONFIRM` → `PASSIVE_SELECT`（選択解除） |
| `cancelAggressiveAndRevertPassive(state)` | `AGGRESSIVE_SELECT` → `PASSIVE_SELECT`（パッシブ移動を手動で逆適用） |

### デッドエンドフィルタの実装方式

Android版はViewModel層（`computePassiveData`）でフィルタしていたが、Web版は `legalPassiveMoves()` 自体がフィルタ済みの結果を返す設計にした（呼び出し側は常に「選択可能な手」だけを受け取れる）。

実装上のポイント：パッシブ移動とアグレッシブ移動は必ず異なる色のボード上で行われるため、「あるパッシブ移動候補の後にアグレッシブ移動が存在するか」を判定する際、**パッシブ移動を実際に盤面へ適用する必要がない**（アグレッシブ対象ボードはパッシブ移動の影響を受けないため）。これにより `legalPassiveMoves` は盤面クローン無しで軽量に実装できている。

```ts
export function legalPassiveMoves(state: GameState): Move[] {
  const raw = /* 全ホームボードの生の合法パッシブ移動を列挙 */
  return raw.filter((move) => legalAggressiveMoves(state, move).length > 0)
}
```

### アグレッシブ移動（押し出し）の判定ロジック — `resolveAggressiveMove`

移動方向 `dir` ・歩数 `steps`（1 or 2）で `from` から `dest = from + dir*steps` へ移動する際の経路セル（`steps=2` なら中間セルと目的地の2マス、`steps=1` なら目的地の1マス）を走査し：

1. 経路上に**自分の石**があれば不可（自石を押す・飛び越すことはできない）
2. 経路上の**相手の石**が2個以上あれば不可（2個連続で押すことは不可）
3. 経路上に相手の石が1個だけあれば、その石は `pushedTo = dest + dir`（攻撃側の最終着地点からさらに1マス先）へ押し出される
   - `pushedTo` が盤外なら、その石は消滅（＝相手の石が0個になれば勝利条件に直結）
   - `pushedTo` が盤内かつ石があれば「2個同時押し」となり不可
4. 上記をすべて満たせば合法。攻撃側の石は `dest` に移動する

この「押し出された石は攻撃側の最終着地点のさらに1マス先に移動する」というルールは、`IMPLEMENTATION_SPEC.md` の「押し先（pushed）に石があれば2個同時押しになり不可」という記述と、盤ゲーム「Shobu」の実際のルールを踏まえて実装したもの（`GAME_RULES_AND_REQUIREMENTS.md` には押し出し先の正確な計算式までは明記されていないため、実装判断として本書に明記しておく）。

### 勝利判定 — `checkWinner`

`applyAggressiveMove` の内部で、移動適用後の盤面に対して全4ボードを走査し、いずれかのボードで黒または白の石数が0になっていれば、その時点の `currentPlayer`（＝直前に動いたプレイヤー）を勝者とする。

---

## 5. CPU AI（`game/ai.ts`）

`chooseCpuTurn(state)` のみを実装。

```
1. legalPassiveMoves(state) からランダムに1つ選ぶ
2. legalAggressiveMoves(state, 選んだパッシブ移動) からランダムに1つ選ぶ
3. { passiveMove, aggressiveMove } を返す
```

`legalPassiveMoves` が既にデッドエンドを除外済みのため、手順2の候補は必ず1件以上存在する（合法パッシブ移動が1つも無い完全デッドロック状態を除く）。

反復深化ミニマックス＋α-β枝刈り（ふつう／むずかしい相当）は未実装。実装する場合は `GAME_RULES_AND_REQUIREMENTS.md` 2.5節の評価関数（残り石数差×15、全滅危機±80/±20、中央制圧×4、エッジリスク×3）をそのまま `ai.ts` に追加する想定。

---

## 6. UI層（`ui/render.ts` + `main.ts`）

### 状態管理方式（`main.ts`）

```ts
type MainScreen = { screen: 'start' } | { screen: 'game'; game: GameState }
type AppState = MainScreen | { screen: 'rules'; returnTo: MainScreen }

let appState: AppState = { screen: 'start' }

function setState(next: AppState) {
  appState = next
  render()
}
```

- `setState` を呼ぶたびに `render()` が画面全体を再構築する（部分更新はしない）
- ルーティングは無く、`AppState` の `screen` の値だけで start画面/game画面/rules画面を切り替える単一ページアプリ
- `rules` 画面は `returnTo` に遷移元（`MainScreen`＝start か game のいずれか、game の場合は `GameState` ごと）を持たせることで、「← 戻る」で元の画面をそのままの状態で復元できる。`AppState` の再帰定義を避けるため、`returnTo` の型を `MainScreen`（`rules` を除いた部分union）に限定している

### クリック処理の流れ（`handleCellClick`）

現在の `game.phase` に応じて分岐し、`engine.ts` の状態遷移関数を呼ぶだけの薄い実装：

| phase | クリック対象 | 呼び出す関数 |
|-------|------------|------------|
| `PASSIVE_SELECT` | 合法パッシブ移動の起点セル | `selectPassiveStone` |
| `PASSIVE_CONFIRM` | 選択中と同じ石 | `cancelPassiveSelection` |
| `PASSIVE_CONFIRM` | 合法な移動先セル | `applyPassiveMove` |
| `AGGRESSIVE_SELECT` | 合法な移動先セル | `applyAggressiveMove` |
| `AGGRESSIVE_SELECT` | それ以外の場所 | `cancelAggressiveAndRevertPassive`（`IMPLEMENTATION_SPEC.md` 7節の仕様通り） |

CPU手番中（`game.mode === 'VS_CPU' && currentPlayer !== humanPlayer`）はすべてのクリックを無視する（`isHumanTurn` でガード）。

### CPU手番のトリガー（`scheduleCpuTurnIfNeeded`）

```
render() の最後で毎回呼ばれる
  → CPU手番かつゲーム進行中なら window.setTimeout(500ms) をスケジュール
  → タイマー発火時に改めて状態を再チェック（レース対策）してからCPUの手を計算・適用
```

`render()` はステート変更のたびに1回しか呼ばれないため、CPU手番の間だけ重複してタイマーが積み上がることはない（CPU手番中は人間側の操作が無効化されており、次にrenderが呼ばれるのはCPUの手が適用された後＝再びcurrentPlayerが人間になった後）。

CPUの手（パッシブ→アグレッシブ）は演出無しで連続適用され、アニメーションは実装していない。

### 描画（`ui/render.ts`）

- `renderStart` / `renderGame` の2つのトップレベル関数のみ
- ハイライト計算（`computeMovableCells` / `computeDestinationCells` / `computeDimmedBoards`）は `render.ts` 内のプライベート関数として実装。いずれも `engine.ts` の `legalPassiveMoves` / `legalAggressiveMoves` を呼び出して算出しており、ハイライト用に独自のルール判定ロジックは持たない（ロジックの二重実装を避ける設計）
- 盤面は `innerHTML` によるテンプレート文字列生成＋`querySelectorAll('.cell')` でのイベントリスナー一括登録という素朴な方式

---

## 7. 状態遷移図（実装済みのフェーズ遷移）

```
PASSIVE_SELECT
  │ selectPassiveStone
  ▼
PASSIVE_CONFIRM ──cancelPassiveSelection──► PASSIVE_SELECT
  │ applyPassiveMove
  ▼
AGGRESSIVE_SELECT ──cancelAggressiveAndRevertPassive──► PASSIVE_SELECT
  │ applyAggressiveMove
  ├─ 勝利条件成立 ──► GAME_OVER
  └─ 未成立 ──► PASSIVE_SELECT（currentPlayerを交代）
```

---

## 8. スタイル（`style.css`）

CSS変数でボード配色を定義（`--board-dark` / `--board-light` / `--rope-line` / `--stone-black` / `--stone-white` / `--highlight`）。フレームワークやCSS-in-JSは使わず、素のCSS＋クラス名の付け外しでハイライト状態を表現している（`movable` / `selected` / `destination` / `dimmed-stone` / `board-dimmed`）。

アニメーション（`transition`）は `.board` の `opacity` にのみ使用しており、石の移動・押し出しにはアニメーションを付けていない（拡張3で対応予定）。

---

## 9. 未実装だが設計上考慮している拡張ポイント

- **アンドゥ**：`GameState` は完全な不変スナップショットなので、`main.ts` 側に `history: GameState[]` を持たせて `applyAggressiveMove` 直後にpushするだけで実装できる設計になっている（Android版の `ArrayDeque<GameState>` と同じ方式が素直に踏襲できる）
- **CPU強化（ふつう/むずかしい）**：`ai.ts` に `legalPassiveMoves` / `legalAggressiveMoves` / `applyPassiveMove` / `applyAggressiveMove` を使った探索関数を追加するだけで良く、`engine.ts` 側の変更は不要
- **戦績・設定の永続化**：`localStorage` への読み書きを行う `data/` 相当のモジュールを追加し、`main.ts` から呼び出す想定（現状は未着手）

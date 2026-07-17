# Stone Push Web版 — 設計（design.md）

> Web版（Vite + TypeScript、フレームワーク無し）の実装アーキテクチャをまとめた設計書。
> このファイルと `spec.md`（機能仕様）の2つだけで実装内容が把握できることを目指している。

---

## 1. アーキテクチャ概要

```
┌───────────────────────────────────────────────┐
│                  main.ts                       │
│  ・アプリ全体の状態（AppState）を保持            │
│  ・ユーザー操作のハンドラを定義し render.ts に渡す │
│  ・CPU手番を setTimeout で非同期的にトリガー       │
│  ・言語・CPU難易度などグローバル設定も保持          │
└───────────────┬─────────────────┬──────────────┘
                │ 呼び出し           │ 呼び出し
┌───────────────▼──────┐  ┌────────▼──────────────┐
│   ui/render.ts        │  │   game/engine.ts       │
│  ・DOM描画（innerHTML  │  │  ・状態遷移の純粋関数群  │
│    による全体再描画）   │  │  ・合法手列挙・押し出し │
│  ・クリックイベント登録  │  │    判定・勝利判定       │
│  ・ハイライト計算のため  │  └────────┬──────────────┘
│    engineの関数を呼ぶ   │           │
│  ・i18n.tsの辞書を使い  │  ┌────────▼──────────────┐
│    文言を差し込む       │  │   game/ai.ts           │
└────────────────────────┘  │  ・CPU AI（3段階の難易度）│
                             └────────┬──────────────┘
                             ┌────────▼──────────────┐
                             │   game/types.ts        │
                             │  ・ドメインモデル（型・  │
                             │    定数・純粋ヘルパー）  │
                             └────────────────────────┘
```

**設計方針：**
- `game/` は DOM に非依存の純粋な TypeScript。すべての状態遷移関数は `GameState` を受け取り、新しい `GameState` を返す（既存オブジェクトは変更しない）
- `ui/` は DOM操作・描画のみを担当し、ゲームルールの判定ロジックは持たない（ハイライト計算のために `engine.ts` の合法手列挙関数を呼び出すだけ）
- `main.ts` が唯一の可変状態（`appState`・言語・CPU難易度）を持ち、単方向データフロー（操作 → 状態遷移関数 → 新state → 全体再描画）を素朴に実装している
- 状態管理ライブラリやフレームワークは使わず、`container.innerHTML = ...` による全体再描画＋イベントリスナー再登録という最もシンプルな方式を採用（このアプリの規模では十分なパフォーマンス）

---

## 2. ファイル構成

```
Stone Push web/                    # リポジトリルート（.git はここ）
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions：main push → build → GitHub Pagesへ自動デプロイ
└── stone-push-web/          # アプリ本体（Vite プロジェクトルート）
    ├── index.html
    ├── vite.config.ts        # base: '/StonePushWeb/'（GitHub Pagesのリポジトリ名に合わせたパス設定）
    ├── src/
    │   ├── main.ts            # エントリーポイント／アプリ状態管理／CPU手番トリガー／言語・難易度・戦績記録state
    │   ├── i18n.ts             # 多言語辞書（日本語／英語）。UI文言はすべてここに集約
    │   ├── firebase.ts          # Firebase初期化（Firestoreインスタンスのエクスポート）
    │   ├── records.ts           # 戦績（Firestore `records`コレクション）へのアクセスをラップ
    │   ├── style.css           # 全体スタイル（ボード配色・ハイライト・レイアウト）
    │   ├── game/
    │   │   ├── types.ts        # ドメインモデル（型定義・定数・純粋ヘルパー関数）
    │   │   ├── engine.ts        # ゲームロジック（状態遷移の純粋関数）
    │   │   └── ai.ts           # CPU AI（よわい／ふつう／つよいの3段階）
    │   └── ui/
    │       └── render.ts        # 画面描画・DOM操作・クリックイベント登録
    ├── public/
    │   └── favicon.svg
    ├── firebase.json            # Firebase CLIの設定（ルール・インデックスファイルの参照先）
    ├── .firebaserc              # デフォルトFirebaseプロジェクトの固定（stone-push-web）
    ├── firestore.rules          # Firestoreセキュリティルール
    ├── firestore.indexes.json   # Firestore複合インデックス定義
    └── Docs/                   # 設計・仕様・進捗ドキュメント一式
```

GitHub Actionsのワークフロー（`deploy.yml`）は `working-directory: stone-push-web` を指定して `npm ci` / `npm run build` を実行し、`stone-push-web/dist` を `actions/upload-pages-artifact` で公開する構成（初回セットアップ手順は `GITHUB_PAGES_DEPLOY.md` を参照）。

Firebase（Firestore）関連の設定ファイルはアプリ本体（`stone-push-web/`）直下に置き、`npx firebase-tools deploy --only firestore:rules` / `firestore:indexes` のようにアプリのディレクトリで直接デプロイできるようにしている。Firebaseプロジェクト名は`stone-push-web`（`.firebaserc`で固定）、Firestoreは`records`コレクション1つのみを使用する構成。セキュリティルール（`firestore.rules`）・複合インデックス（`firestore.indexes.json`）の内容は10章、戦績データの削除手順は`RECORD_DELETION.md`を参照。

---

## 3. ドメインモデル（`game/types.ts`）

### 型定義

| 型 | 内容 |
|----|------|
| `Player` | `'BLACK' \| 'WHITE'` |
| `BoardColor` | `'DARK' \| 'LIGHT'` |
| `BoardPosition` | `'TOP_LEFT' \| 'TOP_RIGHT' \| 'BOTTOM_LEFT' \| 'BOTTOM_RIGHT'` |
| `TurnPhase` | `'PASSIVE_SELECT' \| 'PASSIVE_CONFIRM' \| 'AGGRESSIVE_SELECT' \| 'AGGRESSIVE_CONFIRM' \| 'GAME_OVER'` |
| `Difficulty` | `'EASY' \| 'NORMAL' \| 'HARD'`（UI表示は「よわい／ふつう／つよい」または「Easy/Normal/Hard」） |
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
  selectedAggressiveFrom: { boardPosition: BoardPosition; pos: Pos } | null
  winner: Player | null
}
```

`selectedPassiveFrom` / `passiveMove` / `selectedAggressiveFrom` を state 自体に持たせることで、「選択中の石（パッシブ／アグレッシブ双方）」「確定済みパッシブ移動（方向・歩数の引き継ぎ＆キャンセル時の巻き戻し用）」を専用のViewModel層を介さず素直に表現している。

### 定数・純粋ヘルパー

- `BOARD_COLOR_OF` / `HOME_PLAYER_OF`：ボード位置→色／ホームプレイヤーの対応表
- `homeBoardsOf(player)`：プレイヤーのホームボード2枚を返す
- `oppositeColorBoards(color)`：指定色と逆色のボード2枚を返す（アグレッシブ移動対象の算出に使用）
- `posKey` / `posEquals` / `isInBounds` / `opponentOf`

---

## 4. ゲームエンジン（`game/engine.ts`）

すべて `GameState` を受け取り新しい `GameState`（または `Move[]`）を返す純粋関数。

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
| `selectAggressiveStone(state, boardPosition, pos)` | `AGGRESSIVE_SELECT` → `AGGRESSIVE_CONFIRM`（方向・歩数はpassiveMove由来で固定のため移動先は一意に決まる） |
| `cancelAggressiveSelection(state)` | `AGGRESSIVE_CONFIRM` → `AGGRESSIVE_SELECT`（選択解除のみ、パッシブ移動は維持） |
| `cancelAggressiveAndRevertPassive(state)` | `AGGRESSIVE_SELECT` / `AGGRESSIVE_CONFIRM` → `PASSIVE_SELECT`（パッシブ移動を手動で逆適用） |
| `previewAggressiveMove(state, move)` | 状態を変更せず、そのアグレッシブ移動で石が押し出されるか（`pushedFrom`/`pushedTo`）だけを返す。内部で`applyAggressiveMove`と同じ`resolveAggressiveMove`を再利用しており、押し出し判定ロジックの二重実装を避けている。UI側の押し出しアニメーション（`main.ts`の`animatePush`）が使用 |

### デッドエンドフィルタの実装方式

「パッシブ移動をした結果、それに対応する合法なアグレッシブ移動が1つも無い」状態（デッドエンド）は、そのパッシブ移動自体をルール上選択不可とする。Web版は `legalPassiveMoves()` 自体がフィルタ済みの結果を返す設計にした（呼び出し側は常に「選択可能な手」だけを受け取れる）。

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

### 勝利判定 — `checkWinner`

`applyAggressiveMove` の内部で、移動適用後の盤面に対して全4ボードを走査し、いずれかのボードで黒または白の石数が0になっていれば、その時点の `currentPlayer`（＝直前に動いたプレイヤー）を勝者とする。自分の手で自分の石が減ることは無いため、この判定で敗北するのは常に「動かさなかった側」だけになる。

---

## 5. CPU AI（`game/ai.ts`）

`chooseCpuTurn(state)` を実装。内部で `state.difficulty` を見て、以下の3段階のいずれかのアルゴリズムで「パッシブ移動＋アグレッシブ移動」の組を1つ選ぶ。

### 手の列挙 — `enumerateTurns`

```
legalPassiveMoves(state) の各候補 × legalAggressiveMoves(state, その候補) の各候補
→ 実際にapplyPassiveMove→applyAggressiveMoveを適用した「1ターン分の結果状態」を全組み合わせ列挙する
```

`legalPassiveMoves` が既にデッドエンドを除外済みのため、この列挙は必ず1件以上の候補を返す（合法パッシブ移動が1つも無い完全デッドロック状態を除く）。

### 評価関数 — `evaluate(state, player)`

盤面をプレイヤー視点でスコア化する。他の要素（駒の配置パターンなど）は考慮しない単純な評価だが、ゼロサム（`evaluate(s, A) === -evaluate(s, B)`）になるよう設計しており、後述のミニマックス探索と相性が良い。

```
勝敗が決まっていれば ±∞
そうでなければ、4ボードそれぞれについて：
  score += (自分の石数 − 相手の石数) × 10
  score += 50   （相手がそのボードで残り1個＝あと1押しで勝てる状況）
  score -= 50   （自分がそのボードで残り1個＝あと1押しで負ける状況）
```

### 難易度ごとのアルゴリズム

| 難易度 | 表示ラベル | アルゴリズム |
|--------|-----------|------|
| `EASY` | よわい / Easy | `enumerateTurns` の結果からランダムに1つ選ぶ |
| `NORMAL` | ふつう / Normal | 自分のターン直後の `evaluate` が最も高い手を選ぶ（相手の応手は考慮しない1手先読み） |
| `HARD` | つよい / Hard | 自分の各候補手について、「相手が自分の評価値を最小化する手で応じる」と仮定した場合の評価値（2手先読み）を計算し、その最悪値が最も高い手を選ぶ（ミニマックス） |

`HARD` の実装（`chooseMinimax` → `opponentReplyScore`）は、自分の候補手ごとに相手側の `enumerateTurns` をもう一段展開して全探索する（アルファベータ枝刈りは行っていないが、1ターン＝2手（パッシブ＋アグレッシブ）を1ノードとして扱うため、実測上ブラウザで体感できるほどの遅延なく完了する）。同点の候補が複数ある場合はランダムに1つを選ぶ（毎回同じ手を選び続けないようにするため）。

---

## 6. UI層（`ui/render.ts` + `main.ts`）

### 状態管理方式（`main.ts`）

```ts
type MainScreen = { screen: 'start' } | { screen: 'game'; game: GameState }
type AppState = MainScreen | { screen: 'rules'; returnTo: MainScreen }

let appState: AppState = { screen: 'start' }
let lang: Lang = 'en'                    // 言語設定（グローバル、既定は英語）
let cpuDifficulty: Difficulty = 'EASY'   // vs CPU開始時に使う難易度（スタート画面のボタンで選択）

function setState(next: AppState) {
  appState = next
  render()
}
```

- `setState` を呼ぶたびに `render()` が画面全体を再構築する（部分更新はしない）
- ルーティングは無く、`AppState` の `screen` の値だけで start画面/game画面/rules画面/ranking画面を切り替える単一ページアプリ（`AppState` は `MainScreen | { screen: 'rules'; returnTo } | { screen: 'ranking' }`）
- `rules` 画面は `returnTo` に遷移元（`MainScreen`＝start か game のいずれか、game の場合は `GameState` ごと）を持たせることで、「← 戻る」で元の画面をそのままの状態で復元できる。`AppState` の再帰定義を避けるため、`returnTo` の型を `MainScreen`（`rules` を除いた部分union）に限定している。`ranking` 画面はTop画面からしか遷移しない設計のため、`returnTo` は持たせず常に`start`へ戻る
- `lang` / `cpuDifficulty` / `recordSubmitStatus` / `rankingCategory` / `rankingData` は `AppState` ではなく `main.ts` のモジュールスコープに独立して保持している（画面遷移・ゲーム状態のリセットとは無関係にアプリ全体、あるいは画面固有のUI状態のため）。永続化（`localStorage`）は未実装で、リロードすると既定値（英語／よわい）に戻る。`recordSubmitStatus`は`startGame`/`resetGame`で毎回`'idle'`にリセットする

### クリック処理の流れ（`handleCellClick`）

現在の `game.phase` に応じて分岐し、`engine.ts` の状態遷移関数を呼ぶだけの薄い実装：

| phase | クリック対象 | 呼び出す関数 |
|-------|------------|------------|
| `PASSIVE_SELECT` | 合法パッシブ移動の起点セル | `selectPassiveStone` |
| `PASSIVE_CONFIRM` | 選択中と同じ石 | `cancelPassiveSelection` |
| `PASSIVE_CONFIRM` | 合法な移動先セル | `applyPassiveMove` |
| `AGGRESSIVE_SELECT` | 合法なアグレッシブ移動の起点セル | `selectAggressiveStone` |
| `AGGRESSIVE_SELECT` | それ以外の場所 | `cancelAggressiveAndRevertPassive`（ハイライトされていない場所をタップした場合は、パッシブ移動ごとキャンセルして選び直させる） |
| `AGGRESSIVE_CONFIRM` | 選択中と同じ石 | `cancelAggressiveSelection` |
| `AGGRESSIVE_CONFIRM` | 唯一の移動先セル | `applyAggressiveMove` |
| `AGGRESSIVE_CONFIRM` | それ以外の場所 | `cancelAggressiveAndRevertPassive` |

CPU手番中（`game.mode === 'VS_CPU' && currentPlayer !== humanPlayer`）はすべてのクリックを無視する（`isHumanTurn` でガード）。

### CPU手番のトリガー（`scheduleCpuTurnIfNeeded`）

```
render() の最後で毎回呼ばれる
  → CPU手番かつゲーム進行中なら window.setTimeout(500ms) をスケジュール
  → タイマー発火時に isAnimating / 状態を再チェックしてからCPUの手を計算・適用
```

リード→フォローの2段階アニメーション（下記）の間に発生する中間 `setState`（リード確定時点の描画）が `render()` を再度呼び出すため、`scheduleCpuTurnIfNeeded` は `isAnimating` が `true` の間は本体処理をスキップするガードを持つ。これが無いと、CPUの手番の途中でタイマーが二重に走り、CPUの手が二重適用されてしまう。

CPUの手はパッシブ移動（リード）→アグレッシブ移動（フォロー）の順に、**同じ速度（`PUSH_ANIMATION_MS`=400ms）で連続してスライドアニメーション**させてから確定する。

### 押し出しアニメーション（`main.ts`の`animatePush` / `animateSimpleMove`）

`innerHTML`による全体再描画方式ではDOM要素がstateごとに作り直されるため、CSS transitionでは前後の状態を跨いだアニメーションができない。そこで、状態を確定する（`setState`を呼ぶ）前に、**今まさに画面に表示されているDOM**を直接操作して石をアニメーションさせ、アニメーション終了後（`PUSH_ANIMATION_MS`=400ms後）に初めて`setState`で最終状態を確定して通常の全体再描画を行う、という2段階の設計にしている。

- `animateSimpleMove(boardPosition, from, to, onDone)`：押し出しの無い単純なスライドのみ（リード用）。移動する石の要素と移動先セルの`getBoundingClientRect()`から中心間の距離(px)を算出し、`transform: translate()`で滑らせる
- `animatePush(beforeState, move, onDone)`：フォロー用。`engine.previewAggressiveMove(beforeState, move)`で押し出しの有無・押し出し先（盤外なら`null`）を取得（盤面は変更しない）した上で、移動する石に加えて押し出される石も同様にスライドさせ、盤外に消える場合は`opacity`を0にフェードアウトさせる

いずれも`isAnimating`フラグの管理はせず（アニメーション自体と`onDone`コールバックの実行のみ）、`isAnimating`の設定・解除は呼び出し側が担う設計にした。理由は、CPU手番ではリード用アニメーション（`animateSimpleMove`）→フォロー用アニメーション（`animatePush`）を1つの継続した無操作区間として扱う必要があり（間の中間`setState`でも操作を無効化し続けたい）、区間の開始・終了を関数側でなく呼び出し側の都合で決めたいため。

- 人間の操作（`handleCellClick`のフォロー確定）：`isAnimating = true` → `animatePush` → `onDone`内で`isAnimating = false`→`setState`
- CPU手番（`scheduleCpuTurnIfNeeded`）：`isAnimating = true` → `animateSimpleMove`（リード）→`onDone`内で中間`setState`（リード確定後の盤面を描画）→続けて`animatePush`（フォロー）→`onDone`内で`isAnimating = false`→`setState`（最終状態）

人間側・CPU側とも、アニメーション開始時点で画面に表示されている状態を基準に使う。CPU側のフォロー用アニメーションは、リード確定後に再描画された盤面（`afterPassive`）を基準にする（アグレッシブ移動の対象ボードはリードの対象ボードと必ず逆色＝別ボードのため、リード適用後の状態でも問題なく成立する）。

### 描画（`ui/render.ts`）

- `renderStart` / `renderRules` / `renderGame` の3つのトップレベル関数のみ。いずれも `lang: Lang` を引数に取り、`i18n.ts`の`getDict(lang)`で得た辞書を使ってテンプレート文字列に文言を差し込む（文言の言語分岐を`render.ts`本体に持ち込まない設計）
- ハイライト計算（`computeMovableCells` / `computeDestinationCells` / `computeDimmedBoards`）は `render.ts` 内のプライベート関数として実装。いずれも `engine.ts` の `legalPassiveMoves` / `legalAggressiveMoves` を呼び出して算出しており、ハイライト用に独自のルール判定ロジックは持たない（ロジックの二重実装を避ける設計）
- 盤面は `innerHTML` によるテンプレート文字列生成＋`querySelectorAll('.cell')` でのイベントリスナー一括登録という素朴な方式
- `renderBoard(bp, screenLabel, flipped, ...)` は「論理的なボード位置（`bp`＝ゲーム状態のキー）」と「画面上の表示スロット（`screenLabel`／描画順）」を分離した設計。`game.humanPlayer === 'WHITE'`（後攻でプレイ中）のときは `boardRenderOrder(true)` で2×2の上下2枚を入れ替え、かつ `renderBoard` 内で行の描画順を反転（`flipped`）することで、自陣（白ホーム）が常に画面下側に来るようにしている。左右（DARK/LIGHTの並び）は反転しない。`data-row`/`data-col` には常に論理座標を使うため、`main.ts` 側のクリック処理・`engine.ts` の判定ロジックは表示反転の影響を一切受けない（表示専用の変換として `render.ts` 内に閉じている）
- `renderStart` の盤面イラストは、実際の `engine.initialState()` の結果をそのまま `renderBoard`（空のハイライト集合・`dimmed=false`）に渡して静的表示している。専用の装飾ロジックを別途持たず、本物の初期盤面と常に一致することを保証する設計
- スタート画面のメニュー順は「vs CPU（難易度選択＋先攻/後攻ボタン）→ vs 人間 → ルール説明 → 言語切替」。vs CPUを優先的に選んでもらいたいという方針で、この並びにしている

---

## 7. 状態遷移図（フェーズ遷移）

```
PASSIVE_SELECT
  │ selectPassiveStone
  ▼
PASSIVE_CONFIRM ──cancelPassiveSelection──► PASSIVE_SELECT
  │ applyPassiveMove
  ▼
AGGRESSIVE_SELECT ──cancelAggressiveAndRevertPassive──► PASSIVE_SELECT
  │ selectAggressiveStone
  ▼
AGGRESSIVE_CONFIRM ──cancelAggressiveSelection──► AGGRESSIVE_SELECT
  │（cancelAggressiveAndRevertPassiveでもPASSIVE_SELECTへ戻れる）
  │ applyAggressiveMove
  ├─ 勝利条件成立 ──► GAME_OVER
  └─ 未成立 ──► PASSIVE_SELECT（currentPlayerを交代）
```

---

## 8. スタイル（`style.css`）

CSS変数でボード配色を定義（`--board-dark` / `--board-light` / `--border-line` / `--stone-black` / `--stone-white` / `--highlight`）。フレームワークやCSS-in-JSは使わず、素のCSS＋クラス名の付け外しでハイライト状態を表現している（`movable` / `selected` / `destination` / `dimmed-stone` / `board-dimmed`）。

4枚のボードの中央交点（`--border-line` の交差部分）には `.border-label` で「ボーダー」（英語モードでは「Border」）というテキストラベルを常時表示している。ルール説明画面の図解でも同じ位置・同じ色で説明しており、対局画面と用語を一致させている。

「ボーダー」＝黒ホームと白ホームの上下の境目、という意味を明確にするため、強調（`var(--border-line)` の6px枠線）は上段2枚と下段2枚の間（`.board-grid .board:nth-child(-n+2)` の `border-bottom` と `:nth-child(n+3)` の `border-top`）にのみ適用し、左右のDARK/LIGHTの区切りは通常の1px薄枠（`#e5e4e7`）のまま強調しない。`.rules-board-diagram` の図解にも同じ考え方を適用している。

移動先マーク（`.cell.destination`）は、セル全体を囲む枠線（`box-shadow: inset`）方式にしている。中央に丸を重ねる方式だと、押し出し対象（マス上に相手の石がある場合）だと石の`z-index`に隠れて見えなくなるため、石の有無にかかわらず常に視認できるこの方式を採用した。

上下境目の強調（`.board-grid .board:nth-child(-n+2)` / `:nth-child(n+3)`）は、`.board-grid` 内で `.board` 要素だけを兄弟として数える必要があるため、`.border-label` は必ず4枚のボードより後（DOM上で5番目の子要素）に置くこと。先に置くと `nth-child` の位置がずれ、意図しないボードに境界線が付いてしまう（実際に起きた不具合）。

`.result-overlay`（結果ダイアログ）には `z-index: 100` を明示している。`.stone`（z-index:1）や `.border-label`（z-index:2）は、祖先要素（`.cell` `.board` `.board-grid` `#game-screen` など）がいずれもスタッキングコンテキストを確立しない（`position`はあっても`z-index`が`auto`のため）ため、実質的にルートのスタッキングコンテキストで比較され、`z-index`指定の無い`.result-overlay`より前面に出てしまっていた。

CSSの`transition`定義自体は`.board`の`opacity`（暗転演出）にのみ持たせている。石の移動・押し出しのスライド／フェードアウトアニメーションはCSSでなく、`main.ts`側で`el.style.transition` / `el.style.transform` / `el.style.opacity`をJavaScriptから直接指定する方式（詳細は6章「押し出しアニメーション」を参照）。

---

## 9. 多言語対応（`i18n.ts`）

- `src/i18n.ts`に`Lang = 'ja' | 'en'`と、UI文言をすべて含む`Dict`インターフェース、`ja`/`en`それぞれの辞書オブジェクト、`getDict(lang)`を定義。文言は静的な文字列だけでなく、語順が言語間で異なる箇所（勝敗表示・番手表示）は`win(player)` / `turn(player, phase)`のような関数として辞書に持たせている（例：ja `${p}の番 ・ ${ph}` / en `${p}'s turn - ${ph}`）
- 言語切替ボタンはスタート画面のみに設置（`renderStart`内の`#btn-lang-toggle`、ボタンラベルは「切り替え先」の言語名を表示：日本語モード中は`English`、英語モード中は`日本語`）。切り替えると`main.ts`のモジュールレベル変数`lang`を反転し`render()`を再実行するだけで、現在の画面（start/game/rules）がその場で再描画される
- 既定言語は英語（`let lang: Lang = 'en'`）
- `render.ts`側の`renderStart` / `renderGame` / `renderRules`はすべて`lang: Lang`を引数に取り、内部で`getDict(lang)`した`Dict`をテンプレート文字列の差し込みに使うだけで、ロジック分岐は一切持たない

---

## 10. 戦績ランキング（`firebase.ts` / `records.ts`）

Firebase（Firestore）に対局結果を保存し、誰でも閲覧できるランキングを提供する機能。vs CPUで人間が勝った対局のみを記録対象とする（vs人間パス＆プレイの対局は記録しない）。

- `src/firebase.ts`：`initializeApp(firebaseConfig)` と `getFirestore` の呼び出しのみを行い、`db`（Firestoreインスタンス）をエクスポートする薄いモジュール。`game/` や `ui/` から直接Firestoreを触らせず、必ず`records.ts`経由にする設計
- `src/records.ts`：`submitRecord(record)` / `fetchRanking(category)` / `categoryFor(difficulty)` の3関数のみを公開する。`RecordCategory`は`'CPU_EASY' | 'CPU_NORMAL' | 'CPU_HARD'`の3種類のみ（vs人間の記録が無いため`HUMAN`カテゴリは存在しない。以前は`categoryFor`が`mode`も受け取りvs人間を`HUMAN`として記録していたが、後述の理由で撤去した）。Firestoreのクエリ組み立て（`where` + `orderBy` × 2 + `limit`）やコレクション名（`records`）といった詳細はこのモジュール内に閉じ込め、呼び出し側（`main.ts`）はFirestoreのAPIを一切知らなくてよい
- `game/engine.ts`に`winnerStoneCount(state)`（勝者の4ボード合計自石残数を返す純粋関数）と、`GameState.turnCount`（`applyAggressiveMove`のたびにインクリメントされるターン数）を追加し、戦績として送信する`moveCount` / `stonesRemaining`の算出はすべて`game/`側の既存の設計（DOM非依存の純粋関数）に従わせている。`main.ts`はこれらの値をそのままFirestoreに渡すだけ
- **記録対象の判定**（`shouldOfferRecord`、`render.ts`内）：`game.mode === 'VS_CPU' && game.winner === game.humanPlayer`。vs人間の対局・CPU自身の勝利はいずれも記録対象外（`main.ts`の`submitCurrentRecord`側でも同条件で二重にガードしている）。以前はvs人間の対局も`HUMAN`カテゴリとして記録していたが、CPU対戦限定に変更した経緯があり、`firestore.rules`の`category`バリデーションも`CPU_EASY`/`CPU_NORMAL`/`CPU_HARD`の3値のみを許可する形に合わせて更新済み（`HUMAN`はルール側でも拒否される）
- **名前入力フォームの状態管理**：`RecordSubmitStatus = 'idle' | 'submitting' | 'done' | 'skipped' | 'error'` を`main.ts`のモジュール変数`recordSubmitStatus`で保持し、`renderResult`（`render.ts`）がその値に応じてフォーム／送信中表示／完了表示を出し分ける。フォームは`<form>`のネイティブ`required`属性で簡易バリデーションし、`submit`イベントを`preventDefault`して`main.ts`のハンドラに渡す
- **XSS対策**：Firestoreの`records`コレクションは（4.4のルールで簡易バリデーションはしているものの）誰でも書き込める設計のため、`playerName`はユーザー由来の未検証データとして扱う必要がある。`render.ts`の`renderRanking`はテーブル描画時に`escapeHtml()`でエスケープしてから`innerHTML`に差し込んでいる（このアプリは全画面`innerHTML`テンプレート方式のため、外部由来の文字列を差し込む箇所では必ずこの対応が要る）
- **ランキング画面のデータ取得**：`main.ts`の`loadRanking(category)`が`fetchRanking`を呼び、成功/失敗をそれぞれ`RankingData = RankingEntry[] | 'error' | null`（`null`=ロード中）としてモジュール変数`rankingData`に格納し`render()`を呼び直す。カテゴリ切替や画面遷移で「今表示すべきものと違う」フェッチ結果が遅れて返ってきた場合は無視するガード（`appState.screen !== 'ranking' || rankingCategory !== category`）を入れている

---

## 11. 未実装だが設計上考慮している拡張ポイント

- **アンドゥ**：`GameState` は完全な不変スナップショットなので、`main.ts` 側に `history: GameState[]` を持たせて `applyAggressiveMove` 直後にpushするだけで実装できる設計になっている
- **CPU探索のさらなる強化**：`ai.ts` の `HARD` はアルファベータ枝刈り無しの全探索2手読みなので、探索の深さを増やす場合はアルファベータ枝刈りの導入が必要になる（現状の3〜4手先読みでも枝刈り無しだと組み合わせ数が急増するため）
- **ゲーム内設定の永続化**：`localStorage` への読み書きを行う `data/` 相当のモジュールを追加し、`main.ts` から呼び出す想定（現状は未着手。`lang` / `cpuDifficulty` もリロードで既定値に戻る）
- **戦績ランキングの不正対策強化**：現状はクライアントから直接Firestoreへ書き込む方式で、`firestore.rules`による値の範囲・型チェックはあるがゲーム進行自体のサーバーサイド検証は無いため、偽の戦績送信が技術的には可能。対策としてはCloud Functions経由での書き込み・Firebase Anonymous Authの導入などが考えられるが未着手

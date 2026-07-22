# Conventions & Architecture

詳細は`stone-push-web/Docs/design.md`（設計書）を参照。以下は非自明で見落としやすいポイントのみ。

## レイヤー分離（厳守されている設計方針）
- `src/game/`（`types.ts`/`engine.ts`/`ai.ts`）: DOM非依存の純粋TypeScript。すべての状態遷移関数は`GameState`を受け取り新しい`GameState`を返す（既存オブジェクトを変更しない）
- `src/ui/render.ts`: 描画・DOMイベント登録のみ。ゲームルール判定は持たず、ハイライト計算のため`engine.ts`の合法手列挙関数を呼び出すだけ（ロジックの二重実装を避ける）
- `src/main.ts`: 唯一の可変状態（`appState`・`lang`・`cpuDifficulty`等）を保持し、単方向データフロー（操作→状態遷移関数→新state→`render()`で全体再描画）
- `src/firebase.ts`は初期化のみ、Firestore操作は必ず`src/records.ts`経由（`game/`/`ui/`から直接Firestoreを触らない）

## 非自明な実装上の注意点（過去に実際起きた不具合・設計判断）
- `legalPassiveMoves()`はデッドエンド（対応するアグレッシブ移動が無いリード）を**フィルタ済みで返す**設計。パッシブ移動を実際に盤面適用せずに判定できる（アグレッシブ対象ボードは必ず逆色でパッシブ移動の影響を受けないため、盤面クローン不要）
- 完全デッドロック（次の手番に合法なリードが1つも無い）は`applyAggressiveMove`内でその場で反則負け判定する。これが無いとCPU側が例外を投げたり人間側の画面が固まる不具合があった
- CPUのAI評価関数`evaluate`はゼロサム設計（`evaluate(s,A) === -evaluate(s,B)`）でミニマックスと相性を取っている。`HARD`はアルファベータ枝刈り無しの全探索2手読み
- `innerHTML`全体再描画方式のため、CSS transitionでstate跨ぎのアニメーションができない。石の移動/押し出しアニメーションは`setState`前に**今表示されているDOMを直接**`transform`/`opacity`操作し、アニメ終了後に`setState`する2段階設計（`main.ts`の`animateSimpleMove`/`animatePush`）
- 表示反転（後攻＝白でプレイ中は自陣が画面下に来るよう表示順を反転）は`render.ts`内に閉じた表示専用の変換。`data-row`/`data-col`は常に論理座標を使うため、クリック処理・engine判定ロジックは表示反転の影響を受けない
- `.border-label`は必ず4枚の`.board`より後（DOM上5番目の子要素）に置くこと。先に置くと`nth-child`セレクタでの境界線強調がずれる不具合が実際に発生した
- `.result-overlay`は`z-index`を明示要（祖先要素がスタッキングコンテキストを確立しないため、指定が無いと`.stone`/`.border-label`の後ろに隠れる不具合があった）
- 戦績（Firestore `records`）はvs CPUで**人間が勝った場合のみ**記録対象（`shouldOfferRecord`条件、`main.ts`側でも二重ガード）。vs人間の対局・CPU勝利は記録しない。以前は`HUMAN`カテゴリもあったが撤去済み（`firestore.rules`も3値のみ許可するよう追随済み）
- `RecordCategory`は`'CPU_EASY' | 'CPU_NORMAL' | 'CPU_HARD'`の3種のみ
- ユーザー入力の`playerName`はランキング表示時に`escapeHtml()`でエスケープしてから`innerHTML`に差し込む（XSS対策。`innerHTML`全画面テンプレート方式のため外部由来文字列を挟む箇所では必須）
- 多言語対応: `i18n.ts`の`Dict`に文言集約。語順が言語間で異なる箇所は`win(player)`/`turn(player, phase)`のような関数として辞書に持たせる。既定言語は英語（`lang: Lang = 'en'`）
- 戦績ランキングはクライアントから直接Firestoreに書き込む方式のため不正送信が技術的に可能（`firestore.rules`で型/範囲チェックのみ、ゲーム進行のサーバー検証は無い）。既知の未対策事項として`design.md`11章に明記されている

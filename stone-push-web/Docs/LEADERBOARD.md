# みんなの戦績ランキング機能 — 実装内容・Firebase設定・運用手順（LEADERBOARD.md）

> ステータス：✅ 実装済み（Firebaseプロジェクト作成・Firestore設定・アプリ側実装まで完了）。
> 機能仕様は `spec.md`、実装アーキテクチャは `design.md` にも要約を追記済み。このファイルはFirebase固有の設定値・運用手順（Console操作など）の一次情報として残す。

---

## 1. 概要

対局終了時に勝者の名前を入力すると、戦績（手数・残り石数など）がFirebase（Firestore）に保存され、誰でも閲覧できるランキングページで確認できる機能。データ保存先はFirebase、サーバーは持たない（現在のWeb版と同じく完全にクライアントサイドのみで動く静的サイト構成を維持する）。

---

## 2. 機能仕様

### 2.1 記録対象・タイミング

- **人間が勝利した時のみ**、結果画面に名前入力ダイアログを表示する
  - vs 人間（パス＆プレイ）：どちらが勝っても記録対象
  - vs CPU：**人間側が勝った時のみ**記録対象。CPUが勝った（人間が負けた）場合はダイアログを出さず、通常の結果画面のみ表示する
- ダイアログは「スキップ」可能（勝っても記録しない選択ができる）

### 2.2 データ項目

| 項目 | 内容 |
|---|---|
| プレイヤー名 | ダイアログで入力（trim、最大文字数制限あり） |
| カテゴリ | `HUMAN` / `CPU_EASY` / `CPU_NORMAL` / `CPU_HARD` の4種類 |
| 手数 | 勝利までのターン数（**ランキングの主指標**） |
| 残り石数 | 勝者の4ボード合計の自石残数（0〜16。参考表示のみ、順位には使わない） |
| 記録日時 | サーバー側タイムスタンプ |

### 2.3 ランキングのルール

- 主指標は**手数の少なさ**（昇順）
- 手数が同じ場合は**同順位表示**（タイ許容。例：1位が2件あれば次は3位）
- 残り石数は表示のみでタイブレークには使わない

### 2.4 カテゴリ分け

vs人間・CPUよわい・CPUふつう・CPUつよいの4カテゴリを完全に別のランキングとして扱う（難易度が違うと手数の比較に意味が無いため）。ランキング画面はカテゴリ切替タブ／プルダウンを持つ。

### 2.5 画面構成

- **Top画面**：既存メニューに「🏆 ランキング」への導線を追加（ルール説明ボタンの近くに配置する想定）
- **結果画面（`GAME_OVER`）**：人間の勝利時のみ、名前入力ダイアログを追加表示（既存の「もう一度」「メニューに戻る」ボタンより前に出す）
- **ランキング画面（新規）**：カテゴリ切替＋上位N件（例：50件）のテーブル（順位／名前／手数／残り石数／日時）。ページネーションは初期スコープでは無し（上位N件のみ表示）

---

## 3. データモデル（Firestore）

### 3.1 コレクション構成

コレクション名：`records`（1ドキュメント＝1勝利記録、サブコレクション無しのフラット構成）

### 3.2 ドキュメントスキーマ

```jsonc
{
  "playerName": "たろう",              // string, 1〜16文字程度
  "category": "CPU_HARD",             // "HUMAN" | "CPU_EASY" | "CPU_NORMAL" | "CPU_HARD"
  "moveCount": 12,                    // number, 正の整数（実用上の上限あり、目安200程度）
  "stonesRemaining": 9,               // number, 0〜16の整数
  "createdAt": "<serverTimestamp>"    // Firestore の serverTimestamp()
}
```

### 3.3 クエリ・インデックス

- ランキング取得は `records` を `category == X` で絞り込み、`moveCount` 昇順、`createdAt` 昇順（同率内の表示順安定化のため）でソートして先頭50件を取得（`src/records.ts` の `fetchRanking`）
- 複合クエリ（`where category ==` + `orderBy moveCount, createdAt`）になるため、Firestoreの複合インデックスが1つ必要。`firestore.indexes.json`に定義済みで、`firebase deploy --only firestore:indexes` でデプロイ済み

---

## 4. Firebase側の設定内容（実施済み）

CLIで実施した内容の記録。同じ手順を再現・別プロジェクトへ展開する場合の参考用。

### 4.1 Firebaseプロジェクトの作成

- プロジェクトID：`stone-push-web`（表示名：Stone Push Web）
- `npx firebase-tools login` でCLI認証後、`npx firebase-tools projects:create stone-push-web --display-name "Stone Push Web"` で作成
- 新規プロジェクトはCloud Firestore APIが未有効のため、初回のみ https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=stone-push-web を手動で開き「有効にする」操作が必要だった（Google Cloud側の複数アカウント混在で開けない場合はシークレットウィンドウで該当アカウントに再ログインして開く）

### 4.2 Firestoreの有効化

`npx firebase-tools firestore:databases:create "(default)" --location asia-northeast1 --project stone-push-web` で東京リージョンにデフォルトデータベースを作成済み

### 4.3 Webアプリの登録・SDK設定値

`npx firebase-tools apps:create WEB "stone-push-web" --project stone-push-web` で登録。設定値は `src/firebase.ts` にハードコード済み（秘密鍵ではないため問題無い。実際のアクセス制御は4.4のセキュリティルールで行う）：

```
projectId: stone-push-web
appId: 1:320592322344:web:5272dd89927cbeb5b53a1d
storageBucket: stone-push-web.firebasestorage.app
apiKey: AIzaSyBEwK7hL25ed8sUHLJihE8m35LqyKUhYms
authDomain: stone-push-web.firebaseapp.com
messagingSenderId: 320592322344
```

### 4.4 セキュリティルール

リポジトリ内 `stone-push-web/firestore.rules` に定義し、`firebase deploy --only firestore:rules` でデプロイ済み。内容は以下（読み取り全公開・作成のみ許可＋簡易バリデーション・更新削除禁止）：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /records/{recordId} {
      allow read: if true;
      allow update, delete: if false;
      allow create: if
        request.resource.data.keys().hasOnly(['playerName', 'category', 'moveCount', 'stonesRemaining', 'createdAt']) &&
        request.resource.data.playerName is string &&
        request.resource.data.playerName.size() > 0 &&
        request.resource.data.playerName.size() <= 16 &&
        request.resource.data.category in ['HUMAN', 'CPU_EASY', 'CPU_NORMAL', 'CPU_HARD'] &&
        request.resource.data.moveCount is int &&
        request.resource.data.moveCount > 0 &&
        request.resource.data.moveCount <= 200 &&
        request.resource.data.stonesRemaining is int &&
        request.resource.data.stonesRemaining >= 0 &&
        request.resource.data.stonesRemaining <= 16 &&
        request.resource.data.createdAt == request.time;
    }
  }
}
```

このルールは「明らかにおかしい値（異常な手数・不正なカテゴリ名など）」だけを弾く簡易バリデーションであり、「本当にそのゲームをプレイしたか」は検証していない（ブラウザの開発者ツールから、ルールの範囲内で偽の戦績を送ることは技術的には可能）。この点は7章の今後のtodoを参照。

ルールを変更したい場合は `stone-push-web/firestore.rules` を編集し、`stone-push-web` ディレクトリで `npx firebase-tools deploy --only firestore:rules` を実行すれば反映される（`.firebaserc` にプロジェクトIDを固定済みなので `--project` 指定は不要）。

### 4.5 設定管理ファイル

リポジトリに以下を追加済み（すべてGit管理対象。機密情報は含まない）：
- `stone-push-web/firebase.json`：ルール・インデックスファイルの参照先
- `stone-push-web/.firebaserc`：デフォルトプロジェクトを`stone-push-web`に固定
- `stone-push-web/firestore.rules`：4.4のルール本体
- `stone-push-web/firestore.indexes.json`：3.3の複合インデックス定義

---

## 5. 実装済みの変更点（コードベース側）

- [x] `npm install firebase`
- [x] `src/firebase.ts`：`initializeApp(firebaseConfig)` と Firestore インスタンスのエクスポート
- [x] `src/game/types.ts`：`GameState` に `turnCount: number` を追加
- [x] `src/game/engine.ts`：`applyAggressiveMove` でターン確定のたびに `turnCount` をインクリメント。勝者の4ボード合計自石残数を返す `winnerStoneCount(state)` を追加
- [x] `src/records.ts`：`submitRecord` / `fetchRanking` / `categoryFor` を実装し、Firestore呼び出しをこのモジュールに閉じ込め
- [x] `src/i18n.ts`：ランキング画面・名前入力ダイアログ用の文言を日英で追加
- [x] `src/ui/render.ts`：
  - `renderResult` に、人間勝利時のみ名前入力フォーム（`<form id="record-form">`、ネイティブ`required`バリデーション）を追加
  - `renderRanking`（新規）：カテゴリタブ＋テーブル描画。Firestoreから取得した`playerName`は`escapeHtml`でエスケープしてからinnerHTMLに差し込む（XSS対策。任意のクライアントから書き込めるフィールドのため必須）
- [x] `src/main.ts`：
  - `AppState` に `{ screen: 'ranking' }` を追加
  - Top画面からの遷移ハンドラ（`openRanking`）、カテゴリ切替（`selectRankingCategory`）を追加。フェッチ完了時に画面/カテゴリが変わっていたら結果を無視するガード付き
  - 結果画面の名前入力送信ハンドラ（`submitCurrentRecord`）：送信中`submitting`→成功`done`／失敗`error`の状態を`recordSubmitStatus`で管理し、新しい対局を始めるたびに`idle`にリセット
- [x] `src/style.css`：記録フォーム・ランキングテーブル・カテゴリタブのスタイル追加
- [x] `firestore.indexes.json` を追加しデプロイ（3.3参照）

---

## 6. 運用方法

### 6.1 データの閲覧・確認

Firebase Console →「Firestore Database」→「データ」タブ →`records`コレクションで、登録された戦績を一覧・検索できる。特別なツールは不要。

### 6.2 不適切なデータの削除

1. Firebase Console →「Firestore Database」→「データ」タブ
2. 該当ドキュメントを選択 →「ドキュメントを削除」
3. 複数件を一括削除したい場合は、Console上での複数選択削除、または Cloud Shell / ローカルから Admin SDK スクリプトを実行して削除する（例：不適切な単語を含む`playerName`を一括検索して削除、など）。この一括削除スクリプトは現状未整備なので、必要になったタイミングで別途用意する

セキュリティルールで `update`/`delete` をクライアントから禁止しているため、荒らされたとしても「勝手にデータを書き換えられる／消される」ことは無く、Console側からの削除だけで対応できる。

### 6.3 利用量・コストの監視

- Firebase Console →「使用量と請求額」で Firestore の読み取り／書き込み／ストレージ使用量を確認できる
- 無料枠（Sparkプラン）の目安：読み取り 50,000回/日、書き込み 20,000回/日、ストレージ 1GB。個人・身内向け利用であればこの範囲に収まる想定
- 想定外にアクセスが急増した場合に備え、Console上で予算アラート（Cloud Billingの予算通知）を設定しておくと安心（Sparkプランは従量課金が発生しない無料枠のみのプランのため必須ではないが、Blazeプランに切り替えた場合は設定を推奨）

### 6.4 荒らされた場合の対応フロー

1. ランキング画面や Firestore Console で不審なデータ（極端な手数・不適切な名前など）を発見
2. 6.2の手順でドキュメントを削除
3. 頻発するようであれば、7章の「今後のtodo」にある対策（Cloud Functionsでの検証、投稿頻度制限、Firebase App Check等）の実装を検討する

### 6.5 Firebaseプロジェクト自体の管理

- 課金プランはデフォルトの Spark（無料）プランのままで運用可能。Cloud Functionsを使う対策（7章）を実装する場合は Blaze（従量課金）プランへのアップグレードが必要になる点に注意
- プロジェクトの削除・再作成が必要になった場合、Firebase Console →「プロジェクトの設定」→「全般」の最下部から削除できる（既存の戦績データも全て消えるため要注意）

---

## 7. 未実装・今後の拡張候補（backlog）

- **不正対策の強化**：現状（4.4のルール）は値の形式チェックのみで、「本当にそのゲームをプレイしたか」は検証していない。Cloud Functions（Callable Function）でクライアントから直接Firestoreに書き込ませず、サーバー側の関数を経由させることで、簡易的な妥当性チェック（例：短時間に大量送信していないか、手数と戦績の傾向に極端な矛盾が無いか）を追加できる。あわせて Firebase Anonymous Auth を使い、ルール側で`request.auth != null`を要求するだけでも、devtoolsからの野良スクリプト送信への軽いハードルにはなる
- **ページネーション**：現状は上位N件の固定表示のみ。件数が増えてきたら「もっと見る」等の追加読み込みを検討
- **名前の不適切表現フィルタ**：現状は文字数制限のみ。必要であれば簡易NGワードフィルタをクライアント側 or Cloud Functions側に追加
- **戦績のグラフ化・自分の順位ハイライト**：任意の発展要素

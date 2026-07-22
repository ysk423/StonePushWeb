# Suggested Commands

全てのnpm/vite/firebase-toolsコマンドは `stone-push-web/`（repo rootのサブディレクトリ）で実行すること。`mem:core`参照。

## 開発・ビルド
- `npm run dev` — Vite開発サーバー
- `npm run build` — `tsc && vite build`（型チェック込み。CIもこれを実行）
- `npm run preview` — ビルド済み`dist`をローカルプレビュー
- `npm run deploy` — `npm run build && gh-pages -d dist`（このプロジェクトの実際の公開経路はGitHub Actions自動デプロイであり、このスクリプトは手動デプロイ用の代替手段）
- 型チェックのみ: `npx tsc --noEmit`

## Firebase / Firestore（`stone-push-web/`直下で実行、プロジェクト名は`.firebaserc`で`stone-push-web`に固定済み）
- ルール/インデックスのデプロイ: `npx firebase-tools deploy --only firestore:rules` / `npx firebase-tools deploy --only firestore:indexes`
- 1件削除: `npx firebase-tools firestore:delete records/<ドキュメントID> --force`
- コレクション全削除（要注意・取り消し不可）: `npx firebase-tools firestore:delete records --recursive --force`
- 詳細手順は`Docs/RECORD_DELETION.md`参照

## Windows(Git Bash)固有の注意
- シェルはGit Bash（POSIX sh）。パスにスペースを含む（`Stone Push web`）ため、`cd`や引数はダブルクォートで囲む
- 通常の`ls`/`find`/`cat`等はGit Bash上でUnix同様に動作する

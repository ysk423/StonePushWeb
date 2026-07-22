# Stone Push Web — Core Map

Web版「Stone Push」ボードゲーム（Vite + TypeScript、UIフレームワーク無し）。
リポジトリルート（`.git`直下）とVite/npmプロジェクトルートが異なる点に注意:

- `Stone Push web/`（repo root, `.git`・`.github/workflows/deploy.yml`はここ）
  - `stone-push-web/`（npmプロジェクトルート。`package.json`・`src/`・Firebase設定はすべてここ）

作業ディレクトリを間違えると `npm run build` 等が失敗するので、npm/vite/firebase-toolsコマンドは必ず `stone-push-web/` で実行する。

## Doc-first policy
コード仕様・アーキテクチャは `stone-push-web/Docs/spec.md`（機能仕様）と `Docs/design.md`（実装アーキテクチャ）の2ファイルにまとまっている。この2つを読めば実装を読まなくても全体像が分かる設計方針なので、機能追加・仕様確認時はまずここを読む。コード変更時はこの2ファイルの記述も追随して更新する運用（コミット履歴にも "ドキュメント内の参照を修正" 等が見られる）。

## Further memories
- 技術スタック・バージョン: `mem:tech_stack`
- 実行コマンド（Windows固有の違い含む）: `mem:suggested_commands`
- コード規約・アーキテクチャ設計方針: `mem:conventions`
- タスク完了時に実行すべきチェック: `mem:task_completion`

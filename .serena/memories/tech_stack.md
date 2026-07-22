# Tech Stack

- TypeScript (~6.0.2, `noEmit`, tsconfig targets ES2023/DOM, `moduleResolution: bundler`, `verbatimModuleSyntax`, `erasableSyntaxOnly`)
- Vite ^8.1.1（ビルドツール兼devサーバー）。`vite.config.ts`の`base: '/StonePushWeb/'`はGitHub Pagesのリポジトリ名と一致させる必要がある固定値
- Firebase ^12.16.0（Firestoreのみ使用。Authや他サービスは未使用）。プロジェクト名固定: `stone-push-web`（`.firebaserc`）
- UIフレームワーク無し（素のTypeScript + DOM操作、`innerHTML`による全体再描画方式）。状態管理ライブラリ・DIコンテナも無し
- デプロイ先: GitHub Pages（`main` push時に`.github/workflows/deploy.yml`が自動デプロイ）。Firebase Hosting自体は使わずFirestoreのみ利用
- パッケージマネージャ: npm（`package-lock.json`あり、CIも`npm ci`）

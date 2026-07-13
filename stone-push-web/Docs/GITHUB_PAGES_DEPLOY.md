# GitHub Pages 公開手順（簡易版）

> Stone Push Web版（Vite + TypeScript、フレームワークなし）を GitHub Pages で公開するための手順書。
> まだ実施していない（Docs/PROJECT_BRIEF.md の「今後の作業」に該当）。
> GitHub Actions は使わず、`gh-pages` コマンド1つでローカルから直接公開する方式（一番シンプル）。
> 慣れて自動化したくなったら Actions 化を検討すればよい。

---

## 0. 前提

- GitHub アカウントを持っていること
- ローカルに Git がインストールされていること
- `stone-push-web` フォルダはまだ Git 管理下にない（`git init` 未実施）

---

## 1. GitHub 上にリポジトリを作成（作成済み）

リポジトリ名：**StonePushWeb**
`git@github.com:ysk423/StonePushWeb.git`

---

## 2. ローカルリポジトリの初期化とプッシュ

`stone-push-web` フォルダ（`package.json` があるフォルダ）で実行：

```bash
cd stone-push-web
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:ysk423/StonePushWeb.git
git push -u origin main
```

SSH接続（`git@github.com:...`）を使うので、事前にSSH鍵をGitHubアカウントに登録しておくこと（`ssh -T git@github.com` で疎通確認できる）。

---

## 3. `vite.config.ts` に `base` を設定

`https://ysk423.github.io/StonePushWeb/` の形で公開するので、Vite にリポジトリ名を教える必要がある。これをやらないと公開後に画面が真っ白になる（最頻出のハマりどころ）。

`stone-push-web/vite.config.ts` を新規作成：

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/StonePushWeb/', // リポジトリ名（大文字小文字も一致させる）
})
```

---

## 4. `gh-pages` パッケージを導入

```bash
npm install -D gh-pages
```

`package.json` の `"scripts"` に1行追加：

```json
"deploy": "npm run build && gh-pages -d dist"
```

（`build` は既存の `"tsc && vite build"` をそのまま使う）

---

## 5. デプロイ実行

```bash
npm run deploy
```

これで `dist/` の中身が `gh-pages` という別ブランチに自動でコミット・プッシュされる（ローカルの `main` ブランチの作業には影響しない）。

---

## 6. GitHub 側で Pages を有効化（最初の1回だけ）

1. GitHub のリポジトリページ → **Settings** → **Pages**
2. 「Build and deployment」の **Source** を **Deploy from a branch** のまま、
   Branch を **gh-pages** / **`/(root)`** に設定して Save
3. 数分待つと `https://ysk423.github.io/StonePushWeb/` で公開される

---

## 7. 更新したいとき

コードを直したら、コミットして（任意）、もう一度これだけでOK：

```bash
npm run deploy
```

`main` への push とは別操作なので、「`main` にはまだ出したくない変更を試しに公開してみる」ということもできる（が、基本は main を更新してから deploy するのが分かりやすい）。

---

## 8. うまく表示されないときのチェックリスト

- 真っ白になる → `vite.config.ts` の `base` がリポジトリ名と一致しているか確認
- 404になる → Settings → Pages の Branch 設定が `gh-pages` になっているか確認
- 反映されない → デプロイ直後は数分ラグがあるので少し待ってから再読み込み（キャッシュも疑ってスーパーリロード）

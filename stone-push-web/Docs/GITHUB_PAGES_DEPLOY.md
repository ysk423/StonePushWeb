# GitHub Pages 公開手順

> Stone Push Web版（Vite + TypeScript、フレームワークなし）を GitHub Pages で公開するための手順書。
> 初回公開は完了済み：**https://ysk423.github.io/StonePushWeb/**
>
> **現在の方式：GitHub Actions による自動デプロイ**（`main` に push するだけで自動ビルド＆公開）。
> 1〜6は最初に `gh-pages` コマンドで手動公開したときの記録（参考・過去のやり方）。
> **今後コードを変更したときは 7章「GitHub Actions化した後の更新手順」だけ読めばOK**。

---

## 0. 前提（初回セットアップ時点のもの）

- GitHub アカウントを持っていること
- ローカルに Git がインストールされていること
- `stone-push-web` フォルダはまだ Git 管理下にない（`git init` 未実施）

> ステータス：✅ 完了。`stone-push-web` は `main` ブランチで `origin`（`git@github.com:ysk423/StonePushWeb.git`）に接続済み。

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

> ステータス：✅ 完了。公開確認済み。

---

## 7. GitHub Actions化した後の更新手順（今はこれだけでOK）

コードを変更したら、**`main` に push するだけ**。ビルドと公開は GitHub 側が自動でやってくれる。

```bash
git add -A
git status               # 意図した差分だけがステージされているか確認してから進める
git commit -m "変更内容の説明"
git push
```

- push をトリガーに `.github/workflows/deploy.yml` が動き、`npm ci` → `npm run build` → `dist/` を GitHub Pages にデプロイ、まで自動実行される
- GitHub のリポジトリページ → **Actions** タブで進行状況（緑チェック＝成功、赤×＝失敗）を確認できる
- 数分待ってから `https://ysk423.github.io/StonePushWeb/` を再読み込み（反映されない場合はスーパーリロード）

`npm run deploy`（8章の旧方式）はもう実行しなくてよい。

---

## 8. GitHub Actionsへの切り替え作業（実施記録）

もともとは `gh-pages` コマンドでの手動公開（1〜6章）だったが、Actionsによる自動化に切り替えた。

### 8.1 追加したファイル

**リポジトリのルート直下**（`stone-push-web` フォルダの1つ上、`.git` がある場所）に `.github/workflows/deploy.yml` を作成：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: stone-push-web/package-lock.json
      - run: npm ci
        working-directory: stone-push-web
      - run: npm run build
        working-directory: stone-push-web
      - uses: actions/upload-pages-artifact@v3
        with:
          path: stone-push-web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

> **重要**：このリポジトリは `stone-push-web` フォルダ自体ではなく、その1つ上のフォルダ（`.git` がある場所）がルート。ワークフロー内で `working-directory: stone-push-web` や `path: stone-push-web/dist` のように毎回パスを指定しているのはそのため。

### 8.2 GitHub側で必要な設定変更（Web画面での操作・要対応）

1. `https://github.com/ysk423/StonePushWeb` → **Settings** → **Pages**
2. 「Build and deployment」の **Source** を、今までの **Deploy from a branch** から **GitHub Actions** に変更して保存

これをやらないと、Actionsが動いても公開先（Pagesの配信元）が古いままの `gh-pages` ブランチを見続けてしまう。**この設定変更だけはWeb画面上の操作なので、忘れずに手動で行うこと。**

### 8.3 動作確認

1. `.github/workflows/deploy.yml` をコミットして `main` に push
2. Actions タブでワークフローが成功するのを確認
3. `https://ysk423.github.io/StonePushWeb/` を開いて表示されるか確認

### 8.4 旧方式（`gh-pages` ブランチ）の後始末

Actionsに完全移行したあとは、`package.json` の `deploy` スクリプトと `devDependencies` の `gh-pages` は不要になる（残しておいても害はないが、掃除したい場合は削除してよい）。`gh-pages` ブランチ自体もGitHub上で削除して構わない（Pagesの配信元をActionsに切り替えた後は参照されない）。

---

## 9. うまく表示されないときのチェックリスト

- 真っ白になる → `vite.config.ts` の `base` がリポジトリ名と一致しているか確認
- Actionsが失敗する → Actionsタブでログを開き、`npm ci` / `npm run build` のどちらで落ちているか確認（`working-directory` の指定漏れが典型的な原因）
- 404になる → Settings → Pages の Source が **GitHub Actions** になっているか確認（`gh-pages` ブランチ指定のままだと反映されない）
- 反映されない → デプロイ直後は数分ラグがあるので少し待ってから再読み込み（キャッシュも疑ってスーパーリロード）

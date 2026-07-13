# GitHub Pages 公開手順（簡易版）

> Stone Push Web版（Vite + TypeScript、フレームワークなし）を GitHub Pages で公開するための手順書。
> 初回公開は完了済み：**https://ysk423.github.io/StonePushWeb/**
> GitHub Actions は使わず、`gh-pages` コマンド1つでローカルから直接公開する方式（一番シンプル）。
> 慣れて自動化したくなったら Actions 化を検討すればよい。
>
> 1〜6は初回セットアップの記録（実施済み）。**今後コードを変更したときは 7章「更新したいとき」だけ読めばOK**。

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

## 7. 更新したいとき（今後の変更のデプロイ手順）

コードを変更するたびに、この2ステップだけでOK。

### 7.1 変更内容を `main` に記録する（推奨・基本の流れ）

`stone-push-web` フォルダで実行：

```bash
git add -A
git status               # 意図した差分だけがステージされているか確認してから進める
git commit -m "変更内容の説明"
git push
```

### 7.2 公開サイトに反映する

`stone-push-web` フォルダ（`package.json` がある場所）でターミナルに以下を打つだけ：

```bash
npm run deploy
```

- 内部で `npm run build`（型チェック＋ビルド）→ `gh-pages -d dist` が実行され、`dist/` の中身が `gh-pages` ブランチにプッシュされる
- 数分待ってから `https://ysk423.github.io/StonePushWeb/` を再読み込みすれば反映されている（キャッシュが残る場合はスーパーリロード）

### 補足：なぜ `git push`（7.1）だけでは公開に反映されないか

- `main` ブランチには**ソースコード**（TypeScriptなど、ビルド前のファイル）が入っている
- ブラウザに配信されるのは**ビルド後のJS/CSS**（`dist/`の中身）
- GitHub の Settings → Pages では「Branch: `gh-pages`」を指定しているので、GitHubは`gh-pages`ブランチの中身だけを公開している
- `git push`は`main`を更新するだけで、`gh-pages`ブランチには一切触れない
- `gh-pages`ブランチを更新できるのは`npm run deploy`（ローカルで`npm run build`→できた`dist/`を`gh-pages`ブランチとして手動でプッシュする）だけ

つまり「`main`にpush」＝ソースの記録、「`npm run deploy`」＝公開反映、で役割が分かれている。**両方やって初めて公開サイトに変更が反映される**（7.1だけでは反映されない）。

> `git push`だけで公開まで自動化したい場合は、GitHub Actionsに切り替えることで実現できる（`main`へのpushをトリガーに自動ビルド＆公開）。必要になったら別途対応する。

### 補足

- `git push`（main更新）と `npm run deploy`（公開サイト更新）は**別操作**。7.1をせずに7.2だけ実行しても公開はできる（「mainにはまだ出したくない変更を試しに公開してみる」も可能）が、`main` の履歴と公開中の内容がずれるので、基本は **7.1 → 7.2 の順**にする
- まとめて1コマンドにしたい場合は `package.json` の `scripts` に以下を追加してもよい（コミットメッセージを毎回変えたいので自動化はしていない）：
  ```json
  "release": "git push && npm run deploy"
  ```

---

## 8. うまく表示されないときのチェックリスト

- 真っ白になる → `vite.config.ts` の `base` がリポジトリ名と一致しているか確認
- 404になる → Settings → Pages の Branch 設定が `gh-pages` になっているか確認
- 反映されない → デプロイ直後は数分ラグがあるので少し待ってから再読み込み（キャッシュも疑ってスーパーリロード）

# サイトを公開する

サイトは<https://musubi.cardene.dev/>にある。
GitHub Pagesが、このリポジトリの`gh-pages`ブランチから配信する。
CIではビルドしない。
オーナーが公開すると決めた時に、自分の手元から公開する。

## 公開

`main`ブランチの上で、コミットしていない変更がない時に、ghで一度GitHubにログインしてから公開のコマンドを実行する。

```bash
gh auth login
pnpm site:publish
```

このコマンドは、サイトを一時フォルダにビルドし、そのページを持つコミットを`gh-pages`の上に1つ追加してプッシュする。
ビルドは、ログインしたghでトピック`musubi-skills`を持つ公開リポジトリをGitHubで検索し、そのスキルと`registry/`のスキルをGitHubから読む。
ghで検索できない時は、ページを1つも書き出さずにビルドが止まり、何も公開しない。
`main`以外のブランチの上と、コミットしていない変更がある時は実行を拒否し、ビルドが失敗した時は何もプッシュしない。
`gh-pages`の履歴は書き換えず、作業ツリーのファイルも変えない。
プッシュから1分ほどで、GitHub Pagesが新しいページを配信する。

ビルドは、`musubi.cardene.dev`を書いた`CNAME`ファイルと、空の`.nojekyll`ファイルを書き出す。
これで、GitHub Pagesはこのドメインでファイルをそのまま配信する。

## 最初に1回だけ行う設定

DNSのレコードの作成とドメインの確認は、オーナーがCloudflareとGitHubの画面で1回だけ行う。
リポジトリをドメインに向ける前にドメインを確認し、ほかのアカウントが`musubi.cardene.dev`を使えないようにする。

| 順番 | 画面 | 行うこと |
|---|---|---|
| 1 | GitHubの右上のプロフィール画像、Settings、Pages、Add a domain | `cardene.dev`を入力してAdd domainを押す。GitHubが`TXT`レコードの名前と値を表示する |
| 2 | Cloudflareの`cardene.dev`、DNS、レコード、レコードを追加 | タイプは`TXT`、名前とコンテンツはGitHubが表示した値にして、保存を押す |
| 3 | GitHubの同じPagesの設定 | `cardene.dev`のVerifyを押す |
| 4 | Cloudflareの`cardene.dev`、DNS、レコード、レコードを追加 | タイプは`CNAME`、名前は`musubi`、ターゲットはこのリポジトリのオーナーの`<owner>.github.io`、プロキシステータスはDNSのみにして、保存を押す |

`CNAME`レコードはDNSのみのままにする。
GitHub Pagesは、リクエストが直接届く時だけHTTPSの証明書を発行するためである。

最初の`pnpm site:publish`が`gh-pages`ブランチを作ると、GitHubがそのブランチのPagesを自動でオンにする。
その後に、このリポジトリの中で次を実行して、カスタムドメインを設定する。
オーナーとリポジトリの名前は`gh`が埋める。
1行目はPagesがまだオフの時だけ必要で、オンの時は`GitHub Pages is already enabled`と返る。

```bash
gh api --method POST "repos/{owner}/{repo}/pages" -f "source[branch]=gh-pages" -f "source[path]=/"
gh api --method PUT "repos/{owner}/{repo}/pages" -f cname=musubi.cardene.dev
```

GitHubが証明書を発行したら、HTTPSだけで配信する設定にする。
証明書の発行には1日ほどかかることがある。

```bash
gh api --method PUT "repos/{owner}/{repo}/pages" -F https_enforced=true
```

# サイトを公開する

サイトは<https://musubi.cardene.dev/>にある。
GitHub Pagesが、このrepoの`gh-pages`の枝から配る。
CIでは組み立てない。
持ち主が決めた時に、自分の手元から公開する。

## 公開する

`main`の上で、commitしていない変更が無い時に、次を打つ。

```bash
pnpm site:publish
```

命令は、載せたスキルをGitHubから読んでサイトを一時フォルダに組み立て、その頁を持つcommitを`gh-pages`の上に1つ足して送る。
`main`以外の枝の上と、commitしていない変更が在る時は拒み、組み立てが落ちた時は何も送らない。
`gh-pages`の履歴を書き換えず、作業中のfileも変えない。
送ってから1分ほどで、GitHub Pagesが新しい頁を配る。

組み立ては、`musubi.cardene.dev`を書いた`CNAME`と、空の`.nojekyll`を書き出す。
これで、GitHub Pagesはこのドメインの下でfileをそのまま配る。

## 最初に1度だけ行う設定

DNSのレコードとドメインの確認は、持ち主がCloudflareとGitHubの画面で1度だけ行う。
repoをドメインに向ける前にドメインを確認し、ほかのアカウントが`musubi.cardene.dev`を名乗れないようにする。

| 順 | 画面 | 行うこと |
|---|---|---|
| 1 | GitHubの右上のアイコン、Settings、Pages、Add a domain | `cardene.dev`を入れてAdd domainを押す。GitHubが`TXT`のレコードの名前と値を出す |
| 2 | Cloudflareの`cardene.dev`、DNS、レコード、レコードを追加 | タイプは`TXT`、名前とコンテンツはGitHubが出した物にして、保存を押す |
| 3 | GitHubの同じPagesの設定 | `cardene.dev`のVerifyを押す |
| 4 | Cloudflareの`cardene.dev`、DNS、レコード、レコードを追加 | タイプは`CNAME`、名前は`musubi`、ターゲットはこのrepoの持ち主の`<owner>.github.io`、プロキシステータスはDNSのみにして、保存を押す |

`CNAME`のレコードはDNSのみのままにする。
GitHub Pagesは、自分に直に届く時だけHTTPSの証明書を出すため。

最初の`pnpm site:publish`の後に、repoのPagesを枝とドメインに向ける。
次をこのrepoの中で打つと、`gh`が持ち主とrepoの名前を埋める。

```bash
gh api --method POST "repos/{owner}/{repo}/pages" -f "source[branch]=gh-pages" -f "source[path]=/"
gh api --method PUT "repos/{owner}/{repo}/pages" -f cname=musubi.cardene.dev
```

GitHubが証明書を出したら (1日ほど掛かることがある)、HTTPSだけで配る設定を入れる。

```bash
gh api --method PUT "repos/{owner}/{repo}/pages" -F https_enforced=true
```

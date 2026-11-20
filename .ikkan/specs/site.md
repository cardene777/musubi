# site

| 条件 | 確かめ方 | 出元 |
|---|---|---|
| `node site/build.ts`は、`spec/musubi.md`と`spec/musubi.ja.md`の見出しを全て持つ定義の頁を、英語と日本語で1つずつ書き出す | `pnpm test`の検査`site-renders-the-spec-in-both-languages`が通る | #4 |
| 定義の頁は`spec/`の文書を組み立ての時に読み、`site/`の下に定義の文の写しを持たない | `pnpm test`の検査`site-reads-the-spec-without-a-copy`が通る | #4 |
| 一覧の頁は、`registry/`に載ったスキルごとに、持ち主とrepoと、出す中身の名前と版と、従う中身の名前と版の範囲を出す | `pnpm test`の検査`site-lists-registered-skills`が通る | #4 |
| 登録のrepoに在っても、`registry/`の登録が名指さないスキルは一覧に出ない | `pnpm test`の検査`site-leaves-out-unregistered-skills`が通る | #4 |
| スキルの頁は、従う先と従っている先を両方挙げ、`musubi graph`と同じ形の図で両方の矢印を描く | `pnpm test`の検査`site-skill-page-shows-both-directions`が通る | #4 |
| 同じ名前のスキルが2つのrepoに在る時、別々の頁を書き出し、一覧は持ち主とrepoを添えて両方を出す | `pnpm test`の検査`site-tells-apart-same-skill-names`が通る | #4 |
| `musubi.json`を読めない登録は、組み立ての出力に登録のfileとフォルダを名指し、一覧から外す。組み立ては残りの頁を書き出して終わり方0で終わる | `pnpm test`の検査`site-names-unreadable-entries`が通る | #4 |
| 一覧は50件ごとに頁を分け、各頁の上と下にページ送りを置く | `pnpm test`の検査`site-pages-the-list-by-50`が通る | #4 |
| 全ての頁は、ヘッダーに英語と日本語を切り替えるリンクを持ち、`hreflang`で対の頁を名指す | `pnpm test`の検査`site-header-switches-the-language`が通る | #4 |
| 組み立ては`sitemap.xml`と`llms.txt`を書き出し、`sitemap.xml`は書き出した全ての頁を挙げ、各頁は構造化データ (JSON-LD) を持つ | `pnpm test`の検査`site-writes-the-search-files`が通る | #4 |
| `registry/`の下のfileは全て`registry/<持ち主>/<repo>.json`の形で、`skills`にrepoの中の相対のpathを重ねずに並べる | `pnpm test`の検査`registry-entries-are-well-formed`が通る | #4 |
| `registry/`は、agent-shurikenの`design-doc`とevm-devの5つの設計のスキルのフォルダを挙げる | `pnpm test`の検査`registry-lists-the-first-skills`が通る | #4 |
| `README.md`と`README.ja.md`は、`registry/`へPRを送ってスキルを一覧に載せる手順と、サイトを組み立てる命令を示す | `pnpm test`の検査`readme-shows-how-to-register`が通る | #4 |
| 追跡するfileのうち、アカウントの名前を持つのは`LICENSE`と`package.json`と`registry/`の下と`design/`の下だけで、ほかのfileは持たない | `pnpm test`の検査`account-name-only-in-license-and-package`が通る | #4 |
| `npm pack`が作ったfileは、`site/`と`registry/`の下のfileを含まない | `pnpm test`の検査`packed-files-leave-out-the-site`が通る | #4 |
| 命令は実行の時の依存を持たないまま、サイトの組み立ても開発の依存を足さない | `pnpm test`の検査`package-has-no-runtime-dependencies`が通る | #4 |
| `musubi graph`が書き出す図は今と同じ箱と矢印を持つ | `pnpm test`の検査`graph-writes-the-skills-and-edges`が通る | #4 |
| 英語と日本語の文書の形 (見出しと表と囲み) は揃ったままである | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #4 #13 |
| 5つのスキルが1つのスキルに従う図と、1つのスキルが2つのスキルに従う図で、矢印に添えた文字の枠に、どの矢印の線も入らない | `pnpm test`の検査`graph-labels-stay-clear-of-every-line`が通る | #11 |
| 矢印は出す側の箱から文字の幅より長く真っすぐに出て、曲がり始めるのは文字の右端より先になる | `pnpm test`の検査`graph-edges-run-straight-under-their-labels`が通る | #11 |
| `musubi graph`は、今までどおりスキルごとの箱と従う先への矢印を書き出す | `pnpm test`の検査`graph-writes-the-skills-and-edges`が通る | #11 |
| 全ての頁は、ブラウザのタブのアイコンとスマホのホーム画面のアイコンを名指し、組み立ては名指したfileを書き出す | `pnpm test`の検査`site-pages-name-the-icons`が通る | #11 |
| スマホのホーム画面のアイコンは180×180のPNGで、SNSで共有した時の絵は1200×630のPNGである | `pnpm test`の検査`site-icons-have-the-sizes-the-browsers-read`が通る | #11 |
| 全ての頁は、SNSで共有した時の絵 (`og:image`) を、サイトの基準のURLから始まる絶対のURLで名指す | `pnpm test`の検査`site-pages-name-the-share-image`が通る | #11 |
| 頁はアイコンと共有の絵を、サイトの外のURLから読めない | `pnpm test`の検査`site-pages-name-the-icons`が通る | #11 |
| 全ての頁のヘッダーは、musubiの名前の左にアイコンのロゴを持つ | `pnpm test`の検査`site-header-shows-the-logo`が通る | #11 |
| トップページは、本人が絵を見るstepで選んだ案の節を、その案の順に持つ | `pnpm test`の検査`site-home-follows-the-chosen-design`が通る | #11 |
| 一覧とスキルの頁と定義の頁は、トップページと同じヘッダーとフッターを持ち、同じ`site.css`を読む | `pnpm test`の検査`site-pages-share-one-stylesheet`が通る | #11 |
| 追跡するfileのうち、アカウントの名前を持つのは`LICENSE`と`package.json`と`registry/`と`design/`の下だけで、足したアイコンと共有の絵とほかのfileは持たない | `pnpm test`の検査`account-name-only-in-license-and-package`が通る | #11 |
| npmに出す包みは、アイコンと共有の絵を含め、`site/`の下のfileを持たない | `pnpm test`の検査`packed-files-leave-out-the-site`が通る | #11 |
| `node site/build.ts`は`--base-url`を渡さない時、頁の正規のURLと`sitemap.xml`と共有の絵のURLを`https://musubi.cardene.dev`から始める | `pnpm test`の検査`site-defaults-to-the-public-url`が通る | #13 |
| 組み立ては、基準のURLのホスト名を1行書いた`CNAME`と、空の`.nojekyll`を書き出す | `pnpm test`の検査`site-writes-the-pages-files`が通る | #13 |
| `node site/publish.ts`は、組み立てた頁を`gh-pages`の枝の1つのcommitにして遠隔へ送り、枝が無い時は作る | `pnpm test`の検査`publish-commits-the-site-to-gh-pages`が通る | #13 |
| 2度目の公開は前の公開のcommitの上に足して送り、`gh-pages`の履歴を書き換えない | `pnpm test`の検査`publish-adds-to-gh-pages-without-rewriting-it`が通る | #13 |
| 公開は、手元の作業中のfileと今の枝を変えない | `pnpm test`の検査`publish-leaves-the-working-tree-alone`が通る | #13 |
| 公開は、`main`以外の枝の上と、commitしていない変更が在る時を拒み、`gh-pages`へ何も送らない | `pnpm test`の検査`publish-refuses-unmerged-or-uncommitted-work`が通る | #13 |
| 組み立てが落ちた時、公開は`gh-pages`へ何も送らず、終わり方0以外で終わる | `pnpm test`の検査`publish-refuses-when-the-build-fails`が通る | #13 |
| `docs/publishing.md`と`docs/publishing.ja.md`は、本人が画面で行うDNSのCNAMEと確認のTXTとGitHub Pagesの独自ドメインの設定と、公開の命令`pnpm site:publish`を示し、READMEがその文書へリンクする | `pnpm test`の検査`publishing-doc-shows-the-manual-steps`が通る | #13 |
| 追跡するfileのうち、アカウントの名前を持つのは`LICENSE`と`package.json`と`registry/`と`design/`の下だけである | `pnpm test`の検査`account-name-only-in-license-and-package`が通る | #13 |
| npmに出す包みは、`site/`の下のfileを持たない | `pnpm test`の検査`packed-files-leave-out-the-site`が通る | #13 |

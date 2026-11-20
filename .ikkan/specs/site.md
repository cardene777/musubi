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
| 追跡するfileのうち、アカウントの名前を持つのは`LICENSE`と`package.json`と`registry/`と`design/`の下だけである | `pnpm test`の検査`account-name-only-in-license-and-package`が通る | #13 #20 |
| npmに出す包みは、`site/`の下のfileを持たない | `pnpm test`の検査`packed-files-leave-out-the-site`が通る | #13 |
| 図の箱の中の名前と説明は、箱の左右の中央に置かれる | `pnpm test`の検査`graph-centers-the-text-in-each-box`が通る | #19 |
| 箱から1本だけ出て曲がらずに届く線では、線の上の文字が線の左右の中央に置かれる | `pnpm test`の検査`graph-centers-a-label-over-a-straight-line`が通る | #19 |
| 曲がる線では、線の上の文字が、曲がる前のまっすぐな区間の左右の中央に置かれる | `pnpm test`の検査`graph-centers-labels-on-the-straight-run`が通る | #19 |
| 1つの箱に複数の線が入る時、線が箱に入る位置は上下に分かれ、2本の線が同じ点に入らない | `pnpm test`の検査`graph-spreads-arrows-into-one-box`が通る | #19 |
| 各線は、線をたどって矢印の向きへ動く光の粒と尾を持ち、矢じりは線と同じ太さの「>」の形で、線は出る側の箱の縁の丸から出る | `pnpm test`の検査`graph-edges-carry-the-flowing-light`が通る | #19 |
| 動きを減らす設定では、サイトのスキルのページと`musubi graph`のHTMLは、光の粒と尾と光る矢じりを表示しない | `pnpm test`の検査`graph-hides-the-light-when-motion-is-reduced`が通る | #19 |
| 5つのスキルが1つのスキルに準拠する図と、1つのスキルが2つのスキルに準拠する図で、線の上の文字の枠に、どの線も入らない | `pnpm test`の検査`graph-labels-stay-clear-of-every-line`が通る | #19 |
| 線は出る側の箱から文字の幅より長く真っすぐに出て、曲がり始めるのは文字の右端より先になる | `pnpm test`の検査`graph-edges-run-straight-under-their-labels`が通る | #19 |
| `musubi graph`は、スキルごとの箱と準拠する先への線を書き出す | `pnpm test`の検査`graph-writes-the-skills-and-edges`が通る | #19 |
| スキルのページは、準拠する先と準拠している先を両方挙げ、両方の線を描く | `pnpm test`の検査`site-skill-page-shows-both-directions`が通る | #19 |
| ビルドした全てのページは、スタイルを`/assets/site.css?v=<印>`で読み、印は書き出した`site.css`の中身のSHA-256の先頭12桁と一致する | `pnpm test`の検査`site-pages-link-the-stylesheet-by-content`が通る | #22 |
| 印の無い`/assets/site.css`を読むページを、ビルドは書き出さない | `pnpm test`の検査`site-pages-link-the-stylesheet-by-content`が通る | #22 |
| 全てのページは、サイトの1つのスタイルのファイルだけを読み、ヘッダーとフッターを1つずつ持つ | `pnpm test`の検査`site-pages-share-one-stylesheet`が通る | #22 |
| `pnpm site:publish`は、ビルドしたページを`gh-pages`に1つのコミットで足す | `pnpm test`の検査`publish-commits-the-site-to-gh-pages`が通る | #22 |
| ビルドは`gh`でトピック`musubi-skills`を持つ公開リポジトリを検索し、そのファイルの一覧で`musubi.json`と`SKILL.md`が並ぶフォルダを、一覧とスキルのページに載せる | `pnpm test`の検査`site-lists-skills-found-by-the-topic`が通る | #20 |
| 検索の結果に非公開のリポジトリが混ざった時、そのリポジトリのスキルを載せない | `pnpm test`の検査`site-leaves-out-private-repositories`が通る | #20 |
| 見つけた`musubi.json`の隣に`SKILL.md`が無い時、そのフォルダを載せず、ビルドの出力にリポジトリとフォルダと理由を出す | `pnpm test`の検査`site-names-found-folders-without-skill-md`が通る | #20 |
| `musubi check`の決まりに合わない`musubi.json`を持つスキルは、`registry/`に載ったスキルでも見つけたスキルでも載せず、ビルドの出力にフォルダと行と理由を出す | `pnpm test`の検査`site-leaves-out-declarations-check-refuses`が通る | #20 |
| `registry/excluded.json`が名指したリポジトリかフォルダのスキルは、見つけても`registry/`に載っていても載せない | `pnpm test`の検査`site-leaves-out-excluded-skills`が通る | #20 |
| `registry/`と検索の両方が同じリポジトリを名指した時、そのリポジトリのスキルをどれも1件ずつ載せる | `pnpm test`の検査`site-lists-a-skill-found-twice-once`が通る | #20 |
| リポジトリの直下に`musubi.json`と`SKILL.md`が並ぶ時、そのスキルをリポジトリの名前で載せる | `pnpm test`の検査`site-names-a-root-skill-after-its-repository`が通る | #20 |
| `gh`で検索できない時、ビルドはページを書き出さずに終わり方1で止まり、`gh auth login`を案内する | `pnpm test`の検査`site-stops-when-github-cannot-be-searched`が通る | #20 |
| 英語と日本語のトップページの「スキルを載せる」と、`README.md`と`README.ja.md`は、公開リポジトリにトピック`musubi-skills`を付ければ次の公開で載ると案内する | `pnpm test`の検査`site-tells-authors-to-add-the-topic`が通る | #20 |
| `docs/publishing.md`と`docs/publishing.ja.md`は、公開の前に`gh auth login`でログインしておく手順を示す | `pnpm test`の検査`publishing-doc-says-to-sign-in-to-gh`が通る | #20 |
| `registry/`に載ったスキルは、リポジトリにトピックが無くても一覧に載る | `pnpm test`の検査`site-lists-registered-skills`が通る | #20 |
| `registry/`にも検索の結果にも無いスキルは一覧に載らない | `pnpm test`の検査`site-leaves-out-unregistered-skills`が通る | #20 |
| `musubi.json`を読めない登録は、ビルドの出力に登録のfileとフォルダを名指して外し、残りのページを書き出して終わり方0で終わる | `pnpm test`の検査`site-names-unreadable-entries`が通る | #20 |
| ビルドが落ちた時、公開の命令は`gh-pages`へ送らない | `pnpm test`の検査`publish-refuses-when-the-build-fails`が通る | #20 |
| `README.md`と`README.ja.md`は、サイトを組み立てる命令と、本人のスキルを並べる`registry/<owner>/<repo>.json`を示す | `pnpm test`の検査`readme-shows-how-to-register`が通る | #20 |
| `registry/`の下のfileは、`registry/<持ち主>/<repo>.json`と`registry/excluded.json`だけで、どちらも決まった形を持つ | `pnpm test`の検査`registry-entries-are-well-formed`が通る | #20 |
| 英語の文書と日本語の対の文書は、同じ見出しと表とコードの塊を持つ | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #20 #27 |
| 英語と日本語の一覧とスキルのページと`README.md`と`README.ja.md`は、内容と安全性を確かめていないという注意の文を出さない | `pnpm test`の検査`site-pages-show-no-review-notice`が通る | #27 |
| 日本語の文書は、サイトを持つ人を「運営」と書かない | `pnpm test`の検査`ja-docs-use-the-glossary-terms`が通る | #27 |
| サイトの日本語の文言は、サイトを持つ人を「運営」と書かない | `pnpm test`の検査`site-ja-text-uses-the-glossary-terms`が通る | #27 |
| トップの「スキルを載せる」とREADMEは、トピック`musubi-skills`を付ければ載ると案内する | `pnpm test`の検査`site-tells-authors-to-add-the-topic`が通る | #27 |
| トピック`musubi-skills`を持つ公開リポジトリのスキルは一覧とスキルのページに載る | `pnpm test`の検査`site-lists-skills-found-by-the-topic`が通る | #27 |

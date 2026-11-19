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
| 英語と日本語の文書の形 (見出しと表と囲み) は揃ったままである | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #4 |

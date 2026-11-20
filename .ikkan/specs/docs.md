# docs

| 条件 | 確かめ方 | 出元 |
|---|---|---|
| `README.md`と`README.ja.md`の最初の節より前に、中央寄せのロゴと名前と一言の説明と、npmのバージョンとライセンスとNode.jsのバージョンのバッジと、サイトと定義ともう一方の言語のREADMEへのリンクが並ぶ | `pnpm test`の検査`readme-opens-with-the-logo-badges-and-links`が通る | #25 |
| READMEの頭は`docs/assets/binding.svg`の図を見せ、その図は結び付きを文字でも説明し、動きを減らす設定の時は流れる点を消す | `pnpm test`の検査`readme-shows-the-binding-diagram`が通る | #25 |
| `README.md`と`README.ja.md`は、最後の節でライセンスがMITであることを示し、`LICENSE`へリンクする | `pnpm test`の検査`readme-ends-with-the-license`が通る | #25 |
| READMEはアカウントの名前を持たない | `pnpm test`の検査`account-name-only-in-license-and-package`が通る | #25 |
| READMEは定義へのリンクと`musubi.json`の例を示す | `pnpm test`の検査`readme-links-the-spec-and-shows-the-example`が通る | #25 |
| READMEはnpmで入れる命令を示す | `pnpm test`の検査`readme-shows-the-npm-install`が通る | #25 |
| READMEはサイトを組み立てる命令と`registry/<owner>/<repo>.json`を示す | `pnpm test`の検査`readme-shows-how-to-register`が通る | #25 |
| 英語の文書と日本語の対の文書は、同じ見出しと表とコードの塊を持つ | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #25 |
| 日本語の文書は、用語集が置き換えた語を使わない | `pnpm test`の検査`ja-docs-use-the-glossary-terms`が通る | #25 |

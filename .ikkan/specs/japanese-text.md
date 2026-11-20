# japanese-text

| 条件 | 確かめ方 | 出元 |
|---|---|---|
| 日本語の文書 (`README.ja.md`、`GLOSSARY.ja.md`、`spec/musubi.ja.md`、`docs/`の下の`.ja.md`) の見出しに「、」が無い | `pnpm test`の検査`ja-doc-headings-have-no-comma`が通る | #17 |
| 日本語の文書は、囲みとinline codeの外で、版、出す側、使う側、中身、指紋、頁、写す、検査、命令、組み立て、従うの11語を使わない | `pnpm test`の検査`ja-docs-use-the-glossary-terms`が通る | #17 |
| サイトの日本語の文言は同じ11語を使わず、組み立てた日本語の頁の見出しに「、」が無い | `pnpm test`の検査`site-ja-text-uses-the-glossary-terms`が通る | #17 |
| 日本語の用語集は、provider、consumer、コンテンツ、フィンガープリント、チェック、バージョンの範囲、定義のバージョンを語の列に持つ | `pnpm test`の検査`glossary-names-the-chosen-terms`が通る | #17 |
| 日本語の定義の文書は、providerの宣言、consumerの宣言、見つけ方と読み込み方、バージョンとフィンガープリント、再チェック、既存の仕組みとの関係、チェックのルールの節を持つ | `pnpm test`の検査`spec-has-the-six-sections`と`spec-lists-the-rule-kinds`が通る | #17 |
| 英語と日本語の文書の形 (見出しと表と囲み) は揃ったままである | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #17 |
| 定義のページは、英語と日本語の文書の見出しを全て持つ | `pnpm test`の検査`site-renders-the-spec-in-both-languages`が通る | #17 |
| READMEは、`registry/`へPRを送って一覧に載せる手順と、サイトをビルドするコマンドを示す | `pnpm test`の検査`readme-shows-how-to-register`が通る | #17 |

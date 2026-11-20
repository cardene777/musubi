# 置き場と命名

| 置き場 | 持つ物 | 根拠 |
|---|---|---|
| `README.md`、`README.ja.md` | musubiが何かの説明 (英語と日本語) | `README.md` |
| `AGENTS.md`、`CLAUDE.md` | 人とエージェントが従う決まり | `AGENTS.md` |
| `spec/` | 定義の文書 (英語が正、日本語が訳) | `spec/musubi.md` |
| `schema/<日付>/` | 定義の版ごとの`musubi.json`と検査のfileのJSON Schema。命令が読む定義の版はこのフォルダの名前だけが持つ | `src/definition.ts` |
| `src/` | `musubi`の命令 (`check`、`add`、`graph`) | `package.json` |
| `tests/` | `node --test`のテスト | `package.json` |
| `examples/skills/` | 出す側1つと使う側1つの例のスキル。サイトのトップページの仕組みの節は、この2つの宣言と、組み立ての時に写しで回した`musubi check`の出力を載せる | `spec/musubi.md`、`site/build.ts` |
| `registry/<持ち主>/<repo>.json` | サイトに見せる運営のスキルのフォルダを、repoごとに1つのfileで並べた登録。ほかのスキルはトピック`musubi-skills`の検索で見つける | `docs/adr/0006-site-finds-skills-by-topic.md` |
| `registry/excluded.json` | サイトに載せないrepoとフォルダの一覧 | `docs/adr/0006-site-finds-skills-by-topic.md` |
| `site/` | サイトを組み立てる`build.ts`と、手元で配る`serve.ts`と、GitHub Pagesの`gh-pages`の枝へ公開する`publish.ts`。頁は`site/dist/`へ書き、npmへは出さない。`site/assets/`のタブのアイコンとホーム画面のアイコンと共有の絵は、組み立てが`site/dist/assets/`へ写す | `package.json` |
| `design/` | Pencilで描いたサイトの画面 (`site.pen`) と、`site/assets/`の絵の元 (共有の絵の`og.html`、ホーム画面のアイコンの`apple-touch-icon.svg`) | `AGENTS.md` |
| `GLOSSARY.md`、`GLOSSARY.ja.md` | 定義が使う語 | `GLOSSARY.md` |
| `docs/adr/` | 戻すのが高くつく判断の記録 | `docs/adr/` |
| `docs/publishing.md` | サイトを`musubi.cardene.dev`へ公開する命令と、持ち主が画面で1度だけ行う設定 | `site/publish.ts` |
| `.ikkan/` | ikkanの記録。配らない | `AGENTS.md` |

文書は英語の `<name>.md` と日本語の `<name>.ja.md` を対で置く (`AGENTS.md`)。

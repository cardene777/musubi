# 置き場と命名

| 置き場 | 持つ物 | 根拠 |
|---|---|---|
| `README.md`、`README.ja.md` | musubiが何かの説明 (英語と日本語) | `README.md` |
| `AGENTS.md`、`CLAUDE.md` | 人とエージェントが従う決まり | `AGENTS.md` |
| `spec/` | 定義の文書 (英語が正、日本語が訳) | `spec/musubi.md` |
| `schema/<日付>/` | 定義の版ごとの`musubi.json`と検査のfileのJSON Schema。命令が読む定義の版はこのフォルダの名前だけが持つ | `src/definition.ts` |
| `src/` | `musubi`の命令 (`check`、`add`、`graph`) | `package.json` |
| `tests/` | `node --test`のテスト | `package.json` |
| `examples/skills/` | 出す側1つと使う側1つの例のスキル | `spec/musubi.md` |
| `registry/<持ち主>/<repo>.json` | サイトに見せるスキルのフォルダを、repoごとに1つのfileで並べた登録 | `docs/adr/0005-registry-lists-skill-folders.md` |
| `site/` | サイトを組み立てる`build.ts`と、手元で配る`serve.ts`。頁は`site/dist/`へ書き、npmへは出さない | `package.json` |
| `design/site.pen` | Pencilで描いたサイトの画面 | `AGENTS.md` |
| `GLOSSARY.md`、`GLOSSARY.ja.md` | 定義が使う語 | `GLOSSARY.md` |
| `docs/adr/` | 戻すのが高くつく判断の記録 | `docs/adr/` |
| `.ikkan/` | ikkanの記録。配らない | `AGENTS.md` |

文書は英語の `<name>.md` と日本語の `<name>.ja.md` を対で置く (`AGENTS.md`)。

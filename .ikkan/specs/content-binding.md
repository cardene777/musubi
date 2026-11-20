# content-binding

| 条件 | 確かめ方 | 出元 |
|---|---|---|
| `spec/musubi.md`と`spec/musubi.ja.md`を開いた時、providerの宣言、consumerの宣言、見つけ方と読み込み方、バージョンとフィンガープリント、再チェック、既存の仕組みとの関係の6つの節が在る | `node --test tests/docs.test.ts`の検査`spec-has-the-six-sections`が通る | #3 |
| 定義の文書を開いた時、検査に書ける決まりの種類 (要る見出しとその順、残してはいけない文字、表の要る列) を書いた節が在る | `node --test tests/docs.test.ts`の検査`spec-lists-the-rule-kinds`が通る | #3 |
| 常に、英語の文書と日本語の対`<name>.ja.md`は同じ数の見出しと表と例を持つ | `node --test tests/docs.test.ts`の検査`doc-pairs-have-the-same-shape`が通る | #3 |
| `README.md`と`README.ja.md`を開いた時、定義の文書へのリンクと、出す側と使う側の`musubi.json`の例が在る | `node --test tests/docs.test.ts`の検査`readme-links-the-spec-and-shows-the-example`が通る | #3 |
| `schema/2026-11-19/musubi.schema.json`で確かめた時、例の2つの`musubi.json`が通る | `node --test tests/schema.test.ts`の検査`schema-accepts-the-examples`が通る | #3 |
| 同じスキーマで確かめた時、版がsemverでない宣言を拒む | `node --test tests/schema.test.ts`の検査`schema-rejects-a-bad-version`が通る | #3 |
| 同じスキーマで確かめた時、知らない欄を持つ宣言を拒む | `node --test tests/schema.test.ts`の検査`schema-rejects-an-unknown-field`が通る | #3 |
| `musubi check examples/skills`を回した時、出す側1つと使う側1つの例を通して終了0を返す | `node --test tests/check.test.ts`の検査`check-passes-the-examples`が通る | #3 |
| 置き場の引数が無い時、`musubi check`は`.claude/skills`、`.agents/skills`、`.github/skills`、`.gemini/skills`と、homeの同じフォルダを入っているスキルとして読む | `node --test tests/check.test.ts`の検査`check-reads-the-default-skill-folders`が通る | #3 |
| 使う側が無い中身の名前を指す時、`musubi check`は`musubi.json`のfileと行を名指して拒む | `node --test tests/check.test.ts`の検査`check-refuses-an-unknown-content-name`が通る | #3 |
| 宣言の版か範囲の形が違う時、`musubi check`はfileと行を名指して拒む | `node --test tests/check.test.ts`の検査`check-refuses-a-malformed-version`が通る | #3 |
| 知らない日付の定義の版を持つ`musubi.json`を、`musubi check`はfileと行を名指して拒む | `node --test tests/check.test.ts`の検査`check-refuses-an-unknown-definition-version`が通る | #3 |
| `musubi check`は`^`の範囲、`~`の範囲、そのままの版を読める | `node --test tests/check.test.ts`の検査`range-reads-caret-tilde-and-exact`が通る | #3 |
| 出す側の版が使う側の範囲の外の時、`musubi check`は使う側を名指して拒む | `node --test tests/check.test.ts`の検査`check-refuses-a-version-outside-the-range`が通る | #3 |
| 中身のfileか検査が変わって指紋が合わない時、`musubi check`は使う側を名指して拒む | `node --test tests/check.test.ts`の検査`check-refuses-a-changed-fingerprint`が通る | #3 |
| 出す側の`SKILL.md`だけが変わった時も、`musubi check`は指紋が合わないとして拒む | `node --test tests/check.test.ts`の検査`check-refuses-a-changed-provider-skill-md`が通る | #3 |
| 指紋が合わない時、`musubi check`はその出す側の検査を使う側の例に回せない | `node --test tests/check.test.ts`の検査`check-skips-rules-when-the-fingerprint-differs`が通る | #3 |
| 使う側の例に要る見出しが無いか順が違う時、`musubi check`は例のfileと行を名指して拒む | `node --test tests/check.test.ts`の検査`rule-refuses-a-missing-or-misordered-heading`が通る | #3 |
| 使う側の例に残してはいけない文字が在る時、`musubi check`は例のfileと行を名指して拒む | `node --test tests/check.test.ts`の検査`rule-refuses-forbidden-text`が通る | #3 |
| 使う側の例の表に要る列が無い時、`musubi check`は例のfileと行を名指して拒む | `node --test tests/check.test.ts`の検査`rule-refuses-a-missing-table-column`が通る | #3 |
| 使う側が出す側の書式に節を足した時、`musubi check`は足した節を読み飛ばして通す | `node --test tests/check.test.ts`の検査`rule-allows-added-sections`が通る | #3 |
| 出す側の検査がJSONの決まりでない時 (scriptなど)、`musubi check`はそれを走らせずに拒む | `node --test tests/check.test.ts`の検査`check-refuses-a-script-check`が通る | #3 |
| 従い方が輪になった時、`musubi check`は輪の道筋を名指して拒む | `node --test tests/check.test.ts`の検査`check-refuses-a-cycle`が通る | #3 |
| 中身が2段以上の従い方をする時、`musubi check`は通す | `node --test tests/check.test.ts`の検査`check-passes-a-two-level-chain`が通る | #3 |
| 従う出す側のスキルが入っていない時、`musubi check`は足りないスキルの名前を出して拒む | `node --test tests/check.test.ts`の検査`check-refuses-a-missing-provider`が通る | #3 |
| 従う中身が500行を超える時、`musubi check`は行数を知らせて終了0を返す | `node --test tests/check.test.ts`の検査`check-warns-over-500-lines`が通る | #3 |
| `musubi check`を回した時、`musubi.json`を書き換えない | `node --test tests/check.test.ts`の検査`check-does-not-write`が通る | #3 |
| `musubi check --update`を回して通った時、使う側の指紋を今の中身の指紋に書き換える | `node --test tests/check.test.ts`の検査`update-rewrites-the-fingerprint-after-a-pass`が通る | #3 |
| `musubi check --update`を回して落ちた時、指紋を書き換えない | `node --test tests/check.test.ts`の検査`update-keeps-the-fingerprint-on-a-failure`が通る | #3 |
| 使う側のフォルダで`musubi add design-doc/design`を回した時、`musubi.json`に今の版から作った`^`の範囲と指紋を書く | `node --test tests/add.test.ts`の検査`add-writes-the-range-and-fingerprint`が通る | #3 |
| `musubi add`を回した時、本文に置く3行 (従う中身、読む前に照らす、出す側が無い時は止める) を出す | `node --test tests/add.test.ts`の検査`add-prints-the-body-lines`が通る | #3 |
| 無い中身を`musubi add`した時、拒んで`musubi.json`を書かない | `node --test tests/add.test.ts`の検査`add-refuses-an-unknown-content`が通る | #3 |
| `musubi graph examples/skills --out <file>`を回した時、スキルと従う中身を線で結んだHTMLを書く | `node --test tests/graph.test.ts`の検査`graph-writes-the-skills-and-edges`が通る | #3 |
| `package.json`は実行時の依存を持たず、`bin`に`musubi`を持ち、MITの`LICENSE`が在る | `node --test tests/package.test.ts`の検査`package-has-no-runtime-dependencies`が通る | #3 |
| 定義の版の日付は`schema/`の下のフォルダ名だけが持ち、`src/`には書かない | `node --test tests/package.test.ts`の検査`definition-versions-come-from-schema-folders`が通る | #3 |
| 組み立てた`dist/cli.js`を`node`で回した時、`musubi check examples/skills`と同じ結果を返す | `node --test tests/package.test.ts`の検査`build-runs-from-dist`が通る | #3 |
| 例の`SKILL.md`は頭に`name`と`description`だけを持つ | `node --test tests/examples.test.ts`の検査`examples-keep-the-agent-skills-frontmatter`が通る | #3 |
| 例の`musubi.json`は`$schema`でスキーマを指す | `node --test tests/examples.test.ts`の検査`examples-point-at-the-schema`が通る | #3 |
| 使う側の例の本文は、従う中身、読む前に照らす、出す側が無い時は止めるの3行を持つ | `node --test tests/examples.test.ts`の検査`examples-consumer-body-has-the-three-lines`が通る | #3 |
| 中身のfileの拡張子が`.py`、`.sh`、`.bash`、`.js`、`.mjs`、`.cjs`、`.ts`の時、大文字と小文字を問わず、`musubi add`は1行目に「Run the `<content>` of the `<skill>` skill: open the `<skill>` skill by name and run the file it names for `<content>`.」を出す | `pnpm test`の検査`add-prints-the-run-line-for-a-script`が通る | #6 |
| 命令のfileの中身に`musubi add`が出す行は、`format`の語と`read the file`の語を持たない | `pnpm test`の検査`add-does-not-call-a-script-a-format`が通る | #6 |
| 中身のfileが`.md`の時、`musubi add`が出す3行は今と一字も変わらない | `pnpm test`の検査`add-keeps-the-format-lines`と`add-prints-the-body-lines`が通る | #6 |
| 中身のfileが`.json`、`.txt`、拡張子の無いfileの時も、`musubi add`は今の書式の行を出す | `pnpm test`の検査`add-prints-the-format-line-for-other-files`が通る | #6 |
| `spec/musubi.md`と`spec/musubi.ja.md`は、命令のfileの中身に出す1行目を、`musubi add`が出す文と同じ文で示す | `pnpm test`の検査`spec-shows-the-run-line-for-a-script`が通る | #6 |
| 2つの仕様のページの形 (見出しと表と囲み) は、英語と日本語で揃ったままである | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #6 |
| 定義のバージョン`2026-11-20`の`musubi.json`で、任意の準拠の提供する側のスキルが入っていない時、`musubi check`は終わり方0で終わり、飛ばした準拠を警告に名指す | `pnpm test`の検査`check-skips-an-optional-follow-whose-provider-is-missing`が通る | #29 |
| 任意の準拠の提供する側のスキルが入っている時、`musubi check`はフィンガープリントの違いを今どおり問題として拒む | `pnpm test`の検査`check-checks-an-optional-follow-whose-provider-is-installed`が通る | #29 |
| 定義のバージョン`2026-11-19`の`musubi.json`が`optional`を書いた時と、`optional`が真偽値でない時、`musubi check`は行を名指して拒む | `pnpm test`の検査`check-refuses-optional-it-cannot-read`が通る | #29 |
| `musubi add <skill>/<content> --optional`は、`optional: true`と`"musubi": "2026-11-20"`を書き、入っている時だけ読み、入っていない時はそのコンテンツ無しで続ける`SKILL.md`の3行を出す | `pnpm test`の検査`add-writes-an-optional-follow`が通る | #29 |
| `schema/2026-11-20/musubi.schema.json`は任意の準拠を受け付け、`schema/2026-11-19/musubi.schema.json`は拒む | `pnpm test`の検査`schema-accepts-an-optional-follow`が通る | #29 |
| 定義の英語版と日本語版は、定義のバージョン`2026-11-20`と、`optional`の項目と、任意の準拠の`SKILL.md`の3行を示し、用語集は任意の準拠を説明する | `pnpm test`の検査`spec-describes-the-optional-follow`が通る | #29 |
| サイトの一覧とスキルのページは、任意の準拠に英語で`optional`、日本語で「任意」の印を付ける | `pnpm test`の検査`site-marks-optional-follows`が通る | #29 |
| `optional`を書かない準拠で提供する側のスキルが入っていない時、`musubi check`は今どおり拒む | `pnpm test`の検査`check-refuses-a-missing-provider`が通る | #29 |
| `musubi add`は、新しい`musubi.json`に最新の定義のバージョンと範囲とフィンガープリントを書く | `pnpm test`の検査`add-writes-the-range-and-fingerprint`が通る | #29 |
| `musubi add`は、`optional`を付けない時、今の3行を出す | `pnpm test`の検査`add-prints-the-body-lines`が通る | #29 |
| 定義のバージョン`2026-11-19`の例のスキルは、今どおり`musubi check`を通る | `pnpm test`の検査`check-passes-the-examples`が通る | #29 |
| 知らない定義のバージョンを書いた`musubi.json`を、`musubi check`は今どおり拒む | `pnpm test`の検査`check-refuses-an-unknown-definition-version`が通る | #29 |
| 英語の文書と日本語の対の文書は、同じ見出しと表とコードの塊を持つ | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #29 |

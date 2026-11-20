# install

| 条件 | 確かめ方 | 出元 |
|---|---|---|
| インストール元のフォルダを`--from`で渡して`musubi install <consumer> --to <フォルダ>`を打った時、consumerと必須の準拠のproviderのスキルのフォルダを入れる先へコピーし、終わり方0を返す | `pnpm test`の検査`install-copies-the-skill-and-its-required-provider`が通る | #38 |
| 準拠が`alpha -> beta -> gamma`と連なる時、`musubi install alpha`は3つのスキルを全てインストールする | `pnpm test`の検査`install-follows-the-chain`が通る | #38 |
| 任意の準拠のproviderを`--with`でも`--lang`でも選ばない時、`musubi install`はそのproviderをインストールせず、入れなかったスキル名と`--with`の入れ方を出力に示す | `pnpm test`の検査`install-leaves-out-an-optional-follow`が通る | #38 |
| `--with <provider>`を渡した時、`musubi install`は任意の準拠のproviderをインストールする | `pnpm test`の検査`install-adds-an-optional-follow-the-user-names`が通る | #38 |
| 任意の準拠が`"when": { "languages": ["ja"] }`を持つ時、`musubi install --lang ja-JP`はそのproviderをインストールする | `pnpm test`の検査`install-adds-an-optional-follow-whose-language-matches`が通る | #38 |
| 任意の準拠が`"when": { "languages": ["ja"] }`を持つ時、`musubi install --lang en`はそのproviderをインストールできない | `pnpm test`の検査`install-leaves-out-an-optional-follow-of-another-language`が通る | #38 |
| 必須の準拠のproviderがどのインストール元にも無い時、`musubi install`はそのスキル名を名指して終わり方1で拒み、どのスキルもコピーしない | `pnpm test`の検査`install-refuses-a-missing-required-provider`が通る | #38 |
| インストール元のproviderのバージョンがconsumerの範囲の外にある時、`musubi install`は終わり方1で拒み、どのスキルもコピーしない | `pnpm test`の検査`install-refuses-a-provider-outside-the-range`が通る | #38 |
| 入れる先に同じ名前のスキルが既に在る時、`musubi install`はそのスキルを上書きできない | `pnpm test`の検査`install-keeps-an-installed-skill`が通る | #38 |
| `--from`にgitのリポジトリのURLを渡した時、`musubi install`はリポジトリを一時フォルダへcloneしてスキルをインストールし、終えた後に一時フォルダを消す | `pnpm test`の検査`install-reads-a-git-repository`が通る | #38 |
| `--to`が無い時、`musubi install`はカレントフォルダの`.claude/skills`、`.agents/skills`、`.github/skills`、`.gemini/skills`のうち最初に在るフォルダへインストールする | `pnpm test`の検査`install-picks-the-first-existing-skills-folder`が通る | #38 |
| `--to`が無く、カレントフォルダに4つのスキルのフォルダがどれも無い時、`musubi install`は終わり方2で拒む | `pnpm test`の検査`install-refuses-without-a-skills-folder`が通る | #38 |
| `--from`が無い時、`musubi install`は終わり方2で拒む | `pnpm test`の検査`install-refuses-without-a-source`が通る | #38 |
| 1つのインストール元に同じ名前のスキルのフォルダが2つ在る時、`musubi install`は2つのパスを名指して終わり方1で拒む | `pnpm test`の検査`install-refuses-an-ambiguous-skill-name`が通る | #38 |
| インストールした後、`musubi install`は入れる先と既定のフォルダに`musubi check`を回し、フィンガープリントが合わない時は終わり方1を返す | `pnpm test`の検査`install-checks-after-installing`が通る | #38 |
| 定義のバージョン`2026-11-21`の`musubi.json`が任意の準拠に`when.languages`を書いた時、`musubi check`は終わり方0を返す | `pnpm test`の検査`check-accepts-the-languages-of-an-optional-follow`が通る | #38 |
| `2026-11-20`の`musubi.json`が`when`を書いた時と、`optional: true`の無い準拠が`when`を書いた時と、`languages`が言語タグの一覧でない時、`musubi check`は行を名指して拒む | `pnpm test`の検査`check-refuses-when-it-cannot-read`が通る | #38 |
| `musubi add <参照> --optional --lang ja`は`"when": { "languages": ["ja"] }`と`"musubi": "2026-11-21"`を書く | `pnpm test`の検査`add-writes-the-languages-of-an-optional-follow`が通る | #38 |
| `--optional`の無い`musubi add <参照> --lang ja`を、`musubi add`は終わり方2で拒む | `pnpm test`の検査`add-refuses-languages-without-optional`が通る | #38 |
| `schema/2026-11-21/musubi.schema.json`は任意の準拠の`when`を受け付ける | `pnpm test`の検査`schema-accepts-the-languages-of-an-optional-follow`が通る | #38 |
| `schema/2026-11-21/musubi.schema.json`は`optional: true`の無い`when`を拒み、`schema/2026-11-20/musubi.schema.json`は`when`を拒む | `pnpm test`の検査`schema-refuses-when-it-cannot-read`が通る | #38 |
| 定義の英語と日本語は、定義のバージョン`2026-11-21`と、`when`の項目と、インストールの節と、`musubi install`の行を示し、用語集は条件とインストール元を説明する | `pnpm test`の検査`spec-describes-installing`が通る | #38 |
| `README.md`と`README.ja.md`は、`musubi install`を打つコマンドの例を示す | `pnpm test`の検査`readme-shows-musubi-install`が通る | #38 |
| 定義のバージョン`2026-11-19`の`musubi.json`に`musubi add --optional`を打った時、今どおり`"musubi": "2026-11-20"`を書く | `pnpm test`の検査`add-writes-an-optional-follow`が通る | #38 |
| 定義の英語と日本語は、今どおり定義のバージョン`2026-11-20`で`optional`を加えたことと、任意の準拠の`SKILL.md`の3行を示す | `pnpm test`の検査`spec-describes-the-optional-follow`が通る | #38 |
| `musubi check examples/skills`は今どおり終わり方0を返す | `pnpm test`の検査`check-passes-the-examples`が通る | #38 |
| コマンドは今どおり実行時の依存を持たない | `pnpm test`の検査`package-has-no-runtime-dependencies`が通る | #38 |
| 英語の文書と日本語の対は、今どおり同じ数の見出しと表と例を持つ | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #38 |
| 日本語の文書は、今どおり用語集が置き換えた語を使わない | `pnpm test`の検査`ja-docs-use-the-glossary-terms`が通る | #38 |
| アカウントの名前は、今どおり`LICENSE`と`package.json`と`registry/`と`design/`の下にだけ現れる | `pnpm test`の検査`account-name-only-in-license-and-package`が通る | #38 |

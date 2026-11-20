# musubiの定義

定義のバージョンは`2026-11-21`。

musubiは、文書の書式や書き方のルールのように、エージェントのスキルが提供するコンテンツと、そのコンテンツに準拠するスキルを結び付ける。
あるスキルがコンテンツを名前とバージョン付きで宣言し、別のスキルがそのコンテンツに準拠すると宣言する。
`SKILL.md`を読むエージェントはどれも同じ方法でコンテンツを読み込み、コンテンツが変わると、準拠するスキルが再チェックされる。
正式な定義は英語の[musubi.md](musubi.md)で、この文書はその日本語訳である。

## 概要

musubiに参加するスキルは、Agent Skillsが定める`SKILL.md`をそのまま持ち、その隣に`musubi.json`というファイルを1つ追加する。

| ファイル | 書く人 | 持つもの |
|---|---|---|
| `SKILL.md` | スキルの作者 | Agent Skillsのフロントマターと本文で、変更しない。本文がエージェントに、どのコンテンツを読むかを伝える |
| `musubi.json` | 作者か`musubi add` | スキルが提供するコンテンツと、準拠するコンテンツ |
| コンテンツのファイル | provider | 書式や書き方のルールなど、consumerが準拠する文書 |
| チェックのファイル | provider | `musubi check`がconsumerの例に適用する、JSONのルール |

```text
skills/
├── design-doc/              providerのスキル
│   ├── SKILL.md             提供するコンテンツごとにファイルを指定する
│   ├── musubi.json          "provides": design 1.0.0
│   ├── formats/design.md    コンテンツ
│   └── checks/design.json   チェックのルール
└── api-design/              consumerのスキル
    ├── SKILL.md             design-doc/design を指す3行
    ├── musubi.json          "follows": design-doc/design ^1.0.0 とフィンガープリント
    └── examples/orders-api.md   チェックを適用する例
```

ここで使う用語は[GLOSSARY.ja.md](../GLOSSARY.ja.md)で定義する。

## providerの宣言

providerのスキルは、提供するコンテンツを`musubi.json`の`provides`に並べる。

```json
{
  "$schema": "../../../schema/2026-11-19/musubi.schema.json",
  "musubi": "2026-11-19",
  "provides": {
    "design": { "version": "1.0.0", "file": "formats/design.md", "check": "checks/design.json" }
  }
}
```

| フィールド | 必須 | 意味 |
|---|---|---|
| `$schema` | いいえ | エディタがJSON Schemaを見つける場所。`schema/<日付>/musubi.schema.json`を指す |
| `musubi` | はい | このファイルが準拠する定義のバージョン |
| `provides.<名前>` | コンテンツごとに1つ | コンテンツの名前。小文字の単語を`-`でつなぐ |
| `provides.<名前>.version` | はい | コンテンツのバージョン。`MAJOR.MINOR.PATCH`の形で書く |
| `provides.<名前>.file` | はい | コンテンツのファイル。スキルのフォルダからの相対パスで書く |
| `provides.<名前>.check` | いいえ | JSONのルールのファイル。スキルのフォルダからの相対パスで書き、形はチェックのルールの節で定める |

コンテンツは1つのファイルと、最大1つのチェックからなり、`design-doc/design`のように`<スキル名>/<名前>`で呼ぶ。
コンテンツごとにバージョンを持つので、1つを変えても、ほかのコンテンツのバージョンは変わらない。
パスはスキルのフォルダの中に限り、`musubi check`は絶対パスとフォルダの外へ出るパスを拒否する。
エージェントはproviderの`SKILL.md`の本文を読んでファイルを見つけるので、providerの本文はコンテンツごとにファイルを指定する (判断の記録[0002](../docs/adr/0002-agents-open-the-provider-by-name.ja.md))。

宣言をフロントマターの項目でなく別の`musubi.json`に書くのは、`SKILL.md`がAgent Skillsのチェックを通り続けるようにするためである (判断の記録[0001](../docs/adr/0001-declarations-in-musubi-json.ja.md))。

## consumerの宣言

consumerのスキルは、準拠するコンテンツを`musubi.json`の`follows`に並べる。

```json
{
  "musubi": "2026-11-19",
  "follows": {
    "design-doc/design": {
      "version": "^1.0.0",
      "integrity": "sha256-yNSwpBT+xXEV5bGBqedpHmjWIHVi+JaAnRATAJ0s7wM=",
      "examples": ["examples/orders-api.md"]
    }
  }
}
```

| フィールド | 必須 | 意味 |
|---|---|---|
| `follows.<スキル名>/<名前>` | コンテンツごとに1つ | 準拠するコンテンツ |
| `follows.<参照>.version` | はい | consumerが受け入れるバージョン。形はバージョンとフィンガープリントの節で定める |
| `follows.<参照>.integrity` | はい | 最後にチェックした時のコンテンツのフィンガープリント |
| `follows.<参照>.examples` | いいえ | providerのチェックを適用する、consumerのファイル |
| `follows.<参照>.optional` | いいえ | providerが無くてもconsumerが動く時に`true`を書く。下で定める |
| `follows.<参照>.when` | いいえ | `optional: true`の時だけ書ける。利用者が名指さなくてもインストーラーがproviderをインストールする言語を書く。下とインストールの節で定める |

consumerの`SKILL.md`の本文には、準拠するコンテンツごとに次の3行を書く。
この3行は`musubi add`が出力する。

```text
Write in the `design` format of the `design-doc` skill: open the `design-doc` skill by name and read the file it names for `design`.
If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.
If the `design-doc` skill is not installed, do not start: tell the user that `design-doc` is missing and how to install it, then stop.
```

コンテンツのファイルがスクリプトの時は、1行目が、書式として読む代わりに実行するようエージェントに伝える。
スクリプトかどうかは拡張子`.py`、`.sh`、`.bash`、`.js`、`.mjs`、`.cjs`、`.ts`で判定し、大文字と小文字は区別しない。

```text
Run the `verify` of the `design-doc` skill: open the `design-doc` skill by name and run the file it names for `verify`.
```

providerのスキルがインストールされていなくても動くconsumerは、その準拠に`optional: true`を書く。
この準拠を任意の準拠と呼ぶ (判断の記録[0007](../docs/adr/0007-optional-follows.ja.md))。
任意の準拠では、`musubi add --optional`が代わりに次の3行を出力する。

```text
When the `design-doc` skill is installed, write in the `design` format of the `design-doc` skill: open the `design-doc` skill by name and read the file it names for `design`.
If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.
If the `design-doc` skill is not installed, go on without the `design` of `design-doc`.
```

任意の準拠は、consumerと一緒にproviderをインストールする言語を`when`に書いてもよい。
たとえば、日本語で書く利用者にだけ書き方のルールをインストールする時に使う (判断の記録[0009](../docs/adr/0009-optional-follows-name-their-languages.ja.md))。
`languages`には言語タグを並べ、`musubi add --optional --lang ja`がこれを書く。

```json
{
  "musubi": "2026-11-21",
  "follows": {
    "japanese-writing/rules": {
      "version": "^1.0.0",
      "integrity": "sha256-yNSwpBT+xXEV5bGBqedpHmjWIHVi+JaAnRATAJ0s7wM=",
      "optional": true,
      "when": { "languages": ["ja"] }
    }
  }
}
```

consumerは、準拠するコンテンツに自分の節を追加できる。
ただし、providerのチェックが求めるものを削除したり、名前を変えたりはできない。
1つのスキルが、コンテンツを提供しながら別のコンテンツに準拠してもよい。
たとえば、providerの書式が、共通の書き方のルールに準拠することがある。

## 見つけ方と読み込み方

エージェントは`SKILL.md`の本文を読んでコンテンツを読み込み、スキルを使っている間に`musubi.json`を読むことはない。
そのため、musubiを知らないエージェントも、`musubi`コマンドを使えるエージェントと同じ方法でコンテンツを読み込む。

1. エージェントは、ほかのスキルと同じように、consumerの`SKILL.md`を読む。
2. 本文は、providerのスキルとコンテンツを名前で示す。エージェントはインストール済みのスキルからproviderのスキルを名前で開き、providerの本文がそのコンテンツについて指定するファイルを読む。
3. エージェントはそのファイルだけを全文読む。providerのほかのコンテンツは読まない。
4. providerのスキルがインストールされていない時、エージェントは作業を始めない。足りないスキルとそのインストール方法をユーザーに伝えて止まる。任意の準拠の時は止まらず、そのコンテンツ無しで作業を続ける。

Claude Code、Codex、GitHub Copilot CLI、Gemini CLIはどれもインストール済みのスキルを名前で一覧にするので、スキルがどこにインストールされていても名前で開ける。
別々のプラグインからインストールした2つのスキルは同じ場所に並ぶとは限らないので、スキルのフォルダどうしの相対パスは使わない。

`musubi check`と`musubi graph`は、コマンドラインで指定したフォルダからスキルを読む。
フォルダを指定しない時は、カレントフォルダとホームフォルダにある`.claude/skills`、`.agents/skills`、`.github/skills`、`.gemini/skills`を読む。
そのいずれかの直下にあり、`SKILL.md`を持つフォルダがスキルで、スキルの名前はフォルダの名前である。
同じ名前のスキルが2つのフォルダにある時は、上の順で先のフォルダのスキルを使い、`musubi check`がもう一方について警告する。

エージェントはコンテンツのファイルを全文読むので、`musubi check`は500行を超えるコンテンツを警告する。
500行は、Agent Skillsが`SKILL.md`に勧める長さである。
そのようなコンテンツも拒否はしない。
長いコンテンツは、providerが複数のコンテンツに分ける。

## インストール

スキルをインストールする時は、そのスキルが準拠するスキルもインストールする。
そうすれば、Claude Codeのプラグインの`dependencies`のようなフィールドを持たないエージェントでも、consumerはproviderを見つけられる (判断の記録[0008](../docs/adr/0008-install-follows-from-named-sources.ja.md))。
`musubi install`もほかのインストーラーも、consumerの`musubi.json`を読み、次の同じ決まりでインストールするスキルを決める。

1. 必須の準拠のproviderは全てインストールする。
2. 任意の準拠のproviderは、利用者がそのproviderを名指した時か、利用者が渡した言語の主な言語が準拠の`when.languages`のタグと同じ時だけインストールする。たとえば`ja-JP`は`ja`に合う。
3. インストールしたスキルごとに同じことを繰り返し、準拠の連鎖の最後まで辿る。
4. インストール済みのスキルはそのまま残し、そのスキルの準拠は辿る。
5. 必須の準拠のproviderがどのインストール元にも無い時と、その名前のコンテンツを提供しない時と、consumerの範囲の外のバージョンを提供する時は、何もインストールせず、その準拠を示す。
6. インストールした後に、再チェックの節のとおり`musubi check`を実行する。

`musubi.json`には、スキルのインストール元を書かない。
インストール元は利用者が名指し、インストーラーはその中から名前でスキルを探す。
エージェントがproviderを名前で開くのと同じ方法である。

`musubi install`は、インストール元を`--from`で受け取る。
インストール元はフォルダか、gitのリポジトリのURLである。
URLの時は`git clone --depth 1`で一時フォルダへクローンし、終わった後に消す。
インストール元の中で`SKILL.md`を持つフォルダは、`.git`と`node_modules`の中を除き、どの深さにあってもスキルで、スキルの名前はフォルダの名前である。
同じスキルを持つインストール元が複数ある時は、先に名指したインストール元を使う。
同じ名前のスキルを2つ持つインストール元は拒否する。
スキルのフォルダは丸ごと`--to`で指定したフォルダへコピーする。
`--to`が無い時は、カレントフォルダの`.claude/skills`、`.agents/skills`、`.github/skills`、`.gemini/skills`のうち、最初にあるフォルダへコピーする。
`musubi check`が見つけるスキルは、インストール済みとして扱う。
つまり、コピー先のフォルダと、引数の無い`musubi check`が読むフォルダにあるスキルである。

```bash
musubi install api-design --from ../skills --to .claude/skills
musubi install convey --from https://github.com/example/skills --lang ja --with design-doc
```

| オプション | 意味 |
|---|---|
| `--from <フォルダかgitのURL>` | インストール元。複数指定すると、指定した順に探す |
| `--to <スキルのフォルダ>` | インストールするフォルダ |
| `--with <スキル名>` | 任意の準拠のproviderを名前で指定してインストールする。複数指定できる |
| `--lang <言語タグ>` | 利用者が書く言語。`when.languages`と照らし合わせる。複数指定できる |

`musubi install`の終了コードは、全てをインストールして`musubi check`が通った時は`0`、問題があって何もインストールしなかった時か`musubi check`が問題を見つけた時は`1`、コマンドの呼び出し方が間違っている時は`2`である。

## バージョンとフィンガープリント

コンテンツのバージョンは`MAJOR.MINOR.PATCH`の形で書く。

| コンテンツかチェックの変更 | 上げる番号 |
|---|---|
| consumerがチェックを通らなくなりうる変更。必須の節や列を削除するか名前を変える、チェックを厳しくする | `MAJOR` |
| consumerが使えるものを追加する変更。任意の節を追加するなど | `MINOR` |
| 全てのconsumerが通ったままになる、言い回しの変更 | `PATCH` |

consumerは、受け入れるバージョンを次の3つの形のいずれかで書く。
読み方はnpmと同じである。

| 形 | 受け入れるバージョン | 例 |
|---|---|---|
| `^X.Y.Z` | `X.Y.Z`から次の`MAJOR`の手前まで。`0.Y.Z`の時は次の`MINOR`の手前まで | `^1.2.0`は`1.9.4`を受け入れ、`2.0.0`は受け入れない |
| `~X.Y.Z` | `X.Y.Z`から次の`MINOR`の手前まで | `~1.2.0`は`1.2.7`を受け入れ、`1.3.0`は受け入れない |
| `X.Y.Z` | `X.Y.Z`だけ | `1.2.0` |

フィンガープリントは、consumerが最後にどの内容に対してチェックされたかを正確に記録する。
エージェントはproviderの`SKILL.md`とコンテンツのファイルを読み、チェックはconsumerが通るかを決めるので、フィンガープリントはこの3つのファイルを対象にする。

```text
for each path in [SKILL.md, <file>, <check, when present>]:
    hash.update(path + "\n" + byte length in decimal + "\n")
    hash.update(the file's bytes)
    hash.update("\n")
integrity = "sha256-" + base64(sha256 digest)
```

パスはproviderのスキルのフォルダからの相対パスで、区切りに`/`を使う。
バージョンの範囲とフィンガープリントは`musubi.json`に並べて書き、ロックファイルは持たない (判断の記録[0003](../docs/adr/0003-range-and-fingerprint-without-a-lockfile.ja.md))。

定義そのもののバージョンは日付で表す。
`musubi.json`とチェックのファイルは、準拠する日付を`musubi`のフィールドに書く。
`musubi check`は知っている日付を全て読み、それ以外の日付を拒否する。
知っている日付は、`schema/`の下にあるフォルダの名前である。
定義のバージョン`2026-11-20`で`follows.<参照>.optional`を加えた。
`2026-11-19`を書いた`musubi.json`は今も通り、`optional`は書けない。
定義のバージョン`2026-11-21`で`follows.<参照>.when`を加えた。
`2026-11-20`を書いた`musubi.json`は今も通り、`when`は書けない。

## 再チェック

consumerは、スキルをインストールした後と、スキルを更新した後に再チェックされる。
`musubi`コマンドが使える時は、エージェントがコンテンツを読む前にも再チェックされる。

`musubi check`は次の場合に、ファイルと行を示して拒否する。

- `musubi.json`がJSONとして正しくない、定義にないフィールドを持つ、知らない定義のバージョンを指定している
- バージョンが`MAJOR.MINOR.PATCH`の形でない、範囲が3つの形のどれでもない
- 準拠が`optional: true`無しで`when`を持つ、`when`が`languages`の言語タグの一覧以外を持つ
- ファイル、チェック、例のパスがスキルのフォルダの外へ出るか、存在しないファイルを指している
- チェックがJSONのルールのファイルでない
- consumerが、インストールされていないスキル (任意の準拠を除く) か、そのスキルが提供していないコンテンツに準拠している
- providerのバージョンがconsumerの範囲の外にある
- フィンガープリントが一致しない。最後のチェックの後にコンテンツが変わったことを表す
- 例がproviderのチェックのルールに違反している
- スキルどうしが循環して準拠している (`alpha -> beta -> alpha`など)

任意の準拠のスキルがインストールされていない時、`musubi check`は警告を出してその準拠を飛ばす。
インストールされている時は、ほかの準拠と同じようにチェックする。
循環しない限り、準拠の連鎖はどれだけ深くてもよい。
フィンガープリントが一致しない時、そのコンテンツはまだ受け入れられていないので、`musubi check`はそのproviderのチェックを適用しない。
`musubi check --update`は変わったコンテンツにチェックを適用し、全ての例が通った時だけフィンガープリントを書き換える。

1つでも通らなかった時は、フィンガープリントを元のまま残す。
`--update`を付けない`musubi check`は、ファイルを書き込まない。

| 終了コード | 意味 |
|---|---|
| `0` | 全ての宣言と例が通った。警告を出力することがある |
| `1` | 1つ以上の問題があり、`<ファイル>:<行>: <メッセージ>`の形で出力した |
| `2` | コマンドの呼び出し方が間違っている |

## チェックのルール

チェックのファイルは、定義のバージョンとルールの一覧を持つJSONである。
`musubi check`はルールを読み、consumerが指定した例それぞれに適用する。
providerのコードは実行しない (判断の記録[0004](../docs/adr/0004-checks-are-json-rules.ja.md))。

```json
{
  "musubi": "2026-11-19",
  "rules": [
    { "kind": "headings", "headings": ["## Purpose and scope", "## Decisions", "## Open decisions"] },
    { "kind": "forbid", "text": ["Fill in:"] },
    { "kind": "table-columns", "heading": "## Decisions", "columns": ["Option", "Chosen", "Why"] }
  ]
}
```

| 種類 | フィールド | 例が通る条件 |
|---|---|---|
| `headings` | `headings`に見出しの行を並べる | 全ての見出しの行がこの順番で現れる。間にほかの見出しがあってもよい |
| `forbid` | `text`に文字列を並べる | どの行も、並べた文字列のいずれも含まない |
| `table-columns` | `heading`と`columns` | 見出しの下の最初の表が全ての列を持つ。ほかの列があってもよい |

ルールは、コードブロックの中の行を読み飛ばす。
各ルールは求めるものだけを探すので、consumerが追加した節は通る。
新しい種類のルールは、新しい定義のバージョンで追加する。

## 既存の仕組みとの関係

| 仕組み | すること | musubiとの関係 |
|---|---|---|
| スキルのインストーラー (APM、npx skills、skillpmなど) | スキルとその依存をインストールし、バージョンを固定する | スキルのインストール元はインストーラーが管理する。`musubi.json`はスキルとコンテンツとバージョンだけを書くので、インストール元を書くのは1か所で済む。`musubi.json`を読むインストーラーは、インストールの節のとおりにproviderをインストールする |
| Claude Codeのプラグインの`dependencies` | プラグインが依存するプラグインをインストールする | インストーラーと同じ。このようなフィールドを持たないエージェントでは、`musubi install`がproviderをインストールする。何もインストールしなかった時は、consumerの本文にある作業を止める1行がエージェントを止める |
| Agent Skills | `SKILL.md`とスキルのフォルダを定める | `SKILL.md`は変えず、フォルダの中に`musubi.json`が1つ増えるだけである。musubiは実際のスキルで動くようになった後に、Agent Skillsへ提案する |
| Agent Skillsの依存ファイルとロックファイルの提案 | スキルが必要とするスキルを宣言する | これらはどのスキルをインストールするかを書く。musubiは、そのスキルのどのコンテンツにどのバージョンで準拠するかを書き、再チェックする |

## musubiコマンド

コマンドはNode.js 22.18以降で動き、実行時の依存を持たない。
`musubi install`は、gitのURLで指定したインストール元をクローンする時だけ`git`を実行する。

| コマンド | すること |
|---|---|
| `musubi check [<フォルダ>...] [--update]` | フォルダの中の全ての`musubi.json`を、再チェックの節のとおりにチェックする |
| `musubi add <スキル名>/<名前> [<フォルダ>...] [--optional [--lang <言語タグ>]...]` | consumerのフォルダで実行する。`musubi.json`に範囲`^<今のバージョン>`とフィンガープリントを書き込み、既にあるフィールドは残し、`SKILL.md`に置く3行を出力する。`--optional`を付けると`optional: true`も書いて任意の準拠の3行を出力し、`--lang`を付けると`when.languages`を書く。書くフィールドを`musubi`の定義のバージョンが持たない時は、そのフィールドを持つ最も古い定義のバージョンに上げる |
| `musubi install <スキル名>... --from <インストール元>... [--to <フォルダ>] [--with <スキル名>]... [--lang <言語タグ>]...` | スキルと、そのスキルが準拠するproviderを、インストールの節のとおりにインストールし、`musubi check`を実行する |
| `musubi graph [<フォルダ>...] [--out <ファイル>]` | 各スキルと、準拠するコンテンツへの矢印を描いたHTMLのページを1つ書き出す |

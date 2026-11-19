# musubiの定義

定義の版は`2026-11-19`。

musubiは、エージェントのスキルが出す中身 (文書の書式や書き方の決まりなど) を、その中身に従うスキルと結ぶ。
出す側のスキルは中身を名前と版で宣言し、使う側のスキルはその中身に従うと宣言する。
エージェントは`SKILL.md`を読むどのエージェントでも同じ仕方で中身を読み込み、中身が変わると従うスキルを確かめ直す。
正の定義は英語の[musubi.md](musubi.md)で、この文書はその日本語の訳である。

## 全体の形

musubiに加わるスキルは、`SKILL.md`をAgent Skillsが決める形のまま持ち、その横に`musubi.json`を1つ足す。

| file | 書く人 | 持つ物 |
|---|---|---|
| `SKILL.md` | スキルを書く人 | Agent Skillsの頭の欄と本文 (変えない)。本文がエージェントに、どの中身を読むかを伝える |
| `musubi.json` | スキルを書く人か`musubi add` | スキルが出す中身と、従う中身 |
| 中身のfile | 出す側 | 書式、書き方の決まりなど、使う側が従う文 |
| 検査のfile | 出す側 | `musubi check`が使う側の例に回すJSONの決まり |

```text
skills/
├── design-doc/              出す側のスキル
│   ├── SKILL.md             出す中身ごとにfileを名指す
│   ├── musubi.json          "provides": design 1.0.0
│   ├── formats/design.md    中身
│   └── checks/design.json   検査の決まり
└── api-design/              使う側のスキル
    ├── SKILL.md             design-doc/design を指す3行
    ├── musubi.json          "follows": design-doc/design ^1.0.0 と指紋
    └── examples/orders-api.md   検査を回す例
```

ここで使う語は[GLOSSARY.ja.md](../GLOSSARY.ja.md)が定める。

## 出す側の宣言

出す側のスキルは、出す中身を`musubi.json`の`provides`に並べる。

```json
{
  "$schema": "../../../schema/2026-11-19/musubi.schema.json",
  "musubi": "2026-11-19",
  "provides": {
    "design": { "version": "1.0.0", "file": "formats/design.md", "check": "checks/design.json" }
  }
}
```

| 欄 | 要るか | 意味 |
|---|---|---|
| `$schema` | 任意 | 編集の画面がJSON Schemaを見つける所 (`schema/<日付>/musubi.schema.json`) |
| `musubi` | 要る | このfileが従う定義の版 |
| `provides.<名前>` | 中身ごとに1つ要る | 中身の名前。小文字の語を`-`でつなぐ |
| `provides.<名前>.version` | 要る | 中身の版 (`MAJOR.MINOR.PATCH`) |
| `provides.<名前>.file` | 要る | 中身のfile。スキルのフォルダからの相対path |
| `provides.<名前>.check` | 任意 | JSONの決まりのfile。スキルのフォルダからの相対pathで、検査の決まりの節が形を決める |

中身はfile 1つと、任意で付ける検査1つの組で、`design-doc/design`のように`<スキル名>/<名前>`で呼ぶ。
中身ごとに版を持つので、1つを変えてもほかの中身の版は変わらない。
pathはスキルのフォルダの中に留める。
`musubi check`は絶対pathと、フォルダの外へ出るpathを拒む。
エージェントは出す側の`SKILL.md`の本文を読んでfileを見つけるので、出す側の本文は中身ごとにfileを名指す (判断の記録[0002](../docs/adr/0002-agents-open-the-provider-by-name.ja.md))。
`SKILL.md`がAgent Skillsの検査を通り続けるよう、宣言は頭の欄でなく別の`musubi.json`に書く (判断の記録[0001](../docs/adr/0001-declarations-in-musubi-json.ja.md))。

## 使う側の宣言

使う側のスキルは、従う中身を`musubi.json`の`follows`に並べる。

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

| 欄 | 要るか | 意味 |
|---|---|---|
| `follows.<スキル>/<中身>` | 中身ごとに1つ要る | 従う中身 |
| `follows.<名前>.version` | 要る | 使う側が従える版。版と指紋の節が形を決める |
| `follows.<名前>.integrity` | 要る | 最後に確かめた時の中身の指紋 |
| `follows.<名前>.examples` | 任意 | 出す側の検査を回す、使う側のfile |

使う側の`SKILL.md`の本文は、従う中身ごとに次の3行を持つ。
3行は`musubi add`が出す。

```text
Write in the `design` format of the `design-doc` skill: open the `design-doc` skill by name and read the file it names for `design`.
If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.
If the `design-doc` skill is not installed, do not start: tell the user that `design-doc` is missing and how to install it, then stop.
```

使う側は、従う中身に自分の節を足せる。
出す側の検査が求める物を外すことと、名前を変えることはできない。
1つのスキルが中身を出し、同時に別の中身に従ってもよい。
出す側の書式が共通の書き方の決まりに従う形がこれに当たる。

## 見つけ方と読み込み方

エージェントは`SKILL.md`の本文を読んで中身を読み込み、スキルを使う間に`musubi.json`は読まない。
そのため、musubiを知らないエージェントも、命令を持つエージェントと同じ仕方で中身を読み込む。

1. エージェントは、ほかのスキルと同じように使う側の`SKILL.md`を読む。
2. 本文が出す側のスキルと中身を名指す。エージェントは入っているスキルから出す側のスキルを名前で開き、その本文がその中身に名指すfileを読む。
3. エージェントはそのfileだけを丸ごと読み、出す側のほかの中身は読まない。
4. 出す側のスキルが入っていない時、エージェントは書き始めず、足りないスキルとその入れ方を人に伝えて止まる。

Claude Code、Codex、GitHub Copilot CLI、Gemini CLIはどれも入っているスキルを名前で並べるので、スキルがどこに入っていても名前で開ける。
別々のpluginから入った2つのスキルは隣り合わないので、スキルのフォルダどうしの相対pathは使わない。

`musubi check`と`musubi graph`は、命令に渡したフォルダからスキルを読む。
フォルダを渡さない時は、今のフォルダとhomeのフォルダの`.claude/skills`、`.agents/skills`、`.github/skills`、`.gemini/skills`を読む。
そのどれかの直下に在り、`SKILL.md`を持つフォルダがスキルで、名前はフォルダの名前である。
同じ名前のスキルが2つのフォルダに在る時は、上の順で先のフォルダの物を使い、`musubi check`がもう1つを知らせる。

エージェントは中身のfileを丸ごと読むので、`musubi check`は500行を超える中身を知らせる。
500行はAgent Skillsが`SKILL.md`に勧める長さである。
そのような中身も拒まず、長い中身は出す側が複数の中身に分ける。

## 版と指紋

中身の版は`MAJOR.MINOR.PATCH`で表す。

| 中身か検査の変更 | 上げる数 |
|---|---|
| 使う側が壊れうる変更。要る節や列を外すか名前を変える、検査を厳しくする | `MAJOR` |
| 使う側が使ってよい物を足す変更。任意の節を足すなど | `MINOR` |
| どの使う側も通ったままの、言い回しの変更 | `PATCH` |

使う側は、従える版を次の3つの形のどれかで書き、npmと同じ仕方で読む。

| 形 | 従える版 | 例 |
|---|---|---|
| `^X.Y.Z` | `X.Y.Z`から次の`MAJOR`の手前まで。`0.Y.Z`は次の`MINOR`の手前まで | `^1.2.0`は`1.9.4`に従い、`2.0.0`には従わない |
| `~X.Y.Z` | `X.Y.Z`から次の`MINOR`の手前まで | `~1.2.0`は`1.2.7`に従い、`1.3.0`には従わない |
| `X.Y.Z` | `X.Y.Z`だけ | `1.2.0` |

指紋は、使う側が最後に何と照らして確かめたかを残す。
エージェントは出す側の`SKILL.md`と中身のfileを読み、検査は使う側が通るかを決めるので、指紋はこの3つのfileを含める。

```text
for each path in [SKILL.md, <file>, <check, when present>]:
    hash.update(path + "\n" + byte length in decimal + "\n")
    hash.update(the file's bytes)
    hash.update("\n")
integrity = "sha256-" + base64(sha256 digest)
```

pathは出す側のスキルのフォルダからの相対で、区切りに`/`を使う。
版の範囲と指紋は`musubi.json`に並べて書き、lockfileは持たない (判断の記録[0003](../docs/adr/0003-range-and-fingerprint-without-a-lockfile.ja.md))。

定義そのものの版は日付で表す。
`musubi.json`と検査のfileは、従う日付を`musubi`の欄に書く。
`musubi check`は知っている日付を全て読み、ほかの日付を拒む。
知っている日付は`schema/`の下のフォルダである。

## 確かめ直し方

使う側は、スキルを入れた後と、スキルを更新した後と、`musubi`の命令が在る時はエージェントが中身を読む前に確かめ直す。

`musubi check`は次の時に、fileと行を名指して拒む。

- `musubi.json`がJSONとして読めない、定義の知らない欄を持つ、知らない定義の版を名指す
- 版が`MAJOR.MINOR.PATCH`でない、範囲が3つの形のどれでもない
- file、検査、例のpathがスキルのフォルダの外へ出るか、無いfileを名指す
- 検査がJSONの決まりのfileでない
- 使う側が、入っていないスキルか、そのスキルが出していない中身に従う
- 出す側の版が使う側の範囲の外に在る
- 指紋が合わない。最後に確かめた後に中身が変わったことを表す
- 例が出す側の検査の決まりに合わない
- スキルどうしが輪になって従う (`alpha -> beta -> alpha`など)

輪にならない限り、どの深さの従い方も許す。
指紋が合わない時、その中身はまだ受け入れていないので、`musubi check`はその出す側の検査を回さない。
`musubi check --update`は変わった中身に検査を回し、全ての例が通った時だけ指紋を書き換える。
1つでも落ちた時は、指紋を元のまま残す。
`--update`を付けない`musubi check`はfileを書かない。

| 終わり方 | 意味 |
|---|---|
| `0` | 全ての宣言と例が通った。知らせを出すことがある |
| `1` | 1つ以上の問題が在り、`<file>:<行>: <文>`の形で出した |
| `2` | 命令の呼び方が違う |

## 検査の決まり

検査のfileは、定義の版と決まりの一覧を持つJSONである。
`musubi check`は決まりを読み、使う側が名指した例それぞれに回す。
出す側のcodeは走らせない (判断の記録[0004](../docs/adr/0004-checks-are-json-rules.ja.md))。

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

| 種類 | 欄 | 例が通る時 |
|---|---|---|
| `headings` | `headings` (見出しの行) | 全ての見出しの行がこの順で在る。間にほかの見出しが在ってよい |
| `forbid` | `text` (文の断片) | どの行もその文を含まない |
| `table-columns` | `heading`、`columns` | 見出しの下の最初の表が全ての列を持つ。ほかの列が在ってよい |

決まりは、囲んだcodeの区画の中の行を読み飛ばす。
各決まりは求める物だけを探すので、使う側が足した節は通る。
新しい種類の決まりは、新しい定義の版で足す。

## 既にある仕組みとの関係

| 仕組み | やること | musubiとの関係 |
|---|---|---|
| スキルを入れる道具 (APM、npx skills、skillpmなど) | スキルとその依存を入れ、版を固定する | スキルの入手先はこの道具が持つ。`musubi.json`はスキルと中身と版だけを書くので、入手先は1か所に書く |
| Claude Codeのpluginの`dependencies` | pluginが頼るpluginを入れる | 入れる道具と同じ。この欄を持たないエージェントでは、使う側の本文の止まる1行に頼る |
| Agent Skills | `SKILL.md`とスキルのフォルダを決める | `SKILL.md`は変えず、`musubi.json`はフォルダの中の1つのfileに留まる。musubiは本物のスキルで動いた後に、Agent Skillsへ提案する |
| Agent Skillsの依存のfileとlockfileの提案 | スキルが頼るスキルを宣言する | どのスキルを入れるかを書く。musubiは、そのスキルのどの中身にどの版で従うかを書き、確かめ直す |

## musubiの命令

命令はNode.js 22.18以降で動き、実行時の依存を持たない。

| 命令 | やること |
|---|---|
| `musubi check [<フォルダ>...] [--update]` | フォルダの全ての`musubi.json`を、確かめ直し方の節のとおりに確かめる |
| `musubi add <スキル>/<中身> [<フォルダ>...]` | 使う側のフォルダで回す。`musubi.json`に範囲`^<今の版>`と指紋を書き、既に在る欄を残し、`SKILL.md`に置く3行を出す |
| `musubi graph [<フォルダ>...] [--out <file>]` | スキルごとの箱と、従う中身への矢印を描いたHTMLを1枚書く |

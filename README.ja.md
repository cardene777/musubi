# musubi

musubiは、あるエージェントのスキルのコンテンツを、別のスキルと結び付けるための提案です。

エージェントのスキルのパッケージマネージャーは既にあり、スキルを依存するスキルと一緒にインストールして、バージョンを固定できます。
ただし、スキルが依存先のどの部分に準拠するのかは記録しません。
その部分とは、書く文書の書式や、守る書き方のルールや、実行するチェックのことです。
musubiでは、スキルが提供するコンテンツを名前とバージョン付きで宣言し、別のスキルがそのコンテンツに準拠すると宣言します。

スキルを実行する時は、エージェントがそのコンテンツを読み込みます。
この動きは、`SKILL.md`を読むどのエージェントでも同じです。
提供するコンテンツが変わると、準拠するスキルが再チェックされます。

定義は[spec/musubi.ja.md](spec/musubi.ja.md)にあります。

## スキルが参加する方法

スキルは`SKILL.md`をそのまま持ち、その隣に`musubi.json`を追加します。
providerは、提供するコンテンツを並べます。

```json
{
  "musubi": "2026-11-19",
  "provides": {
    "design": { "version": "1.0.0", "file": "formats/design.md", "check": "checks/design.json" }
  }
}
```

consumerは、準拠するコンテンツと、受け入れるバージョンと、最後にチェックしたコンテンツのフィンガープリントを並べます。

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

consumerの`SKILL.md`の本文は、`design-doc`のスキルを名前で開いて`design`の書式を読むよう、エージェントに伝えます。
そのため、エージェントは新しい仕組みがなくてもコンテンツを読み込めます。
2つのスキルは[examples/skills](examples/skills)にあります。

## チェック

`musubi`コマンドは宣言をチェックし、providerのチェックをconsumerの例に適用します。
Node.js 22.18以降で動き、実行時の依存を持ちません。
npmに`musubi-cli`として公開しており、インストールした後はプロジェクトのフォルダで実行します。

```bash
npm install -g musubi-cli
musubi check
musubi graph --out graph.html
```

フォルダを指定しない時、`musubi check`はカレントフォルダとホームフォルダにある`.claude/skills`、`.agents/skills`、`.github/skills`、`.gemini/skills`を読みます。
インストールせずに1回だけ実行する時は、`npx musubi-cli check <スキルのフォルダ>`を使います。

このリポジトリをクローンして実行する時は、先に開発用の依存をインストールします。

```bash
pnpm install
node src/cli.ts check examples/skills
node src/cli.ts graph examples/skills --out graph.html
```

## サイトにスキルを載せる

musubiのサイトは、定義と、`registry/`に名前があるスキルを表示します。
スキルごとに、提供するコンテンツと、準拠するコンテンツと、そのスキルに準拠しているスキルが載ります。
リポジトリごとに`registry/<owner>/<repo>.json`というファイルを1つ置き、表示するスキルのフォルダを、リポジトリのルートからの相対パスで並べます。

```json
{
  "skills": ["plugins/doc-formats/skills/design-doc", "plugins/evm-dev/skills/contract-design"]
}
```

スキルを載せる時は、そのファイルを追加するか変更するPRを送ります。
サイトは各フォルダの`musubi.json`と`SKILL.md`を、GitHubにあるリポジトリのデフォルトブランチから読むので、リポジトリは公開されている必要があります。
`musubi.json`を読めないフォルダは、サイトをビルドする時にフォルダ名を表示し、一覧から外します。

サイトをビルドして手元の<http://localhost:3810/>で開く時は、`pnpm site`を実行します。
このコマンドは`node site/build.ts`でページを`site/dist/`に書き出してから、そのフォルダを配信します。
公開したサイトは<https://musubi.cardene.dev/>にあり、`pnpm site:publish`で公開する手順は[docs/publishing.ja.md](docs/publishing.ja.md)にあります。

## 文書

| 文書 | 内容 |
|---|---|
| [spec/musubi.ja.md](spec/musubi.ja.md) | 定義 |
| [GLOSSARY.ja.md](GLOSSARY.ja.md) | 定義が使う用語 |
| [docs/publishing.ja.md](docs/publishing.ja.md) | サイトをGitHub Pagesへ公開する手順 |
| [docs/adr](docs/adr) | 元に戻すのが高くつく判断と、採らなかった案 |

English: [README.md](README.md)

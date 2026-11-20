# musubi

musubiは、あるエージェントのスキルの中身を、別のスキルと結ぶための提案です。

スキルを入れる道具は既にあり、依存するスキルも一緒に入れて版を固定できます。
ただし、使う側のスキルが依存先のどの中身に従うのかは、どの道具にも残りません。
中身とは、書く文書の書式、守る書き方の決まり、回す検査のことです。
musubiでは、スキルが出す中身を名前と版で宣言し、別のスキルがその中身に従うと宣言します。
スキルを使う時には、エージェントがその中身を読み込みます。
この動きは、`SKILL.md`を読むどのエージェントでも同じです。
出す側の中身が変わると、従う側のスキルを確かめ直します。

定義は[spec/musubi.ja.md](spec/musubi.ja.md)に在ります。

## スキルの加わり方

スキルは`SKILL.md`をそのまま持ち、その横に`musubi.json`を足します。
出す側は、出す中身を並べます。

```json
{
  "musubi": "2026-11-19",
  "provides": {
    "design": { "version": "1.0.0", "file": "formats/design.md", "check": "checks/design.json" }
  }
}
```

使う側は、従う中身と、従える版と、最後に確かめた中身の指紋を並べます。

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

使う側の`SKILL.md`の本文は、`design-doc`のスキルを名前で開いて`design`の書式を読むようエージェントに伝えます。
そのため、エージェントは新しい仕組みを持たずに中身を読み込めます。
2つのスキルは[examples/skills](examples/skills)に在ります。

## 確かめ方

`musubi`の命令は宣言を確かめ、出す側の検査を使う側の例に回します。
Node.js 22.18以降で動き、実行時の依存を持ちません。
npmには`musubi-cli`の名前で出ており、入れた後はプロジェクトのフォルダで回します。

```bash
npm install -g musubi-cli
musubi check
musubi graph --out graph.html
```

フォルダを渡さない時、`musubi check`は今のフォルダとホームのフォルダの`.claude/skills`、`.agents/skills`、`.github/skills`、`.gemini/skills`を読みます。
入れずに1回だけ回す時は、`npx musubi-cli check <スキルのフォルダ>`を使います。

このrepoを手元に写して回す時は、先に開発の依存を入れます。

```bash
pnpm install
node src/cli.ts check examples/skills
node src/cli.ts graph examples/skills --out graph.html
```

## サイトにスキルを載せる

musubiのサイトは、定義と、`registry/`に名前のあるスキルを見せます。スキルごとに、出す中身と従う中身と、そのスキルに従っているスキルが載ります。
repoごとに1つの`registry/<owner>/<repo>.json`を置き、見せるスキルのフォルダをrepoの根からの相対のpathで並べます。

```json
{
  "skills": ["plugins/doc-formats/skills/design-doc", "plugins/evm-dev/skills/contract-design"]
}
```

スキルを載せる時は、そのfileを足すか変えるPRを送ります。
サイトは各フォルダの`musubi.json`と`SKILL.md`を、GitHubにあるrepoの既定のbranchから読むので、repoは公開している必要があります。
`musubi.json`を読めないフォルダは、サイトを組み立てる時に名指して知らせ、一覧から外します。

サイトを組み立てて手元の<http://localhost:3810/>で開く時は、`pnpm site`を打ちます。
この命令は`node site/build.ts`で頁を`site/dist/`へ書き出してから、そのフォルダを配ります。
公開したサイトは<https://musubi.cardene.dev/>にあり、`pnpm site:publish`で公開する手順は[docs/publishing.ja.md](docs/publishing.ja.md)にあります。

## 文書

| 文書 | 持つ物 |
|---|---|
| [spec/musubi.ja.md](spec/musubi.ja.md) | 定義 |
| [GLOSSARY.ja.md](GLOSSARY.ja.md) | 定義が使う語 |
| [docs/publishing.ja.md](docs/publishing.ja.md) | サイトをGitHub Pagesへ公開する手順 |
| [docs/adr](docs/adr) | 戻すのが高くつく判断と、採らなかった案 |

English: [README.md](README.md)

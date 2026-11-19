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

```bash
pnpm install
node src/cli.ts check examples/skills
node src/cli.ts graph examples/skills --out graph.html
```

## 文書

| 文書 | 持つ物 |
|---|---|
| [spec/musubi.ja.md](spec/musubi.ja.md) | 定義 |
| [GLOSSARY.ja.md](GLOSSARY.ja.md) | 定義が使う語 |
| [docs/adr](docs/adr) | 戻すのが高くつく判断と、採らなかった案 |

English: [README.md](README.md)

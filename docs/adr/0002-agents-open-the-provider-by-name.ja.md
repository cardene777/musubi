# 0002. エージェントはproviderのスキルを名前で開く

## 決めること

エージェントがconsumerのスキルを使う時に、そのスキルが準拠するコンテンツをどう見つけて読むか。

## 採った案

consumerの`SKILL.md`の本文に、providerのスキルとコンテンツを名前で書く。
エージェントはインストール済みのスキルからproviderのスキルを名前で開き、providerの本文が指すファイルを読む。
エージェントはこの時に`musubi.json`を読まないので、`musubi`コマンドがないエージェントでも同じように動く。

## 却下した案

| 案 | 採らなかった理由 |
|---|---|
| 隣のフォルダを`../design-doc/formats/design.md`のような相対パスで読む | 2つのスキルが別々の場所にインストールされると読めない。2つのClaude Codeのプラグインに分かれた時がこれに当たる |
| `musubi`コマンドがコンテンツを出力する | コマンドがないエージェントでは読めない |
| インストールする時に、providerのコンテンツをconsumerにコピーする | コピーが元のコンテンツとずれていく |

## 根拠

- Claude Codeは`.claude/skills`を、Codexは`.agents/skills`を、Copilot CLIとGemini CLIはそれぞれのフォルダと`.agents/skills`を読み、どれもインストール済みのスキルを名前で一覧にする (Issue #3で調べた)。
- 定義は、Claude Code以外のエージェントでも使える形にする (`.ikkan/premises/tech.md`の8行目)。
- Issue #3の決めたことの表の3回目。

## 日付

2026-11-19

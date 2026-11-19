# 技術の構成と制約

命令はTypeScriptで書き、Node.js 22.18以降が型を外して`src/`を直に回す (`package.json`)。
配る時は`tsc -p tsconfig.build.json`が`dist/`へ組み立て、実行時の依存を持たない (`package.json`)。

決まっている制約は次のとおり (`AGENTS.md`)。

- 定義は Claude Code 以外のエージェントでも従える形に書く
- CI の設定を足さない

テストは`node --test`で回し、開発の依存 (TypeScript、ajv、Node.jsの型) はpnpmで入れる (`package.json`)。

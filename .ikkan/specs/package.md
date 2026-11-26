# package

| 条件 | 確かめ方 | 出元 |
|---|---|---|
| `package.json`の名前は`musubi-cli`、バージョンは`0.3.0`で、`repository`のURLは`github.com/<持ち主>/musubi`を指す | `pnpm test`の検査`package-is-musubi-cli`が通る | #8、#33、#42 |
| `package.json`は`private`を持たず、`npm publish`に断られない | `pnpm test`の検査`package-is-musubi-cli`が通る | #8 |
| 追跡するfileだけを写した`dist/`の無いフォルダで`npm pack`が作ったfileを入れると、`musubi`の命令が`check examples/skills`を通す | `pnpm test`の検査`packed-command-checks-the-examples`が通る | #8 |
| `npm pack`が作ったfileは`src/`、`tests/`、`examples/`、`.ikkan/`、`node_modules/`の下のfileを含まない | `pnpm test`の検査`packed-files-leave-out-the-sources`が通る | #8 |
| 追跡するfileのうち、`repository`のURLの持ち主の名前を持つのは`LICENSE`と`package.json`だけで、ほかのfileは持たない | `pnpm test`の検査`account-name-only-in-license-and-package`が通る | #8 |
| `README.md`と`README.ja.md`は、`npm install -g musubi-cli`と`npx musubi-cli check`を示す | `pnpm test`の検査`readme-shows-the-npm-install`が通る | #8 |
| 2つのREADMEの形 (見出しと表と囲み) は、英語と日本語で揃ったままである | `pnpm test`の検査`doc-pairs-have-the-same-shape`が通る | #8 |
| 命令の名前は`musubi`のままで、実行の時の依存を持たない | `pnpm test`の検査`package-has-no-runtime-dependencies`が通る | #8 |
| repoの中でビルドした`dist/cli.js`が`check examples/skills`を通す | `pnpm test`の検査`build-runs-from-dist`が通る | #8 |

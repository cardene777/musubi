# repo-checks

| 条件 | 確かめ方 | 出元 |
|---|---|---|
| `.ikkan/checks.md`の欄`Reached checks`は`pnpm test`を名指し、その行が無いfileと命令が空のfileをテストが拒む | `pnpm test`の検査`ikkan-gates-run-the-tests-as-reached-checks`が通る | #40 |
| ほかのテストは通り続ける | `pnpm test`が終わり方0で終わる | #40 |

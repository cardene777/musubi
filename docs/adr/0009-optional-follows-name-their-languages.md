# 0009. An optional follow names in `when` the languages its provider is installed for

## Decision

How a consumer writes when the provider of an optional follow is installed without the user naming it, such as when the user writes Japanese.

## Chosen

Definition version `2026-11-21` adds `follows.<ref>.when`, allowed only together with `optional: true`.
Its one field, `languages`, lists language tags such as `ja`.
`musubi install --lang <tag>` installs the provider of every optional follow whose `languages` holds a tag of the same primary language, so `--lang ja-JP` matches `ja`.
`musubi add <ref> --optional --lang <tag>` writes `when`, and `musubi add` moves `musubi` to the earliest definition version that knows the fields it writes.
A `musubi.json` that names `2026-11-20` still passes, and `when` in it is an unknown field.

## Rejected

| Option | Why not |
|---|---|
| A condition in free text that the agent reads | The command could not evaluate it, so installers would not agree on what to install |
| Read the language from `LANG` | The terminal's locale and the language the user writes in can differ, so the same command would install different skills on different machines |
| No condition, only `--with` | The issue asks for the provider of an optional follow to be installed when a condition matches |
| Add `when` to `2026-11-20` without a new date | musubi-cli 0.2.0 on npm reads `2026-11-20` and would refuse `when` as unknown without saying that a newer definition is needed |
| `musubi add` keeps moving `musubi` to the latest definition version | `musubi add --optional` would write `2026-11-21`, which musubi-cli 0.2.0 refuses, for a follow that `2026-11-20` already describes |

## Grounds

- Issue #38, decision table: the owner chose on 2026-11-21 to take the recommended option for every point.
- Issue #265 of agent-shuriken, where the owner asked for a skill's writing rules to be installed with it when the skill may be used in Japanese.
- Decision record [0007](0007-optional-follows.md): a new field comes with a new definition date.

## Date

2026-11-21

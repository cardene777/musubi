# 0007. A consumer marks a follow optional when it also works without the provider

## Decision

How a consumer follows content it uses only when the provider is installed, such as writing rules a skill also works without.

## Chosen

Definition version `2026-11-20` adds `follows.<ref>.optional`, and `true` makes the follow optional.
When the provider of an optional follow is not installed, `musubi check` warns and skips that follow, and the agent goes on without the content.
When the provider is installed, `musubi check` checks the range, the fingerprint, and the examples as it does for any follow.
`musubi add <skill>/<content> --optional` writes `optional: true`, moves `musubi` to `2026-11-20` when the file names an older date, and prints three lines that read the content only when the provider is installed.
A `musubi.json` that names `2026-11-19` still passes, and `optional` in it is an unknown field.
The list and skill pages of the site mark an optional follow.

## Rejected

| Option | Why not |
|---|---|
| Add `optional` to `2026-11-19` without a new date | musubi-cli 0.1.0 on npm would refuse the field as unknown without saying that a newer definition is needed |
| The provider declares that its content is optional | Only the consumer knows whether it works without the provider |
| `musubi check` fails when the provider of an optional follow is missing | Anyone who has not installed the provider would see `musubi check` fail for a skill that works without it |
| Draw optional follows as dotted lines in `musubi graph` and on the site | The lines are already drawn as moving dashes, which are hard to tell from dots; the mark on the list and skill pages tells them apart |

## Grounds

- Issue #29, decision table: the owner chose on 2026-11-20 to add optional follows to the definition before binding the `convey` skill of agent-shuriken to the writing rules of `japanese-writing`.
- The definition is versioned by date, and `musubi check` refuses a date it does not know, so a new field comes with a new date.

## Date

2026-11-20

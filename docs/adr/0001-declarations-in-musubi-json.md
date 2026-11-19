# 0001. Declarations live in musubi.json

## Decision

Where provider and consumer skills write their musubi declarations.

## Chosen

A separate `musubi.json` next to `SKILL.md` holds `provides` and `follows` as structured JSON, validated by a JSON Schema.
`SKILL.md` keeps the form the Agent Skills specification defines.

## Rejected

| Option | Why not |
|---|---|
| `metadata` in the `SKILL.md` frontmatter | Its values are strings only, so a list of followed content would be packed into one string |
| A new frontmatter field such as `requires` | The Agent Skills reference validator rejects fields outside the six it knows, so skills would fail validation until the specification changes |
| A section in the `SKILL.md` body | Reading it by machine would need rules for how the body is written |

## Grounds

- The Agent Skills specification defines `metadata` as a map from strings to strings, and its reference validator rejects unknown top-level fields (researched in issue #3).
- The definition must work for agents other than Claude Code (`.ikkan/premises/tech.md`, line 8).
- Issue #3, decision table, round 1.

## Date

2026-11-19

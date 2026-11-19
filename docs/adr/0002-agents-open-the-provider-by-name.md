# 0002. Agents open the provider skill by name

## Decision

How an agent finds and reads the content a consumer skill follows, at the time it uses the consumer skill.

## Chosen

The consumer's `SKILL.md` body names the provider skill and the content.
The agent opens the provider skill by name from the skills it has installed and reads the file the provider's body points to.
Agents do not read `musubi.json` at that time, so an agent without the musubi command works the same way.

## Rejected

| Option | Why not |
|---|---|
| A relative path to a sibling folder, such as `../design-doc/formats/design.md` | It breaks when the two skills are installed in different places, such as two Claude Code plugins |
| A musubi command that prints the content | An agent without the command cannot read it |
| Copying the provider's content into the consumer at install time | The copy drifts from the original |

## Grounds

- Claude Code reads `.claude/skills`, Codex reads `.agents/skills`, and Copilot CLI and Gemini CLI read their own folders and `.agents/skills`, and each of them lists installed skills by name (researched in cardene777/musubi#3).
- The definition must work for agents other than Claude Code (`.ikkan/premises/tech.md`, line 8).
- cardene777/musubi#3, decision table, round 3.

## Date

2026-11-19

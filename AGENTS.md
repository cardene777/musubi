# AGENTS.md

Guidance for people and coding agents working in this repository.
Claude Code reads it through `CLAUDE.md`; Codex and other agents read it directly.

## What this repository is

musubi is a proposal for binding the content one agent skill provides (a document format, writing rules, a check) to the skills that follow it, with names, versions, and checks that work in every agent that reads `SKILL.md`.
The definition is decided first, in this repository's issues, before any tool is built.

## Rules

- Work goes through the ikkan workflow: every change starts from an issue filed by ikkan, and its records stay in the issue and under `.ikkan/`.
- Write the definition so that an agent other than Claude Code can follow it. Say "shell command" instead of naming one agent's tool.
- Every README and doc page has a Japanese counterpart named `<name>.ja.md` with the same headings, tables, and code blocks. Update both in the same pull request.
- The records under `.ikkan/` are written by the ikkan workflow in Japanese.
- Do not include personal data in files, commits, or pull requests: local paths such as `/Users/<name>`, email addresses, or account names.
- Do not add CI workflows.

## Commits and pull requests

- Write the subject as `<emoji> <type>(<scope>): <summary>` in English, for example `📝 docs(spec): define how a skill provides content`.
- One topic per pull request. The description has a summary of what changed and why, and a testing section listing the commands you ran and their results.

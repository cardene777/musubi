# The musubi definition

Definition version `2026-11-21`.

musubi binds the content one agent skill provides, such as a document format or writing rules, to the skills that follow it.
A skill declares that content under a name and a version, another skill declares that it follows it, agents load it the same way in every agent that reads `SKILL.md`, and the skills that follow it are checked again when it changes.
This English text is the normative definition; [musubi.ja.md](musubi.ja.md) is its Japanese translation.

## Overview

A skill that takes part keeps its `SKILL.md` as Agent Skills defines it and adds one file, `musubi.json`, next to it.

| File | Written by | Holds |
|---|---|---|
| `SKILL.md` | The skill's author | The Agent Skills frontmatter and body, unchanged. The body tells agents which content to read |
| `musubi.json` | The author, or `musubi add` | The content the skill provides and the content it follows |
| A content file | The provider | A format, writing rules, or any other text that consumers follow |
| A check file | The provider | JSON rules that `musubi check` applies to the consumers' examples |

```text
skills/
├── design-doc/              provider skill
│   ├── SKILL.md             names the file of each content it provides
│   ├── musubi.json          "provides": design 1.0.0
│   ├── formats/design.md    the content
│   └── checks/design.json   the check rules
└── api-design/              consumer skill
    ├── SKILL.md             three lines that point at design-doc/design
    ├── musubi.json          "follows": design-doc/design ^1.0.0 and its fingerprint
    └── examples/orders-api.md   an example the check is applied to
```

[GLOSSARY.md](../GLOSSARY.md) defines the terms used here.

## Provider declaration

A provider skill lists its content under `provides` in `musubi.json`.

```json
{
  "$schema": "../../../schema/2026-11-19/musubi.schema.json",
  "musubi": "2026-11-19",
  "provides": {
    "design": { "version": "1.0.0", "file": "formats/design.md", "check": "checks/design.json" }
  }
}
```

| Field | Required | Meaning |
|---|---|---|
| `$schema` | No | Where editors find the JSON Schema, `schema/<date>/musubi.schema.json` |
| `musubi` | Yes | The definition version the file follows |
| `provides.<name>` | Yes, one per content | The content name: lowercase words joined by `-` |
| `provides.<name>.version` | Yes | The content's version, `MAJOR.MINOR.PATCH` |
| `provides.<name>.file` | Yes | The content file, relative to the skill folder |
| `provides.<name>.check` | No | A JSON rules file, relative to the skill folder, described in Check rules |

Each content is one file with at most one check, and it is named `<skill>/<name>`, such as `design-doc/design`.
Each content has its own version, so changing one does not change the version of the others.
Paths stay inside the skill folder; `musubi check` refuses absolute paths and paths that leave it.
The provider's `SKILL.md` body names the file of each content, because agents find the file by reading that body (decision record [0002](../docs/adr/0002-agents-open-the-provider-by-name.md)).
`musubi.json` is a separate file, not a frontmatter field, so that `SKILL.md` keeps passing the Agent Skills checks (decision record [0001](../docs/adr/0001-declarations-in-musubi-json.md)).

## Consumer declaration

A consumer skill lists the content it follows under `follows` in `musubi.json`.

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

| Field | Required | Meaning |
|---|---|---|
| `follows.<skill>/<content>` | Yes, one per content | The content followed |
| `follows.<ref>.version` | Yes | The versions the consumer accepts, described in Versions and fingerprints |
| `follows.<ref>.integrity` | Yes | The fingerprint of the content at the last check |
| `follows.<ref>.examples` | No | Files of the consumer that the provider's check is applied to |
| `follows.<ref>.optional` | No | `true` when the consumer also works without the provider, described below |
| `follows.<ref>.when` | No | Only with `optional: true`: the languages for which an installer installs the provider without being asked, described below and in Installing |

The consumer's `SKILL.md` body carries three lines for each content it follows, which `musubi add` prints.

```text
Write in the `design` format of the `design-doc` skill: open the `design-doc` skill by name and read the file it names for `design`.
If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.
If the `design-doc` skill is not installed, do not start: tell the user that `design-doc` is missing and how to install it, then stop.
```

When the content's file is a script, told apart by the extensions `.py`, `.sh`, `.bash`, `.js`, `.mjs`, `.cjs`, and `.ts` in any case, the first line tells the agent to run it instead of reading it as a format.

```text
Run the `verify` of the `design-doc` skill: open the `design-doc` skill by name and run the file it names for `verify`.
```

A consumer that also works without the provider writes `optional: true` in that follow, which makes it an optional follow (decision record [0007](../docs/adr/0007-optional-follows.md)).
For an optional follow, `musubi add --optional` prints these three lines instead.

```text
When the `design-doc` skill is installed, write in the `design` format of the `design-doc` skill: open the `design-doc` skill by name and read the file it names for `design`.
If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.
If the `design-doc` skill is not installed, go on without the `design` of `design-doc`.
```

An optional follow may also name in `when` the languages for which the provider is installed together with the consumer, such as writing rules for users who write Japanese (decision record [0009](../docs/adr/0009-optional-follows-name-their-languages.md)).
`languages` lists language tags, and `musubi add --optional --lang ja` writes them.

```json
{
  "musubi": "2026-11-21",
  "follows": {
    "japanese-writing/rules": {
      "version": "^1.0.0",
      "integrity": "sha256-yNSwpBT+xXEV5bGBqedpHmjWIHVi+JaAnRATAJ0s7wM=",
      "optional": true,
      "when": { "languages": ["ja"] }
    }
  }
}
```

A consumer may add its own sections to the content it follows.
It may not remove or rename what the provider's check requires.
A skill may both provide content and follow content; a provider's format may follow shared writing rules, for example.

## Discovery and loading

Agents load content by reading `SKILL.md` bodies, and never read `musubi.json` while they use a skill.
An agent that knows nothing of musubi therefore loads content the same way as one that has the command.

1. The agent reads the consumer's `SKILL.md`, as it does for any skill.
2. The body names the provider skill and the content. The agent opens the provider skill by name from the skills it has installed and reads the file that the provider's body names for that content.
3. The agent reads only that file, whole. It does not read the provider's other content.
4. When the provider skill is not installed, the agent does not start; it tells the user which skill is missing and how to install it, and stops. When the follow is optional, the agent goes on without that content instead.

Claude Code, Codex, GitHub Copilot CLI, and Gemini CLI each list installed skills by name, so opening a skill by name works wherever the skill is installed.
Relative paths between skill folders are not used, because two skills from different plugins are not installed side by side.

`musubi check` and `musubi graph` read skills from the folders named on the command line.
Without folders they read `.claude/skills`, `.agents/skills`, `.github/skills`, and `.gemini/skills` in the current folder and in the home folder.
A skill is a folder directly inside one of them that holds `SKILL.md`, and its name is the folder name.
When two folders hold a skill of the same name, the first folder in that order wins and `musubi check` warns about the other.

Agents read a content file whole, so `musubi check` warns when one is over 500 lines, the length Agent Skills suggests for `SKILL.md`.
It does not refuse such content; a provider splits a long content into several.

## Installing

Installing a skill also installs the skills it follows, so that a consumer finds its providers in every agent, including agents without a field like Claude Code plugin `dependencies` (decision record [0008](../docs/adr/0008-install-follows-from-named-sources.md)).
An installer, `musubi install` or another, reads the consumer's `musubi.json` and decides what to install the same way.

1. It installs the provider of every required follow.
2. It installs the provider of an optional follow only when the user names that provider, or when a language the user gives has the same primary language as a tag in the follow's `when.languages`, so `ja-JP` matches `ja`.
3. It does the same for each skill it installs, down the whole chain.
4. It keeps a skill that is already installed as it is, and still follows that skill's follows.
5. When the provider of a required follow is in no source, provides no content of that name, or provides a version outside the consumer's range, it installs nothing and names the follow.
6. After installing, it runs `musubi check`, as described in Re-checking.

`musubi.json` never says where a skill comes from.
The user names the sources, and the installer finds each skill in them by its name, the way agents open a provider by name.

`musubi install` takes each source with `--from`: a folder, or a git repository URL that it clones with `git clone --depth 1` into a temporary folder and removes afterward.
In a source, every folder that holds `SKILL.md` is a skill named by its folder, at any depth outside `.git` and `node_modules`, and the first source that holds a skill wins.
A source that holds two skills of the same name is refused.
It copies each skill folder whole into the folder named with `--to`, or, without `--to`, into the first of `.claude/skills`, `.agents/skills`, `.github/skills`, and `.gemini/skills` that exists in the current folder.
A skill counts as installed when `musubi check` would find it: in that folder, or in the folders it reads without arguments.

```bash
musubi install api-design --from ../skills --to .claude/skills
musubi install convey --from https://github.com/example/skills --lang ja --with design-doc
```

| Option | Means |
|---|---|
| `--from <folder or git URL>` | A source. Given more than once, the sources are searched in order |
| `--to <skills folder>` | The folder to install into |
| `--with <skill>` | Installs the provider of an optional follow by name. It may be given more than once |
| `--lang <language tag>` | A language the user writes in, matched against `when.languages`. It may be given more than once |

`musubi install` exits with `0` when everything was installed and `musubi check` passed, `1` when it installed nothing because of a problem or `musubi check` found one, and `2` when it was called the wrong way.

## Versions and fingerprints

A content version is `MAJOR.MINOR.PATCH`.

| Change to the content or its check | Raise |
|---|---|
| A consumer can break: a required section or column is removed or renamed, or the check becomes stricter | `MAJOR` |
| Something is added that consumers may use, such as an optional section | `MINOR` |
| Wording changes that keep every consumer valid | `PATCH` |

A consumer writes the versions it accepts in one of three forms, read the way npm reads them.

| Form | Accepts | Example |
|---|---|---|
| `^X.Y.Z` | From `X.Y.Z` up to the next `MAJOR`; for `0.Y.Z`, up to the next `MINOR` | `^1.2.0` accepts `1.9.4`, not `2.0.0` |
| `~X.Y.Z` | From `X.Y.Z` up to the next `MINOR` | `~1.2.0` accepts `1.2.7`, not `1.3.0` |
| `X.Y.Z` | Only `X.Y.Z` | `1.2.0` |

The fingerprint records exactly what the consumer was last checked against.
It covers the provider's `SKILL.md`, the content file, and the check file, because an agent reads the first two and the check decides whether the consumer passes.

```text
for each path in [SKILL.md, <file>, <check, when present>]:
    hash.update(path + "\n" + byte length in decimal + "\n")
    hash.update(the file's bytes)
    hash.update("\n")
integrity = "sha256-" + base64(sha256 digest)
```

Paths are relative to the provider's skill folder and use `/`.
The range and the fingerprint sit together in `musubi.json`; there is no lockfile (decision record [0003](../docs/adr/0003-range-and-fingerprint-without-a-lockfile.md)).

The definition itself is versioned by date.
Each `musubi.json` and each check file names the date it follows in `musubi`, and `musubi check` reads every date it knows and refuses the others.
The dates it knows are the folders under `schema/`.
Definition version `2026-11-20` added `follows.<ref>.optional`; a `musubi.json` that names `2026-11-19` still passes and may not use it.
Definition version `2026-11-21` added `follows.<ref>.when`; a `musubi.json` that names `2026-11-20` still passes and may not use it.

## Re-checking

A consumer is checked again after a skill is installed, after a skill is updated, and, when the `musubi` command is available, before an agent reads the content.

`musubi check` refuses, naming the file and the line, when:

- `musubi.json` is not valid JSON, has a field the definition does not know, or names a definition version it does not know
- a version is not `MAJOR.MINOR.PATCH`, or a range is not one of the three forms
- a follow has `when` without `optional: true`, or `when` holds anything but a list of language tags in `languages`
- a file, check, or example path leaves the skill folder or names a missing file
- a check is not a JSON rules file
- a consumer follows a skill that is not installed (except in an optional follow), or a content that skill does not provide
- the provider's version is outside the consumer's range
- the fingerprint does not match, which means the content changed after the last check
- an example breaks a rule of the provider's check
- skills follow each other in a cycle, such as `alpha -> beta -> alpha`

When the skill of an optional follow is not installed, `musubi check` warns and skips that follow; when it is installed, the follow is checked like any other.
Chains of any depth are allowed as long as they do not form a cycle.
When a fingerprint does not match, `musubi check` does not apply that provider's check, because its content has not been accepted.
`musubi check --update` applies the check to the changed content and rewrites the fingerprint only when every example passes; when one fails, the fingerprint stays as it was.
`musubi check` without `--update` never writes a file.

| Exit status | Meaning |
|---|---|
| `0` | Every declaration and example passed; warnings may be printed |
| `1` | At least one problem, printed as `<file>:<line>: <message>` |
| `2` | The command was called the wrong way |

## Check rules

A check file is JSON with the definition version and a list of rules.
`musubi check` reads the rules and applies them to each example the consumer names; it never runs provider code (decision record [0004](../docs/adr/0004-checks-are-json-rules.md)).

```json
{
  "musubi": "2026-11-19",
  "rules": [
    { "kind": "headings", "headings": ["## Purpose and scope", "## Decisions", "## Open decisions"] },
    { "kind": "forbid", "text": ["Fill in:"] },
    { "kind": "table-columns", "heading": "## Decisions", "columns": ["Option", "Chosen", "Why"] }
  ]
}
```

| Kind | Fields | An example passes when |
|---|---|---|
| `headings` | `headings`: heading lines | Every heading line appears, in this order. Other headings may come between them |
| `forbid` | `text`: pieces of text | No line contains any of the text |
| `table-columns` | `heading`, `columns` | The first table under the heading has every column. It may have more |

Rules skip lines inside fenced code blocks.
A consumer's added sections pass, because each rule looks only for what it requires.
A new kind of rule is added by a new definition version.

## Relation to existing systems

| System | What it does | How musubi relates |
|---|---|---|
| Skill installers (APM, npx skills, skillpm, and others) | Install skills and their dependencies, and lock versions | They own where a skill comes from. `musubi.json` names only the skill, the content, and the version, so the source is written once. An installer that reads `musubi.json` installs the providers as described in Installing |
| Claude Code plugin `dependencies` | Install the plugins a plugin depends on | Same as installers. In agents without such a field, `musubi install` installs the providers; when nothing installed them, the stop line in the consumer's body stops the agent |
| Agent Skills | Defines `SKILL.md` and the skill folder | `SKILL.md` is unchanged and `musubi.json` is one more file in the folder. musubi is to be proposed to Agent Skills once it runs on real skills |
| Agent Skills proposals for dependency files and lockfiles | Declare which skills a skill needs | They say which skill to install. musubi says which content of it a skill follows, at which version, and checks it again |

## The musubi command

The command needs Node.js 22.18 or later and has no runtime dependencies.
`musubi install` runs `git` only to clone a source given as a git URL.

| Command | Does |
|---|---|
| `musubi check [<folder>...] [--update]` | Checks every `musubi.json` in the folders, as described in Re-checking |
| `musubi add <skill>/<content> [<folder>...] [--optional [--lang <language>]...]` | Run in a consumer's folder: writes the range `^<current version>` and the fingerprint into its `musubi.json`, keeps the fields already there, and prints the three lines for its `SKILL.md`. With `--optional` it also writes `optional: true` and prints the three lines for an optional follow, and `--lang` writes `when.languages`. When the file names a definition version that does not know a field it writes, it moves `musubi` to the earliest definition version that does |
| `musubi install <skill>... --from <source>... [--to <folder>] [--with <skill>]... [--lang <language>]...` | Installs the skills and the providers they follow, as described in Installing, then runs `musubi check` |
| `musubi graph [<folder>...] [--out <file>]` | Writes one HTML page that draws each skill and an arrow to each content it follows |

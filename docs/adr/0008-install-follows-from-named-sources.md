# 0008. `musubi install` installs the skills a skill follows, from sources the user names

## Decision

How the providers that a skill follows in its `musubi.json` get installed together with it, in every agent.

## Chosen

`musubi install <skill>... --from <source>...` installs the named skills and the provider of each follow in their `musubi.json`, down the whole chain.
It always installs the provider of a required follow, and installs the provider of an optional follow only when the user names it with `--with` or a language given with `--lang` matches the follow's `when` (decision record [0009](0009-optional-follows-name-their-languages.md)).
A source is a folder or a git repository that the user names with `--from`, and the command finds a skill in it by its folder name.
`musubi.json` still names only the skill, the content, and the version, so where a skill comes from is written only on the command line or in an installer.
The definition gains a section on installing that says which providers an installer installs, so every installer chooses the same providers from the same `musubi.json`.

## Rejected

| Option | Why not |
|---|---|
| Add only a form for installers to the definition, and let musubi install nothing | No installer reads it yet, so nothing would install the providers until one does |
| Keep relying on Claude Code plugin `dependencies` | Agents without such a field would still not install the providers |
| A source field in each follow | The source would be written twice, in `musubi.json` and in the installer |
| Look up the source by skill name on the site | It means a central list that owns skill names, which decision record [0005](0005-registry-lists-skill-folders.md) rejected |
| Always require `--to` | A user with one skills folder would type the same folder every time |
| Always install into `.claude/skills` | Skills could not be installed into a folder that only another agent reads |

## Grounds

- Issue #38, decision table: the owner chose on 2026-11-21 to take the recommended option for every point.
- Issue #265 of agent-shuriken, where the owner asked for musubi to install the skills a skill follows.
- `spec/musubi.md`, Relation to existing systems: the source of a skill is written once.

## Date

2026-11-21

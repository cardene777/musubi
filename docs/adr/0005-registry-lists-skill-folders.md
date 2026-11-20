# 0005. A registry entry lists skill folders, and the site reads them at build time

## Decision

How a repository's skills get onto the site, and where the site takes their declarations from.

## Chosen

Each repository has one file, `registry/<owner>/<repo>.json`, whose `skills` field lists the folders of the skills to show, relative to the repository root.
A pull request adds or changes that file, and the maintainers review it.
`node site/build.ts` reads only `musubi.json` and `SKILL.md` from each listed folder on the repository's default branch, writes static pages, and keeps no copy of them in this repository.
A consumer is bound to the provider of that name in its own repository first, then to the only listed skill with that name.

## Rejected

| Option | Why not |
|---|---|
| Name only the repository and find every `musubi.json` in it at build time | A large repository would be read whole, and skills its owner does not want listed would appear |
| Keep a copy of each skill's `musubi.json` in `registry/` | The copy would drift from the skill it describes |
| A central registry that owns skill names | It means running a registry like npm; ADR 0002 lets agents resolve names among the skills they have installed |

## Grounds

- Issue #3 decided that the site lists skills through pull requests to `registry/`, with the GitHub owner and repository.
- Issue #4, decision table: registry format, first entries, and the site built by a command with no dependencies.

## Date

2026-11-20

## Reviewed

On 2026-11-20, ADR 0006 replaced the pull requests to `registry/` with a search for the topic `musubi-skills`.
`registry/` now holds only the maintainers' own skills and `registry/excluded.json`.

# 0006. The site finds skills by the topic musubi-skills on GitHub

## Decision

How anyone's skills get onto the site, without a pull request or a database.

## Chosen

When the owner runs `pnpm site:publish`, the build uses the owner's gh sign-in to search GitHub for public repositories with the topic `musubi-skills`.
It lists each folder on a found repository's default branch that holds both `musubi.json` and `SKILL.md`, after checking `musubi.json` by the rules `musubi check` uses.
A folder that fails is named with the reason in the build output and left out, and `registry/excluded.json` names the repositories and folders to leave out.
`registry/<owner>/<repo>.json` keeps naming the maintainers' own skills, and a folder that both name is listed once.
The list and skill pages say that nobody has reviewed the content or the safety of the skills.

## Rejected

| Option | Why not |
|---|---|
| Find every public repository with `musubi.json` through GitHub code search | The code search API does not index repositories created in 2026, including the ones that hold the first skills |
| Pull requests that add `registry/<owner>/<repo>.json` | Every author would have to send one, and merging one without review would let it change the site's code |
| Scan every repository with a broad topic such as `agent-skills` | One publish would read thousands of file lists, hit GitHub's limit of 5,000 calls an hour, and take more than 30 minutes |
| A service on Cloudflare Workers that stores registrations | Skills are distributed through marketplaces that live in GitHub repositories, so reading GitHub is enough |
| A `musubi register` command that adds the topic | Adding the topic is one step in the About settings of the repository |

## Grounds

- Issue #20, decision table: anyone may list a skill, the maintainers neither review nor vouch for the skills, and authors give their repository a topic instead of sending a pull request.

## Date

2026-11-20

## Reviewed

On 2026-11-20, issue #27 removed the notice that nobody has reviewed the skills from the list and skill pages and from the READMEs, because the owner found it unnecessary.

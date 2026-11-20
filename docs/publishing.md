# Publishing the site

The site is at <https://musubi.cardene.dev/>.
GitHub Pages serves it from the `gh-pages` branch of this repository.
No CI builds it: the owner publishes from their machine when they decide to.

## Publish

On `main`, with nothing uncommitted, run:

```bash
pnpm site:publish
```

It builds the site into a temporary folder, reading each listed skill from GitHub, adds one commit holding the pages on top of `gh-pages`, and pushes it.
It refuses to run on another branch or with uncommitted changes, and sends nothing when the build fails.
It never rewrites `gh-pages` and never changes the working tree.
GitHub Pages serves the new pages about a minute after the push.

The build writes a `CNAME` file holding `musubi.cardene.dev` and an empty `.nojekyll` file, so GitHub Pages serves the files as they are under that domain.

## One-time settings

The owner makes the DNS records and verifies the domain once, in the Cloudflare and GitHub screens.
Verify the domain before pointing the repository at it, so no other account can claim `musubi.cardene.dev`.

| Order | Screen | What to do |
|---|---|---|
| 1 | GitHub: profile picture, Settings, Pages, Add a domain | Enter `cardene.dev` and press Add domain. GitHub shows a `TXT` record name and value |
| 2 | Cloudflare: `cardene.dev`, DNS, Records, Add record | Type `TXT`, Name and Content as GitHub showed, then Save |
| 3 | GitHub: the same Pages settings | Press Verify on `cardene.dev` |
| 4 | Cloudflare: `cardene.dev`, DNS, Records, Add record | Type `CNAME`, Name `musubi`, Target `<owner>.github.io` with the owner of this repository, Proxy status DNS only, then Save |

The `CNAME` record stays DNS only, because GitHub Pages issues the HTTPS certificate only when requests reach it directly.

After the first `pnpm site:publish`, point the repository's Pages at the branch and the domain.
Run these in this repository; `gh` fills in the owner and the name:

```bash
gh api --method POST "repos/{owner}/{repo}/pages" -f "source[branch]=gh-pages" -f "source[path]=/"
gh api --method PUT "repos/{owner}/{repo}/pages" -f cname=musubi.cardene.dev
```

When GitHub has issued the certificate, which can take up to a day, turn on HTTPS only:

```bash
gh api --method PUT "repos/{owner}/{repo}/pages" -F https_enforced=true
```

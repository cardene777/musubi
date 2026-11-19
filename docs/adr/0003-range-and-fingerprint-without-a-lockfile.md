# 0003. The range and the fingerprint sit together, without a lockfile

## Decision

How a consumer skill pins the content it follows, and how it notices when that content is rewritten.

## Chosen

The consumer writes the semver range it accepts and the fingerprint of the content it last checked side by side in its `musubi.json`.
The fingerprint covers the content's file, its check, and the provider's `SKILL.md`, which the agent reads on the way.
`musubi check` compares fingerprints after installs and updates, stops naming the consumer when they differ, and rewrites a fingerprint only after the re-check passes.
The consumer's body also tells the agent to compare fingerprints before reading when the musubi command is present.

## Rejected

| Option | Why not |
|---|---|
| The range in `musubi.json` and the checked versions and fingerprints in `musubi.lock` | A consumer would have two places to read |
| A fingerprint alone | Fixes would not arrive until the fingerprint is rewritten |
| A range alone | A rewrite inside the range would go unnoticed |
| Comparing fingerprints only at check time | An installer that updates skills on its own can change content after the check |
| Signing content | Every provider would have to manage keys |

## Grounds

- npm's `integrity` field and the Agent Skills lockfile proposal #210 record `sha256` digests in the same subresource integrity format (researched in cardene777/musubi#3).
- cardene777/musubi#3, decision table, rounds 2 and 4.

## Date

2026-11-19

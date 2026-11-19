# Glossary

| Term | Meaning |
|---|---|
| provider skill | A skill that provides content for other skills to follow, listed under `provides` in its `musubi.json` |
| consumer skill | A skill that follows content another skill provides, listed under `follows` in its `musubi.json` |
| content | One file a provider skill offers, such as a document format or writing rules, with at most one check. It is named `<skill>/<name>`, for example `design-doc/design`, and has its own version |
| `musubi.json` | The declaration file next to `SKILL.md` that lists the content a skill provides and the content it follows |
| check | Rules written in JSON, such as required headings and their order, text that must not remain, and required table columns, that `musubi check` applies to a consumer's examples. A check never runs provider code |
| example | A file a consumer names in `musubi.json` for checks to run against, such as its own template |
| fingerprint | A `sha256-<base64>` digest of a content's file, its check, and the provider's `SKILL.md`, which the consumer writes next to the version range |
| version range | The semver range of content versions a consumer accepts, such as `^1.0.0` |
| definition version | The date of the musubi definition a `musubi.json` follows, written as `"musubi": "2026-11-19"` |

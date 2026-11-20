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
| optional follow | A follow with `optional: true`, written by a consumer that also works without the provider. When the provider is not installed, the agent goes on without the content and `musubi check` skips the follow |
| condition | The `when` field of an optional follow, such as `"when": { "languages": ["ja"] }`. `musubi install` installs the provider of the follow when a language the user gives with `--lang` matches |
| source | A folder or git repository that the user names with `--from`, in which `musubi install` finds a skill by its folder name |
| version range | The semver range of content versions a consumer accepts, such as `^1.0.0` |
| definition version | The date of the musubi definition a `musubi.json` follows, written as `"musubi": "2026-11-19"` |
| registry entry | The file `registry/<owner>/<repo>.json` in this repository that lists the folders of one of the maintainers' repositories to show on the site |
| topic `musubi-skills` | The GitHub topic an author gives a public repository so that the site finds the skills in it at its next update |

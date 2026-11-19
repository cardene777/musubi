# musubi

musubi is a proposal for binding the content of one agent skill to another.

Package managers for agent skills already install a skill together with the skills it depends on and lock their versions.
What they do not record is which part of a dependency a skill follows: the document format it writes in, the writing rules it obeys, or the check it runs.
musubi lets a skill declare the content it provides under a name and a version, lets another skill declare that it follows that content, and lets an agent load the content when the skill runs, the same way in every agent that reads `SKILL.md`.
When the provided content changes, the skills that follow it are checked again.

The definition comes first and is being decided in this repository's issues.

Japanese: [README.ja.md](README.ja.md)

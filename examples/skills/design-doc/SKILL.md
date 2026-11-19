---
name: design-doc
description: Provides the shared format for design documents, so every skill that writes a design writes it the same way. Use when another skill says to write in the design format of the design-doc skill.
---

# Design document format

This skill provides content for other skills through musubi.
It does not write a design on its own.

| Content | File | Check |
|---|---|---|
| `design` | `formats/design.md` | `checks/design.json` |

The `design` format is in `formats/design.md`.
Copy it into the project and replace every `Fill in:` line.

A skill that follows the format may add its own sections between the required ones.
It keeps the required headings in their order, and the `Option`, `Chosen`, and `Why` columns of the decisions table.

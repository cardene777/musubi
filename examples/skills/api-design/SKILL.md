---
name: api-design
description: Designs an HTTP API with the user and writes one design document for it. Use when the user wants to plan the endpoints, data, and errors of an API before building it.
---

# API design

Write in the `design` format of the `design-doc` skill: open the `design-doc` skill by name and read the file it names for `design`.
If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.
If the `design-doc` skill is not installed, do not start: tell the user that `design-doc` is missing and how to install it, then stop.

Ask the user one question at a time about who calls the API, which resources it serves, and how it reports errors.
Then copy the format to `docs/design/<topic>.md`, add the sections in `templates/sections.md` after `## Purpose and scope`, and replace every `Fill in:` line.
`examples/orders-api.md` shows a finished design.

# 0004. Checks are JSON rules, not scripts

## Decision

In what form a provider skill writes the check that `musubi check` applies to consumers.

## Chosen

A check is a set of rules written in JSON, such as required headings and their order, text that must not remain (for example `Fill in:`), and required table columns.
`musubi check` reads the rules and applies them to the examples each consumer names.
No provider code runs on the consumer's machine, so a bad check cannot execute anything.
The definition fixes the kinds of rules a check may use, and new kinds are added to the definition when they are needed.

## Rejected

| Option | Why not |
|---|---|
| Scripts that `musubi check` runs | Provider code would run on the consumer's machine |
| JSON rules by default, scripts when the user allows them | A path for running provider code would remain |
| Asking a language model to judge | Results would change from run to run and each run would cost money |

## Grounds

- Fingerprints (ADR 0003) detect rewritten content but do not make running provider code safe.
- Issue #3, decision table, rounds 3 and 5.

## Date

2026-11-19

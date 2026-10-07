# Delta for Catalog List

## ADDED Requirements

### Requirement: Commands list shape

Text and JSON list output MUST include commands using the same grouping, sorting, and flat JSON rules as other kinds. JSON `kind` for a command MUST be the singular `command`, and `description` MUST be the frontmatter description.

#### Scenario: JSON command kind

- GIVEN catalog command `review` with description "Review a diff"
- WHEN `list --json` runs
- THEN an item exists with `"kind": "command"`, name `review`, and that description

#### Scenario: Search matches command

- GIVEN command `review`
- WHEN `list commands --search DIFF` runs
- THEN `review` is listed

## MODIFIED Requirements

### Requirement: Kind filter

`list` MUST accept an optional positional `kind` of `mcps`, `skills`, `profiles`, `scripts`, or `commands` (plural only, no aliases). Without it, all five kinds MUST be listed. An invalid kind MUST be rejected by commander's choices validation.
(Previously: mcps, skills, profiles, scripts; four kinds)

#### Scenario: No kind lists all

- GIVEN a catalog with MCPs, skills, profiles, scripts, and commands
- WHEN `shitaku list` runs
- THEN items of all five kinds are listed

#### Scenario: Single kind

- GIVEN the same catalog
- WHEN `shitaku list skills` or `shitaku list commands` runs
- THEN only that kind is listed

#### Scenario: Invalid kind

- WHEN `shitaku list widgets` runs
- THEN it exits non-zero with a commander error and lists nothing
- AND the exact exit code under `exitOverride` is pinned by design/tests

#### Scenario: Empty commands kind

- GIVEN a catalog with no commands
- WHEN `shitaku list commands` runs
- THEN it prints `no matching items` and exits 0

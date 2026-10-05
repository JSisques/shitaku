# Delta for Catalog List

## MODIFIED Requirements

### Requirement: Kind filter

`list` MUST accept an optional positional `kind` of `mcps`, `skills`, `profiles`, or `scripts` (plural only, no aliases). Without it, all four kinds MUST be listed. An invalid kind MUST be rejected by commander's choices validation.
(Previously: only mcps, skills, profiles)

#### Scenario: No kind lists all

- GIVEN a catalog with MCPs, skills, profiles, and scripts
- WHEN `shitaku list` runs
- THEN items of all four kinds are listed

#### Scenario: Single kind

- GIVEN a catalog with MCPs, skills, profiles, and scripts
- WHEN `shitaku list skills` or `shitaku list scripts` runs
- THEN only that kind is listed

#### Scenario: Invalid kind

- WHEN `shitaku list widgets` runs
- THEN it exits non-zero with a commander error and lists nothing
- AND the exact exit code under `exitOverride` is pinned by design/tests

## ADDED Requirements

### Requirement: Scripts list shape

Text and JSON list output MUST include scripts using the same grouping and flat JSON rules as other kinds. JSON `kind` for a script MUST be the singular `script`.

#### Scenario: JSON script kind

- GIVEN catalog script `demo`
- WHEN `list --json` runs
- THEN an item exists with `"kind": "script"` and name `demo`

# Delta for Catalog List

## ADDED Requirements

### Requirement: Hooks list shape

Text and JSON list output MUST include hooks using the same grouping, sorting, and flat JSON rules as other kinds. JSON `kind` for a hook MUST be the singular `hook`, and `description` MUST be the hook description.

#### Scenario: JSON hook kind

- GIVEN catalog hook `fmt` with description "Format after edits"
- WHEN `list --json` runs
- THEN an item exists with `"kind": "hook"`, name `fmt`, and that description

#### Scenario: Search matches hook

- GIVEN hook `fmt`
- WHEN `list hooks --search FORMAT` runs
- THEN `fmt` is listed

## MODIFIED Requirements

### Requirement: Kind filter

`list` MUST accept an optional positional `kind` of `mcps`, `skills`, `profiles`, `scripts`, `commands`, or `hooks` (plural only, no aliases). Without it, all six kinds MUST be listed. An invalid kind MUST be rejected by commander's choices validation.
(Previously: mcps, skills, profiles, scripts, commands; five kinds)

#### Scenario: No kind lists all

- GIVEN a catalog with MCPs, skills, profiles, scripts, commands, and hooks
- WHEN `shitaku list` runs
- THEN items of all six kinds are listed

#### Scenario: Single kind

- GIVEN the same catalog
- WHEN `shitaku list skills` or `shitaku list hooks` runs
- THEN only that kind is listed

#### Scenario: Invalid kind

- WHEN `shitaku list widgets` runs
- THEN it exits non-zero with a commander error and lists nothing
- AND the exact exit code under `exitOverride` is pinned by design/tests

#### Scenario: Empty hooks kind

- GIVEN a catalog with no hooks
- WHEN `shitaku list hooks` runs
- THEN it prints `no matching items` and exits 0

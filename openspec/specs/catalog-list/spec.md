# Catalog List Specification

## Purpose

A read-only `shitaku list [kind]` command that shows the MCPs, skills, and profiles a catalog offers, as grouped text or versioned JSON.

## Requirements

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

### Requirement: Search

`--search <text>` MUST keep only items whose name OR description contains `<text>` as a case-insensitive substring. It MUST combine with the kind filter.

#### Scenario: Match on description

- GIVEN skill `demo` with description "Browser automation"
- WHEN `list --search BROWSER` runs
- THEN `demo` is listed

#### Scenario: Match on name, narrowed by kind

- GIVEN MCP `fs` and skill `fs-tips`
- WHEN `list mcps --search fs` runs
- THEN only MCP `fs` is listed

### Requirement: Plain output

Text output MUST group items by kind, each group with a header and an aligned name column followed by the description. Whitespace in descriptions MUST be collapsed to single spaces. A profile without a description MUST print its name only. Items MUST always show their kind via the group header. Within a group, items MUST be sorted by name.

#### Scenario: Grouped and aligned

- GIVEN MCPs `fs` and `github-tools` with descriptions
- WHEN `list mcps` runs
- THEN an MCPs header is followed by both names padded to one column, then descriptions

#### Scenario: Multi-line description

- GIVEN a description containing newlines
- WHEN `list` runs in text mode
- THEN it prints on one line with collapsed whitespace

#### Scenario: Profile without description

- GIVEN profile `base` with no description
- WHEN `list profiles` runs
- THEN the line contains `base` only

### Requirement: Empty result

When nothing matches, `list` MUST exit 0. Text mode MUST print `no matching items`; JSON mode MUST emit `items: []`.

#### Scenario: No match

- GIVEN any catalog
- WHEN `list --search zzz-nothing` runs
- THEN it prints `no matching items` and exits 0

#### Scenario: No match in JSON

- WHEN `list --json --search zzz-nothing` runs
- THEN stdout is `{ "version": 1, "items": [] }` and the exit code is 0

### Requirement: JSON output

`--json` MUST print pretty-printed JSON `{ "version": 1, "items": [...] }`. `items` MUST be flat; each entry MUST be `{ kind, name, description }` with `description` a string or `null`. Entries MUST be sorted by kind, then name. Future changes MUST be additive. stdout MUST contain only the JSON document.

| Field         | Type           | Notes                            |
| ------------- | -------------- | -------------------------------- |
| `version`     | number         | Always `1`                       |
| `kind`        | string         | Singular, like `status` (`mcp`)  |
| `name`        | string         | Item name                        |
| `description` | string or null | `null` for a profile without one |

#### Scenario: Sorted flat shape

- GIVEN MCP `b`, MCP `a`, and a skill `c`
- WHEN `list --json` runs
- THEN `items` is flat and ordered by kind, then name (`a`, `b` before `c`)

#### Scenario: Null description

- GIVEN profile `base` with no description
- WHEN `list --json` runs
- THEN its entry has `"description": null`

### Requirement: Catalog source and failures

`--source <folder>` MUST load the catalog from that folder instead of the bundled one. Catalog issues MUST print to stderr as warnings in both modes. If the catalog cannot be loaded, `list` MUST print `error: cannot load catalog from <where>: <msg>` to stderr and exit 1. `list` MUST NOT write to the filesystem.

#### Scenario: Custom source

- GIVEN a folder catalog with one skill
- WHEN `list --source <folder>` runs
- THEN only that catalog's items are listed

#### Scenario: Warnings keep JSON pure

- GIVEN a catalog with a skipped invalid item
- WHEN `list --json` runs
- THEN the warning is on stderr and stdout parses as JSON

#### Scenario: Load failure

- GIVEN `--source` points to a folder without a valid `catalog.json`
- WHEN `list` runs
- THEN the error line is printed to stderr and the exit code is 1

### Requirement: Scripts list shape

Text and JSON list output MUST include scripts using the same grouping and flat JSON rules as other kinds. JSON `kind` for a script MUST be the singular `script`.

#### Scenario: JSON script kind

- GIVEN catalog script `demo`
- WHEN `list --json` runs
- THEN an item exists with `"kind": "script"` and name `demo`

# Delta for Catalog List

## ADDED Requirements

### Requirement: Rules list shape

Text and JSON list output MUST include rules using the same grouping, sorting, and flat JSON rules as other kinds. JSON `kind` for a rule MUST be the singular `rule`, and `description` MUST be the frontmatter description.

#### Scenario: JSON rule kind

- GIVEN catalog rule `no-secrets` with description "Never commit secrets"
- WHEN `list --json` runs
- THEN an item exists with `"kind": "rule"`, name `no-secrets`, and that description

#### Scenario: Search matches rule

- GIVEN rule `no-secrets`
- WHEN `list rules --search SECRETS` runs
- THEN `no-secrets` is listed

## MODIFIED Requirements

### Requirement: Kind filter

`list` MUST accept an optional positional `kind` of `mcps`, `skills`, `profiles`, `scripts`, `commands`, `hooks`, `agents`, or `rules` (plural only, no aliases). Without it, all eight kinds MUST be listed. An invalid kind MUST be rejected by commander's choices validation.
(Previously: seven kinds, without rules)

#### Scenario: No kind lists all

- GIVEN a catalog with every kind including rules
- WHEN `shitaku list` runs
- THEN items of all eight kinds are listed

#### Scenario: Single kind

- GIVEN the same catalog
- WHEN `shitaku list rules` runs
- THEN only rules are listed

#### Scenario: Invalid kind

- WHEN `shitaku list widgets` runs
- THEN it exits non-zero with a commander error and lists nothing

#### Scenario: Empty rules kind

- GIVEN a catalog with no rules
- WHEN `shitaku list rules` runs
- THEN it prints `no matching items` and exits 0

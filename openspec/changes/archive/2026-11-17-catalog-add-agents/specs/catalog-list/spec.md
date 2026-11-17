# Delta for Catalog List

## ADDED Requirements

### Requirement: Agents list shape

Text and JSON list output MUST include agents using the same grouping, sorting, and flat JSON rules as other kinds. JSON `kind` for an agent MUST be the singular `agent`, and `description` MUST be the frontmatter description.

#### Scenario: JSON agent kind

- GIVEN catalog agent `reviewer` with description "Review code"
- WHEN `list --json` runs
- THEN an item exists with `"kind": "agent"`, name `reviewer`, and that description

#### Scenario: Search matches agent

- GIVEN agent `reviewer`
- WHEN `list agents --search REVIEW` runs
- THEN `reviewer` is listed

## MODIFIED Requirements

### Requirement: Kind filter

`list` MUST accept an optional positional `kind` of `mcps`, `skills`, `profiles`, `scripts`, `commands`, `hooks`, or `agents` (plural only, no aliases). Without it, all seven kinds MUST be listed. An invalid kind MUST be rejected by commander's choices validation.
(Previously: six kinds, without agents)

#### Scenario: No kind lists all

- GIVEN a catalog with every kind including agents
- WHEN `shitaku list` runs
- THEN items of all seven kinds are listed

#### Scenario: Single kind

- GIVEN the same catalog
- WHEN `shitaku list agents` runs
- THEN only agents are listed

#### Scenario: Invalid kind

- WHEN `shitaku list widgets` runs
- THEN it exits non-zero with a commander error and lists nothing

#### Scenario: Empty agents kind

- GIVEN a catalog with no agents
- WHEN `shitaku list agents` runs
- THEN it prints `no matching items` and exits 0

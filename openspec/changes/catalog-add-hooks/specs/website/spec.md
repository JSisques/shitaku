# Delta for Website

## ADDED Requirements

### Requirement: Hook catalog pages

The emitter MUST generate hook pages from `catalog/hooks/` in `/en/` and `/es/`, with check mode failing on drift. Each page MUST show event, matcher, command, and timeout, and a warning that hooks execute code. Hand-written CLI docs MUST document `--hooks`, the dedicated confirmation flag, `list hooks`, and `uninstall --kind hook`. The security page (en and es) MUST state that hook commands execute code with full user permissions, that hooks contain no literal secrets, and that `--source` hooks are covered by the same trust model and confirmation. Docs MUST describe the hook file format. An empty hook catalog MUST still generate valid pages.

#### Scenario: Generated and checked

- GIVEN a hook in `catalog/hooks/`
- WHEN the emitter runs
- THEN en and es pages exist and check mode passes; editing the source without regenerating fails check

#### Scenario: Empty hook catalog

- GIVEN no hooks in the catalog
- WHEN the emitter and check run
- THEN they succeed

#### Scenario: Security note and flags documented

- GIVEN the CLI docs and security page
- WHEN read in both locales
- THEN `--hooks`, the confirmation flag, and the three security points are covered

## MODIFIED Requirements

### Requirement: Catalog emitter and profiles

MCP/skill/script/command/hook/profile pages MUST emit from `catalog/` with check mode that fails on drift. Profiles MUST be browse-only with explicit not-installable callout, and MUST show their `hooks` list. Pages MUST show placeholders/env names only, never invented secrets.
(Previously: MCP/skill/script/command/profile pages only)

#### Scenario: Drift and profiles

- GIVEN source drift or a profile page
- WHEN check runs / page is read
- THEN check fails on drift and profile shows not-installable callout and its hooks

# Delta for Website

## ADDED Requirements

### Requirement: Command catalog pages

The emitter MUST generate command pages from `catalog/commands/` in `/en/` and `/es/`, with check mode failing on drift. Pages MUST say "slash commands" to avoid confusion with CLI subcommands. Hand-written CLI docs (commands, flags, overview) MUST document `--commands`, `list commands`, and `uninstall --kind command`. Profile pages MUST show their `commands` list and keep the not-installable callout. An empty command catalog MUST still generate valid pages.

#### Scenario: Generated and checked

- GIVEN a command in `catalog/commands/`
- WHEN the emitter runs
- THEN en and es pages exist and check mode passes; editing the source without regenerating fails check

#### Scenario: Empty command catalog

- GIVEN no commands in the catalog
- WHEN the emitter and check run
- THEN they succeed

#### Scenario: Flags documented

- GIVEN the CLI docs
- WHEN read
- THEN `--commands` and `uninstall --kind command` are covered in both locales

## MODIFIED Requirements

### Requirement: Catalog emitter and profiles

MCP/skill/script/command/profile pages MUST emit from `catalog/` with check mode that fails on drift. Profiles MUST be browse-only with explicit not-installable callout. Pages MUST show placeholders/env names only, never invented secrets.
(Previously: MCP/skill/profile pages only)

#### Scenario: Drift and profiles

- GIVEN source drift or a profile page
- WHEN check runs / page is read
- THEN check fails on drift and profile shows not-installable callout

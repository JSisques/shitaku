# Website Specification

## Purpose

Public landing + docs on GitHub Pages, isolated from CLI release CI/CD.

## Requirements

### Requirement: Nested website package

Repo MUST host site under `website/` with own `package.json`. MUST NOT join a pnpm workspace now. Website MUST NOT be in root package `files`.

#### Scenario: Nested package

- GIVEN checkout
- WHEN `website/package.json` is inspected
- THEN nested package exists and is not a workspace member

#### Scenario: Not published

- GIVEN root `files`
- WHEN publish set is evaluated
- THEN `website/` is excluded

### Requirement: Pages subpath and locales

Site MUST use base `/shitaku/`. Locales MUST be prefixed `/en/` and `/es/`. English MUST NOT be unprefixed root locale.

#### Scenario: Base and prefixes

- GIVEN production build/deploy
- WHEN URLs are inspected
- THEN assets/pages resolve under `/shitaku/` with `/en/` and `/es/`

### Requirement: Landing and CLI docs

Site MUST provide landing with one-command getting started plus docs for getting started, full CLI (`init`, `undo`, `uninstall`, `status`, `list`, `doctor`, `version`, flags, exit codes), and security. MUST NOT document agents or releasing docs as product pages.

#### Scenario: Landing and CLI coverage

- GIVEN landing and CLI docs
- WHEN read
- THEN one-command path exists and all listed commands/flags/exit codes are covered

### Requirement: Spanish chrome; English catalog copy

`/es/` chrome/nav MUST be Spanish. Catalog item descriptions MUST stay English from `catalog/`. MUST NOT require translated catalog descriptions.

#### Scenario: Chrome vs descriptions

- GIVEN `/es/` catalog item page
- WHEN rendered
- THEN nav is Spanish and description matches English `catalog/` source

### Requirement: Catalog emitter and profiles

MCP/skill/script/command/profile pages MUST emit from `catalog/` with check mode that fails on drift. Profiles MUST be browse-only with explicit not-installable callout. Pages MUST show placeholders/env names only, never invented secrets.
(Previously: MCP/skill/profile pages only)

#### Scenario: Drift and profiles

- GIVEN source drift or a profile page
- WHEN check runs / page is read
- THEN check fails on drift and profile shows not-installable callout

### Requirement: Isolated website workflow and root gates

Build/deploy MUST use only `.github/workflows/website.yml`. MUST NOT add root `website:build` gate. Root lint/format/typecheck/test/build MUST stay green via ignores/config without website as release dependency. CONTRIBUTING MUST note catalog→website refresh. README MAY link live site. MUST NOT ship #78 badge. `src/` MUST NOT change for this capability.

#### Scenario: Isolation and docs

- GIVEN workflows, root gates, and docs
- WHEN inspected
- THEN website.yml owns Pages; `ci.yml`/`cd.yml` unused for it; CLI gates pass; CONTRIBUTING has refresh note; no #78 badge; no `src/` website changes

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

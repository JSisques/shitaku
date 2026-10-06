# Delta for Scripts Install

## RENAMED Requirements

### Requirement: Bundled complexity script → Bundled catalog scripts

(Reason: Catalog now ships multiple concrete scripts.)
(Migration: Update guards/tests/docs that asserted complexity-only registration to expect `complexity` and `dead-code`.)

## MODIFIED Requirements

### Requirement: Bundled catalog scripts

Bundled catalog MUST list `complexity` and `dead-code` in `items.scripts` and MUST ship `catalog/scripts/complexity/` (`index.mjs`, validated metadata, shipped ESLint flat config) and `catalog/scripts/dead-code/` (`index.mjs`, validated metadata, no shipped npm deps or script-root bootstrap). Concrete scripts MAY ship; the prior no-concrete-scripts constraint MUST NOT apply.
(Previously: Only required `complexity` and its ESLint flat config tree.)

#### Scenario: Registered and loadable

- GIVEN default catalog
- WHEN loaded
- THEN `complexity` and `dead-code` are valid and selectable

#### Scenario: Project install root complexity

- GIVEN init installs `complexity` with `--scope project`
- WHEN apply completes
- THEN tree under `<cwd>/.shitaku/scripts/complexity/` includes `index.mjs` and shipped config

#### Scenario: Project install root dead-code

- GIVEN init installs `dead-code` with `--scope project`
- WHEN apply completes
- THEN tree under `<cwd>/.shitaku/scripts/dead-code/` includes `index.mjs` without script-root npm bootstrap

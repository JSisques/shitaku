# Delta for Scripts Install

## MODIFIED Requirements

### Requirement: Bundled catalog scripts

Bundled catalog MUST list `complexity`, `dead-code`, and `duplication` in `items.scripts` and MUST ship `catalog/scripts/complexity/` (`index.mjs`, validated metadata, shipped ESLint flat config), `catalog/scripts/dead-code/` (`index.mjs`, validated metadata, no shipped npm deps or script-root bootstrap), and `catalog/scripts/duplication/` (`index.mjs`, validated metadata, no shipped npm deps or script-root bootstrap). Concrete scripts MAY ship; the prior no-concrete-scripts constraint MUST NOT apply.
(Previously: Only `complexity` and `dead-code`.)

#### Scenario: Registered and loadable

- GIVEN default catalog
- WHEN loaded
- THEN `complexity`, `dead-code`, and `duplication` are valid and selectable

#### Scenario: Project install root complexity

- GIVEN init installs `complexity` with `--scope project`
- WHEN apply completes
- THEN tree under `<cwd>/.shitaku/scripts/complexity/` includes `index.mjs` and shipped config

#### Scenario: Project install root dead-code

- GIVEN init installs `dead-code` with `--scope project`
- WHEN apply completes
- THEN tree under `<cwd>/.shitaku/scripts/dead-code/` includes `index.mjs` without script-root npm bootstrap

#### Scenario: Project install root duplication

- GIVEN init installs `duplication` with `--scope project`
- WHEN apply completes
- THEN tree under `<cwd>/.shitaku/scripts/duplication/` includes `index.mjs` without script-root npm bootstrap

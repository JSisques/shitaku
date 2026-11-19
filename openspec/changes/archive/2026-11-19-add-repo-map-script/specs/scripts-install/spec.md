# Delta for Scripts Install

## MODIFIED Requirements

### Requirement: Bundled catalog scripts

Bundled catalog MUST list `complexity`, `dead-code`, `duplication`, and `repo-map` in `items.scripts` and MUST ship `catalog/scripts/complexity/` (`index.mjs`, validated metadata, shipped ESLint flat config), `catalog/scripts/dead-code/` (`index.mjs`, validated metadata, no shipped npm deps or script-root bootstrap), `catalog/scripts/duplication/` (`index.mjs`, validated metadata, no shipped npm deps or script-root bootstrap), and `catalog/scripts/repo-map/` (`index.mjs`, flat helper `.mjs` modules with no `lib/` subdirectory, validated metadata, no shipped npm deps or script-root bootstrap). A multi-file script directory MUST be copied as-is on install. Concrete scripts MAY ship; the prior no-concrete-scripts constraint MUST NOT apply.
(Previously: `complexity`, `dead-code`, and `duplication` only.)

#### Scenario: Registered and loadable

- GIVEN default catalog
- WHEN loaded
- THEN `complexity`, `dead-code`, `duplication`, and `repo-map` are valid and selectable

#### Scenario: Project install root repo-map

- GIVEN init installs `repo-map` with `--scope project`
- WHEN apply completes
- THEN tree under `<cwd>/.shitaku/scripts/repo-map/` includes `index.mjs` and all helper `.mjs` modules without script-root npm bootstrap

#### Scenario: Existing siblings unchanged

- GIVEN init installs `complexity`, `dead-code`, or `duplication` with `--scope project`
- WHEN apply completes
- THEN their install trees match the prior behavior (`index.mjs`, shipped config for `complexity`, no script-root npm bootstrap for the others)

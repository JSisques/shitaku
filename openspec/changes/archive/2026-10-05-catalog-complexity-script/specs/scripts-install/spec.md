# Delta for Scripts Install

## REMOVED Requirements

### Requirement: Empty structure

(Reason: First concrete catalog script `complexity` ships.)
(Migration: Flip empty `items.scripts` / empty `catalog/scripts/` guards, tests, and docs to expect `complexity`.)

## ADDED Requirements

### Requirement: Bundled complexity script

Bundled catalog MUST list `complexity` in `items.scripts` and MUST ship `catalog/scripts/complexity/` with `index.mjs`, validated metadata, and shipped ESLint flat config. Concrete scripts MAY ship; the prior no-concrete-scripts constraint MUST NOT apply.

#### Scenario: Registered and loadable

- GIVEN default catalog
- WHEN loaded
- THEN `complexity` is valid and selectable

#### Scenario: Project install root

- GIVEN init installs `complexity` with `--scope project`
- WHEN apply completes
- THEN tree is under `<cwd>/.shitaku/scripts/complexity/` including `index.mjs` and shipped config

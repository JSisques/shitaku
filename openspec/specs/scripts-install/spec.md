# Scripts Install Specification

## Purpose

Plan/apply/undo script trees under shitaku roots. Structure only; no concrete scripts.

## Requirements

### Requirement: Script install roots

Project MUST install to `<cwd>/.shitaku/scripts/<name>/`; user to `stateDir(home)/scripts/<name>/`. MUST NOT use agent skill dirs. Files MUST be byte-identical.

#### Scenario: Project and user roots

- GIVEN `--scope project` or `user`
- WHEN init applies script `demo`
- THEN files land under the matching shitaku scripts root

### Requirement: Plan, conflict, dry-run, force

Plan MUST classify by tree hash: create|skip|update|conflict. Conflicts MUST show in the plan; non-interactive without `--force` MUST write nothing and exit 2. `--dry-run` MUST print plan only. `--force` MUST backup then whole-tree replace.

#### Scenario: Conflict refused

- GIVEN unmanaged different target and `--yes` without `--force`
- WHEN init runs
- THEN exit 2 and no writes

#### Scenario: Dry-run and force

- GIVEN `--dry-run` or `--force` on a conflict
- WHEN init runs
- THEN plan-only no writes, or backup then catalog-equal tree

### Requirement: Selection and undo

`--scripts` MUST select by name; unknown MUST exit non-zero write nothing. Init prompts MUST offer scripts. Undo MUST remove shitaku-written files/dirs, restore forced backups, refuse drift without `--force`.

#### Scenario: Unknown and clean undo

- GIVEN `--scripts ghost`, or unchanged installed `demo`
- WHEN init or undo runs
- THEN non-zero naming ghost, or `demo/` removed and manifest cleared

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

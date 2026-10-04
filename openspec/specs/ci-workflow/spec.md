# CI Workflow Specification

## Purpose

Defines the pull request validation workflow `.github/workflows/ci.yml`: its trigger, permissions, toolchain resolution, ordered gate steps, caching, failure semantics and the stable `ci` check name.

## Requirements

### Requirement: Trigger

`ci.yml` MUST run on `pull_request` events targeting `main` and MUST also be callable via `workflow_call`. It MUST NOT use `push` triggers (the `CD` workflow is dispatched manually and reuses `ci.yml`), matrix builds or `paths`/`paths-ignore` filters. It SHOULD cancel superseded runs for the same ref and MUST bound runtime with `timeout-minutes`. It MUST keep exactly one job `ci` and `permissions: contents: read`.
(Previously: only `pull_request`; `workflow_call` not allowed for reuse.)

#### Scenario: PR to main triggers the workflow

- GIVEN a pull request targeting `main`
- WHEN it is opened or updated
- THEN the workflow runs and reports a check

#### Scenario: Reused by CD

- GIVEN `cd.yml` job `ci` uses `./.github/workflows/ci.yml`
- WHEN `CD` is dispatched on `main`
- THEN the single `ci` job runs with `contents: read` only

#### Scenario: Docs-only PR still runs

- GIVEN a PR changing only markdown files
- WHEN it is opened
- THEN the `ci` job still runs and is not skipped

#### Scenario: Superseded run is cancelled

- GIVEN a run is in progress for a PR
- WHEN a new commit is pushed to that PR
- THEN the earlier run is cancelled

### Requirement: Least-privilege permissions

The workflow MUST declare `permissions: contents: read` and MUST NOT grant any other permission.

#### Scenario: Read-only token

- GIVEN the workflow file
- WHEN its permissions are inspected
- THEN only `contents: read` is declared

### Requirement: Stable job name

The workflow MUST contain exactly one job, named `ci`, so the check name is stable for required-check configuration. The job MUST NOT carry job-level `if` conditions that skip it.

#### Scenario: Single stable check

- GIVEN a PR run completes
- WHEN the checks are listed
- THEN exactly one check from this workflow is named `ci`

### Requirement: Toolchain resolution

Node MUST be resolved from `.nvmrc` via `actions/setup-node` `node-version-file`. pnpm MUST be resolved from the `packageManager` field via `pnpm/action-setup` without a `version` input. `pnpm/action-setup` MUST run before `actions/setup-node`.

#### Scenario: Versions come from the repository

- GIVEN `.nvmrc` and `packageManager` define the versions
- WHEN the workflow runs
- THEN Node and pnpm match those files and no version is hardcoded in the workflow

### Requirement: Dependency caching and install

`actions/setup-node` MUST enable `cache: pnpm`. Dependencies MUST be installed with `pnpm install --frozen-lockfile`.

#### Scenario: Lockfile drift fails

- GIVEN `pnpm-lock.yaml` does not match `package.json`
- WHEN the install step runs
- THEN it fails and later steps do not run

### Requirement: Ordered gate steps

After install, the job MUST run these steps in order: lint, format:check, typecheck, test, build, smoke:pack. `smoke:pack` MUST run after `build`.

#### Scenario: Clean PR passes all gates

- GIVEN a PR with no violations
- WHEN the job runs
- THEN all six gate steps run in the stated order and the job succeeds

#### Scenario: Smoke pack follows build

- GIVEN `smoke:pack` needs `dist/`
- WHEN the job runs
- THEN `build` completes before `smoke:pack` starts

### Requirement: Failure semantics

Any failing step MUST fail the job and MUST stop subsequent steps. Steps MUST NOT use `continue-on-error`.

#### Scenario: Failing gate fails the job

- GIVEN a PR with a lint, format, typecheck, test or build failure
- WHEN the job runs
- THEN the failing step fails the `ci` check and later steps are skipped

### Requirement: Workflow file formatting

The workflow file MUST pass `prettier --check .`.

#### Scenario: Format gate passes with workflow present

- GIVEN `.github/workflows/ci.yml` exists
- WHEN `pnpm run format:check` runs
- THEN it exits 0

### Requirement: Website excluded from CI gates

`ci.yml` MUST NOT add website build, website install, or Pages deploy as a gate. Existing ordered gates MUST stay unchanged by website work.

#### Scenario: No website step

- GIVEN `ci.yml`
- WHEN steps are inspected
- THEN no website build/install/Pages deploy step exists

#### Scenario: Website-only PR still runs CI

- GIVEN PR changing only `website/`
- WHEN targeting `main`
- THEN `ci` still runs CLI gates (no path-skip)

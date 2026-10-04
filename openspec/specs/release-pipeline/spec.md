# Release Pipeline Specification

## Purpose

Defines the automated release of `@jsisques/shitaku` through `.github/workflows/cd.yml` and semantic-release: triggers, permissions, versioning, changelog, dual-registry publish and the bootstrap prerequisite.

## Requirements

### Requirement: CD workflow structure

`cd.yml` (name `CD`) MUST trigger only on `workflow_dispatch` with a boolean input `dry_run` (default `false`); it MUST NOT trigger on `push`. It MUST contain job `ci`, which reuses `ci.yml`, and job `release`, which declares `needs: ci` and runs only when `github.ref == 'refs/heads/main'`. When `dry_run` is true, `release` MUST run `semantic-release --dry-run`.

#### Scenario: Dispatch on main runs CI then release

- GIVEN `CD` is dispatched on `main` with `dry_run` false
- WHEN `CD` runs
- THEN `ci` runs `ci.yml` first and `release` starts only after `ci` succeeds

#### Scenario: Merge to main publishes nothing

- GIVEN a pull request is merged to `main`
- WHEN workflows are evaluated
- THEN `CD` does not run and nothing is published

#### Scenario: Dry run publishes nothing

- GIVEN `CD` is dispatched on `main` with `dry_run` true
- WHEN `release` runs
- THEN semantic-release reports the next version only
- AND no commit or tag is pushed, no GitHub Release is created, and no registry receives a publish (including GitHub Packages)

#### Scenario: Dispatch from another branch is blocked

- GIVEN `CD` is dispatched from a branch other than `main`
- WHEN `CD` runs
- THEN `release` is skipped and nothing is published

#### Scenario: Failing CI blocks release

- GIVEN the reused `ci` job fails
- WHEN `CD` runs
- THEN `release` does not run and nothing is published

### Requirement: Least-privilege permissions

Job `ci` MUST hold only `contents: read`. Only job `release` MUST hold `contents`, `issues`, `pull-requests` and `packages` write plus `id-token: write`.

#### Scenario: Permissions inspected

- GIVEN `cd.yml`
- WHEN job permissions are inspected
- THEN `ci` has only `contents: read` and write scopes exist only on `release`

### Requirement: Release job execution settings

`release` MUST use a concurrency group with `cancel-in-progress` not enabled, MUST check out with `fetch-depth: 0`, MUST NOT set `registry-url` on `actions/setup-node`, and MUST explicitly install npm >= 11.5.1 before publishing. Publishing MUST use npm, not pnpm.

#### Scenario: Overlapping dispatches

- GIVEN a release run is in progress
- WHEN `CD` is dispatched again on `main`
- THEN the running release is not cancelled

#### Scenario: Full history and npm version

- GIVEN `release` runs
- WHEN semantic-release starts
- THEN full git history and tags are available and `npm --version` is >= 11.5.1

### Requirement: Version derivation

The system MUST use semantic-release v25, deriving the version from conventional commits since the last tag. `feat` and `fix` commits MUST publish a release; `chore` and `docs` commits MUST publish nothing. The first version is `0.1.0` (bootstrap); afterwards standard semver applies using the default commit-analyzer rules (no custom `releaseRules`): `fix` bumps patch, `feat` bumps minor, and a breaking change (`!` in the header or a `BREAKING CHANGE:` footer) bumps major. The generated changelog MUST list BREAKING CHANGES.

#### Scenario: Fix publishes

- GIVEN a `fix` commit accumulated on `main` since the last tag
- WHEN `release` runs with `dry_run` false
- THEN a new version is published

#### Scenario: Breaking change yields major bump

- GIVEN the last release tag is `v0.1.0`
- AND a commit `feat!: ...` (or a commit with a `BREAKING CHANGE:` footer) accumulated on `main`
- WHEN `release` runs
- THEN the next version is `1.0.0`

#### Scenario: Feat yields minor bump

- GIVEN the last release tag is `v0.1.0` and only `feat` commits accumulated
- WHEN `release` runs
- THEN the next version is `0.2.0`

#### Scenario: Fix yields patch bump

- GIVEN the last release tag is `v0.1.0` and only `fix` commits accumulated
- WHEN `release` runs
- THEN the next version is `0.1.1`

#### Scenario: Chore publishes nothing

- GIVEN only `chore` or `docs` commits accumulated since the last tag
- WHEN `release` runs
- THEN no version, tag, release or publish is produced

### Requirement: Changelog and release commit

A release MUST update `CHANGELOG.md` and `package.json` and commit them back with message `chore(release): X [skip ci]`, and MUST create a GitHub Release.

#### Scenario: Release commit

- GIVEN version `X` is released
- WHEN the git step runs
- THEN a commit `chore(release): X [skip ci]` containing only `CHANGELOG.md` and `package.json` is pushed
- AND a GitHub Release for `X` exists
- AND the commit does not retrigger `CD`

### Requirement: npm publish

npm publish MUST use Trusted Publishers (OIDC) with provenance, and MUST NOT use `NPM_TOKEN`; no `NPM_TOKEN` secret MUST be referenced.

#### Scenario: Tokenless provenance

- GIVEN a release is published
- WHEN the npm package page is inspected
- THEN it shows provenance and no workflow references `NPM_TOKEN`

### Requirement: GitHub Packages publish

GitHub Packages publish MUST authenticate with `GITHUB_TOKEN` and receive the registry per command. `publishConfig` MUST remain registry-less. npm MUST be published before GitHub Packages.

#### Scenario: Publish order and registry

- GIVEN a release is published
- WHEN publish steps run
- THEN the npm publish completes first, then GitHub Packages receives the registry via command argument and `package.json` `publishConfig` names no registry

### Requirement: Bootstrap prerequisite

Documentation MUST state the prerequisite: manual `0.1.0` publish, tag `v0.1.0`, and a trusted publisher on npmjs.com bound to repo `JSisques/shitaku` and workflow `cd.yml`. `cd.yml` MUST NOT be renamed.

#### Scenario: Bootstrap documented

- GIVEN the repository docs
- WHEN searched for release bootstrap
- THEN all three steps and the `cd.yml` immutability warning are present

### Requirement: Changelog formatting ignore

`CHANGELOG.md` MUST be listed in Prettier ignores so `format:check` passes on generated output.

#### Scenario: Generated changelog

- GIVEN a generated `CHANGELOG.md`
- WHEN `pnpm run format:check` runs
- THEN it exits 0

### Requirement: Issue #27 update

Issue #27 text MUST state OIDC replaces `NPM_TOKEN`, list the bootstrap prerequisite, and reword the acceptance criteria to: "Running the CD workflow on main publishes the accumulated feat/fix commits since the last tag to both registries and updates CHANGELOG.md; chore/docs-only history publishes nothing; least-privilege permissions."

#### Scenario: Issue text

- GIVEN issue #27
- WHEN read
- THEN it mentions OIDC instead of `NPM_TOKEN`, the bootstrap prerequisite, the manual-dispatch trigger and the reworded acceptance criteria
### Requirement: Website Pages excluded from CD

`cd.yml` MUST NOT call/reuse/depend on `website.yml` or Pages deploy. Release success MUST NOT require website deploy.

#### Scenario: No website dependency

- GIVEN `cd.yml`
- WHEN jobs/`uses`/`needs` inspected
- THEN no `website.yml` call or Pages wait

#### Scenario: Release without Pages

- GIVEN CD on `main`, `dry_run` false
- WHEN release succeeds
- THEN success does not require Pages deploy

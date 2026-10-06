# CLI Upgrade Specification

## Purpose

`shitaku upgrade` self-updates the CLI: fresh latest fetch, current→target display, spawn-or-print by method.

## Requirements

### Requirement: Upgrade command registration

The CLI MUST expose `upgrade` for self-update and MUST NOT register `update` (#46 out of scope). Docs MUST say it upgrades the CLI package, not catalog.

#### Scenario: upgrade registered, no update

- GIVEN a built CLI
- WHEN help lists commands
- THEN `upgrade` is present and no self-update `update` command is listed

### Requirement: Fresh latest-version fetch

`upgrade` MUST resolve the running version and MUST fetch latest via fresh `LatestVersionSource` (MUST NOT use only the notifier cache). On fetch failure MUST exit non-zero with a clear error and MUST NOT spawn.

#### Scenario: Fresh fetch

- GIVEN stale/empty update-check cache
- WHEN `shitaku upgrade` runs
- THEN target version comes from a fresh fetch

#### Scenario: Fetch failure

- GIVEN latest-version source fails
- WHEN `shitaku upgrade` runs
- THEN exit non-zero, failure explained, no PM spawn

### Requirement: Current-to-target display and already-latest

When newer, MUST show current→target before spawn or print. When already latest (or not newer), MUST exit 0 with clear already-latest message and MUST NOT spawn.

#### Scenario: Newer version

- GIVEN running `0.2.0`, latest `0.3.0`
- WHEN `shitaku upgrade` runs
- THEN output names current and target before the next action

#### Scenario: Already latest

- GIVEN running and latest both `0.3.0`
- WHEN `shitaku upgrade` runs
- THEN exit 0, already-up-to-date message, no PM spawn

### Requirement: Install-method spawn vs print-only policy

For `npm-global`/`pnpm-global` when upgrade needed, MUST spawn PM upgrade argv via `ProcessRunner` with `shell: false`. For `npx`/`unknown`, MUST print guidance only. Undetected installs MUST be `unknown` (yarn/bun/Homebrew out of scope).

#### Scenario: Global methods spawn without shell

- GIVEN `npm-global` or `pnpm-global`, older than latest
- WHEN `shitaku upgrade` runs
- THEN `ProcessRunner` runs that PM global upgrade argv with `shell: false`

#### Scenario: npx and unknown print-only

- GIVEN `npx` or `unknown`, older than latest
- WHEN `shitaku upgrade` runs
- THEN upgrade guidance is printed and no PM spawn occurs

### Requirement: Non-zero package-manager exit leaves install untouched

On non-zero spawned PM exit, CLI MUST exit non-zero, MUST state install unchanged with recovery guidance, and MUST NOT claim success.

#### Scenario: PM fails

- GIVEN global method and spawn exits non-zero
- WHEN `shitaku upgrade` runs
- THEN CLI exits non-zero, install unchanged, recovery explained

### Requirement: README and tests

README MUST document `shitaku upgrade` (spawn vs print-only, already-latest, CLI scope). Tests MUST cover fresh fetch, already-latest, global spawn `shell: false`, print-only for `npx`/`unknown`, and non-zero PM exit, without real network or home.

#### Scenario: README present

- GIVEN repository README
- WHEN upgrade docs are read
- THEN they name `shitaku upgrade`, spawn vs print-only, CLI scope

#### Scenario: Upgrade matrix

- GIVEN the test suite
- WHEN `pnpm test` runs
- THEN the matrix above runs with injected fakes

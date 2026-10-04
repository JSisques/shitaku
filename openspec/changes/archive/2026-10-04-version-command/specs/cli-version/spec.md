# CLI Version Specification

## Purpose

Report installed package version via `version` / `-v` / `--version`, or fail clearly when unreadable.

## Requirements

### Requirement: Version entry points

The CLI MUST accept `shitaku version`, `shitaku -v`, and `shitaku --version`. It MUST NOT register a separate `-V` alias.

#### Scenario: Entry points recognized

- GIVEN a readable package version
- WHEN `shitaku version`, `-v`, or `--version` runs
- THEN it is handled as version reporting (not unknown-command)

#### Scenario: No -V alias

- GIVEN the shipped CLI surface
- WHEN version flags are registered
- THEN only `-v` and `--version` are provided

### Requirement: Successful version report

When the package version is available, each entry point MUST write bare semver to stdout (e.g. `0.2.0`), MUST NOT add labels on stdout, and MUST exit `0`.

#### Scenario: Bare semver stdout

- GIVEN package version `0.2.0`
- WHEN `shitaku version` runs
- THEN stdout is bare `0.2.0` and exit code is `0`

#### Scenario: Flags match subcommand

- GIVEN package version `0.2.0`
- WHEN `shitaku -v` or `shitaku --version` runs
- THEN stdout matches `version` and exit code is `0`

### Requirement: Unreadable version failure

When unavailable, each entry point MUST write exactly `Unable to determine shitaku version.` to stderr, MUST NOT invent a version or write one to stdout, and MUST exit `1`.

#### Scenario: Missing version fails

- GIVEN version cannot be determined
- WHEN `shitaku version` runs
- THEN stderr is that exact message, stdout has no version, exit `1`

#### Scenario: Flags fail the same

- GIVEN version cannot be determined
- WHEN `shitaku -v` or `shitaku --version` runs
- THEN stderr and exit code match the `version` failure

### Requirement: Composition-time version value

The CLI MUST receive package version as an optional composition-time value. Present → print it; missing → unreadable failure. Package-location I/O MUST stay outside the CLI adapter.

#### Scenario: Injected version printed

- GIVEN composition supplies `0.2.0`
- WHEN any version entry point runs
- THEN stdout reports `0.2.0`

#### Scenario: Missing value is unreadable

- GIVEN composition supplies no version
- WHEN any version entry point runs
- THEN unreadable-version failure applies

### Requirement: Documentation

README MUST document `version`, `-v`, `--version`, and bare-semver stdout on success.

#### Scenario: README documents UX

- GIVEN the repository README
- WHEN Usage / Version notes are read
- THEN they name the three entry points and bare-semver stdout

### Requirement: Automated coverage

Tests MUST cover success for all three entry points and the unreadable path, with injected fakes, no real home access, under strict TDD via `pnpm test`.

#### Scenario: Matrix covered

- GIVEN the test suite
- WHEN `pnpm test` runs
- THEN those success and unreadable cases pass

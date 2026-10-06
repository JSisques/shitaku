# Update Notifier Specification

## Purpose

Tell users of an outdated shitaku CLI that a newer version is published, through one non-intrusive stderr notice, without delaying commands or altering command output, exit code, or machine-readable results.

## Requirements

### Requirement: Newer-version notice

When the latest published version is newer than the running version, the CLI MUST print exactly one notice line to stderr containing the latest version and the upgrade command `npm install -g @jsisques/shitaku`. The notice MUST be printed after the command completes. When the latest version is the same as, older than, or not comparable to the running version, the CLI MUST print nothing.

#### Scenario: Newer version published

- GIVEN the running version is `0.2.0` and the latest published version is `0.3.0`
- WHEN a command runs interactively with no skip rule active
- THEN one line is written to stderr naming `0.3.0` and `npm install -g @jsisques/shitaku`

#### Scenario: Same version

- GIVEN the running and latest versions are both `0.2.0`
- WHEN a command runs
- THEN nothing is written to stderr by the notifier

#### Scenario: Older latest version

- GIVEN the running version is `0.3.0` and the latest published version is `0.2.0`
- WHEN a command runs
- THEN nothing is written to stderr by the notifier

#### Scenario: Invalid latest version

- GIVEN the latest value is not a valid `x.y.z` version
- WHEN a command runs
- THEN it is treated as not newer and nothing is printed

### Requirement: Version comparison

Versions MUST be compared numerically by major, minor, then patch, without external semver dependencies. A prerelease version (for example `1.0.0-rc.1`) MUST NOT be considered newer than the same stable version (`1.0.0`). Invalid input MUST be treated as not newer.

#### Scenario: Numeric ordering

- GIVEN `0.10.0` and `0.9.0`
- WHEN compared
- THEN `0.10.0` is newer than `0.9.0`

#### Scenario: Prerelease versus same stable

- GIVEN latest `1.0.0-rc.1` and running `1.0.0`
- WHEN compared
- THEN latest is not newer

#### Scenario: Stable newer than its prerelease

- GIVEN latest `1.0.0` and running `1.0.0-rc.1`
- WHEN compared
- THEN latest is newer

### Requirement: Opt-out and skip rules

The check MUST be skipped entirely (no cache read, no fetch, no output) when any of the following holds: environment variable `SHITAKU_NO_UPDATE_CHECK` is truthy; environment variable `CI` is set to a non-empty value (an empty `CI` MUST NOT skip the check); or output is non-interactive (not a TTY). `SHITAKU_NO_UPDATE_CHECK` MUST be truthy for the values `1`, `true`, and `yes`, compared case-insensitively. An empty value, `0`, `false`, and `no` (case-insensitive) MUST NOT be truthy. Any other value MUST NOT be truthy.

#### Scenario: Opt-out with 1

- GIVEN `SHITAKU_NO_UPDATE_CHECK=1` and a cache holding a newer version
- WHEN a command runs
- THEN no notice is printed and no fetch occurs

#### Scenario: Opt-out is case-insensitive

- GIVEN `SHITAKU_NO_UPDATE_CHECK=TRUE` (or `Yes`)
- WHEN a command runs
- THEN the check is skipped

#### Scenario: Falsy opt-out values do not opt out

- GIVEN `SHITAKU_NO_UPDATE_CHECK` is empty, `0`, `false`, or `no`, and a newer version is available
- WHEN a command runs interactively
- THEN the check runs and the notice is printed

#### Scenario: CI environment

- GIVEN `CI` is set and a newer version is available
- WHEN a command runs
- THEN no notice is printed and no fetch occurs

#### Scenario: Non-TTY output

- GIVEN output is not a TTY and a newer version is available
- WHEN a command runs
- THEN no notice is printed and no fetch occurs

### Requirement: Cached check with 24-hour TTL

The check MUST persist `{checkedAt, latest}` as JSON at `<stateDir(homeDir)>/update-check.json`, written atomically. A cache whose `checkedAt` is less than 24 hours old MUST be used as is, with no network request. A cache that is 24 hours old or older, or absent, MUST trigger a refresh. A notice MUST be derived from the cached `latest` when it is newer than the running version, including when no refresh occurred. A corrupt or schema-invalid cache MUST be treated as absent.

#### Scenario: Fresh cache, no fetch

- GIVEN a cache written 1 hour ago with `latest` newer than the running version
- WHEN a command runs
- THEN the notice is printed from the cache and no network request is made

#### Scenario: Stale cache refreshes

- GIVEN a cache written 25 hours ago
- WHEN a command runs
- THEN the registry is queried and the cache is rewritten with the new `checkedAt` and `latest`

#### Scenario: No cache

- GIVEN no `update-check.json`
- WHEN a command runs interactively
- THEN the registry is queried and the cache is created

#### Scenario: Corrupt cache

- GIVEN `update-check.json` contains invalid JSON or the wrong shape
- WHEN a command runs
- THEN it is treated as absent, the registry is queried, and the cache is rewritten

### Requirement: Bounded, non-blocking refresh

The refresh MUST use the global `fetch` against the npm registry for `@jsisques/shitaku` with a timeout of approximately 1.5 seconds, run concurrently with the command, and MUST NOT add new dependencies. The command MUST NOT wait beyond that timeout for the refresh. The refresh MUST run at most once per cache TTL window.

#### Scenario: Slow registry

- GIVEN the registry does not respond within the timeout
- WHEN a command runs with a stale cache
- THEN the request is aborted at about 1.5 seconds, the command completes normally, and no notice from the failed fetch is printed

#### Scenario: Concurrent with command

- GIVEN a stale cache
- WHEN a command runs
- THEN the refresh starts before the command dispatch and does not delay the command's own work

### Requirement: Offline and failure tolerance

Any failure (network error, timeout, non-success response, malformed payload, unreadable or unwritable cache) MUST be swallowed: no error output, no stack trace, no change to the exit code. A failed refresh MUST still write `checkedAt` so that the registry is not queried again within the TTL. A failed refresh MUST NOT overwrite a previously cached `latest` with an invalid value.

#### Scenario: Offline

- GIVEN the network is unavailable and the cache is stale
- WHEN a command runs
- THEN no error or notice is printed, the exit code is unchanged, and `checkedAt` is updated

#### Scenario: No retry after failure

- GIVEN a refresh just failed and wrote `checkedAt`
- WHEN another command runs within 24 hours
- THEN no network request is made

#### Scenario: Malformed registry payload

- GIVEN the registry returns a payload without a valid `version`
- WHEN a command runs with a stale cache
- THEN nothing is printed, no error surfaces, and `checkedAt` is updated

#### Scenario: Cache write failure

- GIVEN the state directory is not writable
- WHEN a command runs
- THEN the command output and exit code are unaffected and no error is printed

### Requirement: Output isolation

The notice MUST be written only to stderr. It MUST NOT write to stdout, MUST NOT alter the stdout of any command (including `status --json`), and MUST NOT alter any exit code. The notifier MUST NOT be active when no update dependency is wired into the CLI, so existing offline tests and embeddings are unaffected.

#### Scenario: status --json unchanged

- GIVEN a newer version is available and the session is interactive
- WHEN `status --json` runs
- THEN stdout is byte-identical to a run without the notifier, the notice appears only on stderr, and the exit code is unchanged

#### Scenario: Failing command keeps its exit code

- GIVEN a command that exits non-zero and a newer version available
- WHEN it runs
- THEN the exit code is unchanged

#### Scenario: Notifier not wired

- GIVEN the CLI is constructed without update dependencies
- WHEN any command runs
- THEN no cache access, no fetch, and no notice occur

### Requirement: Documentation

The README MUST contain an "Update notifications" section describing the notice, the 24-hour cache, the skip conditions (`CI`, non-TTY), the opt-out variable `SHITAKU_NO_UPDATE_CHECK` with its truthy values, and that the notice goes to stderr only.

#### Scenario: README documents behavior and opt-out

- GIVEN the repository README
- WHEN the "Update notifications" section is read
- THEN it names `SHITAKU_NO_UPDATE_CHECK`, its accepted values, the 24-hour check interval, and the stderr-only notice

### Requirement: Test coverage

Automated tests MUST cover at least: newer, same, older, offline, opt-out (including falsy values), `CI`, non-TTY, fresh cache (no fetch), stale cache (fetch), corrupt cache, prerelease comparison, and `status --json` stdout isolation. Tests MUST NOT perform real network access or touch the real home directory.

#### Scenario: Matrix present

- GIVEN the test suite
- WHEN `pnpm test` runs
- THEN each case in the matrix above is exercised using injected fakes and sandboxed paths

### Requirement: Version reporting skips update check

`version`, `-v`, `--version`, and `upgrade` MUST NOT run the update check (no cache, fetch, or notifier stderr), even with update deps wired and no env skip. Other commands MUST keep existing notifier behavior. Notice wording MUST NOT change here.
(Previously: Only version entry points skipped; `upgrade` was not listed.)

#### Scenario: Version entry points skip notifier

- GIVEN update deps wired, newer cached, interactive, no env skip
- WHEN `shitaku version`, `-v`, or `--version` runs
- THEN no update-check I/O and no notifier line

#### Scenario: Upgrade skips notifier

- GIVEN same conditions as version skip
- WHEN `shitaku upgrade` runs
- THEN no update-check I/O and no notifier line

#### Scenario: Other commands still notify

- GIVEN update deps wired, newer available, interactive, no skip
- WHEN `status` runs
- THEN existing update-notifier behavior still applies

# Tasks: Version Command

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | 180–280     |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | single PR   |
| Delivery strategy       | ask-on-risk |
| Chain strategy          | pending     |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                        | Likely PR | Focused test command                                               | Runtime harness                                                | Rollback boundary                                                             |
| ---- | ------------------------------------------- | --------- | ------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1    | CLI version report + notifier skip + README | PR 1      | `pnpm test -- test/adapters/cli/program.test.ts test/main.test.ts` | `pnpm exec shitaku version` (and `-v`/`--version`) after build | Revert `cliVersion` wiring, version registration, notifier gate, README/tests |

Merge note: sibling `uninstall-command` may touch shared CLI/docs/tests — edit version slices only; do not edit that change.

## Phase 1: Adapter RED (strict TDD)

- [x] 1.1 RED in `test/adapters/cli/program.test.ts`: inject `cliVersion: '0.2.0'`; assert `version` / `-v` / `--version` bare stdout + exit `0`
- [x] 1.2 RED in `test/adapters/cli/program.test.ts`: omit `cliVersion`; assert exact stderr `Unable to determine shitaku version.`, no version on stdout, exit `1` for all three entry points
- [x] 1.3 RED in `test/adapters/cli/program.test.ts`: help lists `version`; flags register only `-v`/`--version` (no `-V`)
- [x] 1.4 Confirm RED via `pnpm test -- test/adapters/cli/program.test.ts`

## Phase 2: Adapter GREEN (version paths)

- [x] 2.1 Add optional `cliVersion?: string` to `CliDeps` in `src/adapters/cli/program.ts`
- [x] 2.2 In `src/adapters/cli/program.ts`, early-gate version invocations when `cliVersion` unset → stderr message + return `1` (no placeholder `.version`)
- [x] 2.3 When set: `program.version(cliVersion, '-v, --version')` + `command('version')` → `deps.out(cliVersion)` in `src/adapters/cli/program.ts`
- [x] 2.4 GREEN: `pnpm test -- test/adapters/cli/program.test.ts` for Phase 1 scenarios

## Phase 3: Notifier skip (RED → GREEN)

- [x] 3.1 RED in `test/adapters/cli/program.test.ts`: updates wired + spy `latest`; version/`-v`/`--version` leave `asked === 0` and no notifier stderr
- [x] 3.2 RED/assert existing non-version path (e.g. `status`) still starts notifier when applicable
- [x] 3.3 GREEN in `src/adapters/cli/program.ts`: do not start `checkForUpdate` when argv is a version invocation
- [x] 3.4 GREEN: `pnpm test -- test/adapters/cli/program.test.ts`

## Phase 4: Composition + docs

- [x] 4.1 RED in `test/main.test.ts`: `bootMain()` deps forward `cliVersion` matching `package.json` (read-only)
- [x] 4.2 GREEN in `src/main.ts`: pass `cliVersion: version` beside existing `updates` wiring
- [x] 4.3 Update `README.md` Usage/Version note for `version` / `-v` / `--version` + bare-semver stdout; TOC if present
- [x] 4.4 GREEN: `pnpm test -- test/main.test.ts`

## Phase 5: Verification

- [x] 5.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`
- [x] 5.2 Smoke: built CLI `version` / `-v` / `--version` match contracts (readable vs unreadable not required in smoke if faked only in unit tests)

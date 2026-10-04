# Design: Version Command

## Technical Approach

Adapter-only reporting of the package semver already read by `readVersion()` in `main.ts`. Inject it as `CliDeps.cliVersion`, register Commander `-v`/`--version` plus a `version` subcommand in `runCli`, and skip the update-check overlap on those entry points. No domain/application modules. Maps to proposal approach 1 and capability `cli-version` / delta `update-notifier`.

## Architecture Decisions

| Decision                       | Options                                                                             | Choice                                                                                                                                            | Rationale                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Where version lives            | New field `cliVersion` vs reuse `updates.currentVersion` vs re-read in `program.ts` | `CliDeps.cliVersion?: string` from `main.ts`                                                                                                      | Keeps package I/O in composition root; version works when `updates` is omitted in tests/offline     |
| Flag shape                     | Commander default `-V` vs custom `-v, --version` vs both                            | `program.version(ver, '-v, --version')` only                                                                                                      | Matches locked product decision; replaces default `-V`                                              |
| Unreadable version             | Fake string / silent skip / hard fail                                               | Exact stderr `Unable to determine shitaku version.` + exit `1`; never call `.version` with a placeholder                                          | Locked AC; asymmetric with notifier silent-skip is intentional                                      |
| Unreadable flag/command wiring | Fake `.version` / early argv gate / custom Option                                   | Early gate: if version invocation and `cliVersion` unset → err + return `1` before parse; when set, Commander + `command('version')` → `deps.out` | Avoids fake version string; reuses existing `configureOutput` / `exitOverride` for happy-path flags |
| Notifier on version paths      | Always check / suppress print only / do not start check                             | Do not start `checkForUpdate` when argv is a version invocation                                                                                   | Locked: no network/cache side effects on version entry points                                       |
| Hexagonal scope                | Application use case vs adapters+main                                               | Adapters + `main.ts` only                                                                                                                         | Printing an injected string is presentation                                                         |

## Data Flow

```
package.json ──readVersion()──► main.ts
                                  │
                    cliVersion ───┼──► updates? (other commands only)
                                  ▼
                               runCli(argv, deps)
                                  │
              isVersionInvocation?──yes──► skip checkForUpdate
                                  │
              cliVersion set?──no──► stderr MSG, exit 1
                                  │ yes
              -v/--version ──► Commander writeOut(semver), exit 0
              version cmd ──► deps.out(semver), exit 0
```

Version invocation detection (argv after node/script): any of `version`, `-v`, `--version` as a top-level token (same paths Commander handles for root version / the new subcommand).

## File Changes

| File                                | Action | Description                                                                                            |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `src/adapters/cli/program.ts`       | Modify | Add `cliVersion?`; register flags/subcommand; early unreadable gate; gate `pending` update check       |
| `src/main.ts`                       | Modify | Pass `cliVersion: version` beside existing `updates` wiring                                            |
| `test/adapters/cli/program.test.ts` | Modify | Strict TDD: happy path, flags, unreadable, help lists `version`, notifier not started on version paths |
| `test/main.test.ts`                 | Modify | Assert composition root forwards `cliVersion` matching `package.json`                                  |
| `README.md`                         | Modify | Usage lines for `version` / `--version`; short Version note (bare stdout); TOC if present              |

No deletes. Do not edit `uninstall-command` OpenSpec artifacts.

## Interfaces / Contracts

```ts
export interface CliDeps {
  // ...existing fields...
  /** Installed package semver; omit/undefined when unreadable. */
  cliVersion?: string;
  updates?: UpdateSettings;
}
```

| Contract          | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| stdout happy path | bare semver only (e.g. `0.2.0`), exit `0`                |
| stderr failure    | `Unable to determine shitaku version.` exactly, exit `1` |
| Flags             | `-v`, `--version` (no `-V`)                              |
| Notifier          | not started on version / `-v` / `--version`              |

## Testing Strategy

Strict TDD (`pnpm test`): RED → GREEN in adapter tests, then wiring/`main`/README.

| Layer          | What                                                                                   | Approach                                                                |
| -------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Unit (adapter) | `version`, `-v`, `--version` stdout/exit; unreadable stderr/exit; help lists `version` | Extend `run()` harness; inject `cliVersion`                             |
| Unit (adapter) | Version paths do not call update source                                                | `updates` wired + spy `latest`; run version entry points; `asked === 0` |
| Unit (main)    | `bootMain()` deps include `cliVersion` from package.json                               | Existing mock/`bootMain` pattern                                        |
| Docs           | README documents command/flags + bare stdout                                           | Manual/review with feature commit                                       |

## Threat Matrix

N/A for the VCS/PR/executable-classification rows in `threat-matrix.md` — this change only adds a read-only CLI version report (no repo selection, commit/push/PR automation, or executable-file classification).

| Boundary                 | Applicability                           |
| ------------------------ | --------------------------------------- |
| Documentation-like paths | N/A — no executable-path classification |
| Git repository selection | N/A — no git                            |
| Commit state             | N/A — no commit                         |
| Push state               | N/A — no push                           |
| PR commands              | N/A — no PR automation                  |

## Migration / Rollout

No migration required. Ship in one PR with sibling coexistence: touch only version-related slices of shared `program.ts` / `program.test.ts` / `README.md` (merge risk with `uninstall-command`).

## Open Questions

- [x] Unreadable message/exit — locked
- [x] Flags — `-v, --version` only — locked
- [x] No notifier on version paths — locked
- [ ] None blocking design

# Proposal: Add CLI Upgrade Command

## Intent

Users must recall package-manager commands to update `@jsisques/shitaku`. Add `shitaku upgrade` to detect install method, show current→target, and apply a safe global upgrade or print guidance when unsafe (#50).

## Scope

### In Scope

- Register `shitaku upgrade`; use case with fresh latest-version fetch.
- Spawn global upgrade via `ProcessRunner` (`shell: false`) for `npm-global` / `pnpm-global`.
- Print-only for `npx` / `unknown`; already-latest and failure messaging.
- Skip post-command update notice for `upgrade`.
- Tests (detection, already-latest, run vs print, failures) and README.

### Out of Scope

- Notifier wording → `shitaku upgrade` (version-notice issue).
- Issue #46 `shitaku update`; name stays `upgrade` only.
- Yarn/bun/Homebrew detection; website docs beyond README.

## Capabilities

### New Capabilities

- `cli-upgrade`: CLI self-update — install-method policy, fresh fetch, version display, spawn or print-only, failures, README.

### Modified Capabilities

- `update-notifier`: Skip post-command check/notice for `upgrade` (like `version`). Do **not** change notice wording here.

## Approach

Exploration approach 1: `upgradeCli` with `LatestVersionSource`, current version, `InstallMethod`, `ProcessRunner`, writers. Flow: resolve current → fresh fetch → already-latest exit 0 → show versions → spawn argv or print `upgradeCommand` → non-zero PM exit leaves install untouched; explain recovery. Domain pure; wire in `main.ts`; thin `program.ts` registration.

## Affected Areas

| Area                             | Impact       | Description                            |
| -------------------------------- | ------------ | -------------------------------------- |
| `src/application/upgrade-cli.ts` | New          | Fetch, compare, run/print, failures    |
| `src/domain/install-method.ts`   | Modified     | Argv / runnability helpers             |
| `src/adapters/cli/program.ts`    | Modified     | Register `upgrade`; skip notifier      |
| `src/main.ts`                    | Modified     | Wire method, version source, runner    |
| Ports / runners                  | Reused       | `LatestVersionSource`, `ProcessRunner` |
| `test/**` + `README.md`          | New/Modified | Strict TDD + docs                      |

### Hexagonal layers

Domain: runnability/argv, reuse `isNewer`. Ports: version source + runner. Application: `upgradeCli`. Adapters: CLI + Node runner/registry. Composition: `main.ts` only.

## Risks

| Risk                        | Likelihood | Mitigation                                       |
| --------------------------- | ---------- | ------------------------------------------------ |
| npx cannot persist          | Med        | Print-only; no fake spawn success                |
| Self-replace while running  | Low        | Rely on PM exit codes                            |
| Wrong method detected       | Med        | `unknown` print-only; runnable = npm/pnpm global |
| Confusion with #46 `update` | Low        | Docs: “upgrade the CLI package”                  |

## Rollback Plan

Revert feature commits: drop `upgrade` command/use case; restore version-only notifier skips. No catalog/manifest mutation. Prior package recoverable via previous PM install.

## Dependencies

Install-method detection, `LatestVersionSource`, `ProcessRunner`, `isNewer`.

## Success Criteria

- [ ] Global methods upgrade via spawn; `npx`/`unknown` print-only.
- [ ] Already-latest and PM failures clear; install untouched on non-zero exit.
- [ ] Fresh fetch for upgrade; notifier skipped on `upgrade`.
- [ ] Tests cover detection + already-latest; README + architecture tests pass.

# Apply Progress: add-upgrade-command

**Batch**: Work Unit 2 / PR 2 (Phases 3–4, tasks 3.1–4.2) — cumulative with WU1
**Mode**: Strict TDD
**Date**: 2026-10-06
**Chain strategy**: stacked-to-main (resolved)

## Completed (cumulative)

### Work Unit 1 / PR 1 (Phases 1–2)

- [x] 1.1 RED: extend install-method tests for `isRunnableUpgrade` / `upgradeArgv`
- [x] 1.2 GREEN: domain helpers in `src/domain/install-method.ts`
- [x] 2.1 RED: fresh fetch + null latest scenarios
- [x] 2.2 RED: already-latest + current→target display
- [x] 2.3 RED: spawn argv vs print-only matrix
- [x] 2.4 RED: non-zero PM exit recovery
- [x] 2.5 GREEN: `src/application/upgrade-cli.ts`

### Work Unit 2 / PR 2 (Phases 3–4) — this batch

- [x] 3.1 RED: extend `program.test.ts` — `upgrade` registered; no self-update `update` command
- [x] 3.2 RED: `upgrade` skips notifier I/O like version; other commands still notify
- [x] 3.3 GREEN: register `upgrade` in `program.ts`; extend skip predicate; invoke `upgradeCli`
- [x] 3.4 GREEN: pass `installMethod` on `CliDeps` from `main.ts`
- [x] 4.1 Document `shitaku upgrade` in `README.md`
- [x] 4.2 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`

## Remaining

None — all 13 tasks complete.

## TDD Cycle Evidence

### Work Unit 1 (preserved)

| Task | Test File                              | Layer | Safety Net | RED                    | GREEN                    | TRIANGULATE                                  | REFACTOR                        |
| ---- | -------------------------------------- | ----- | ---------- | ---------------------- | ------------------------ | -------------------------------------------- | ------------------------------- |
| 1.1  | `test/domain/install-method.test.ts`   | Unit  | ✅ 12/12   | ✅ Written (6 failing) | —                        | —                                            | —                               |
| 1.2  | `test/domain/install-method.test.ts`   | Unit  | ✅ 12/12   | —                      | ✅ 18/18                 | ✅ 4 methods + 2 argv cases                  | ✅ type guard order             |
| 2.1  | `test/application/upgrade-cli.test.ts` | Unit  | N/A (new)  | ✅ Written             | —                        | —                                            | —                               |
| 2.2  | `test/application/upgrade-cli.test.ts` | Unit  | N/A (new)  | ✅ Written             | —                        | —                                            | —                               |
| 2.3  | `test/application/upgrade-cli.test.ts` | Unit  | N/A (new)  | ✅ Written             | —                        | —                                            | —                               |
| 2.4  | `test/application/upgrade-cli.test.ts` | Unit  | N/A (new)  | ✅ Written             | —                        | —                                            | —                               |
| 2.5  | `test/application/upgrade-cli.test.ts` | Unit  | N/A (new)  | —                      | ✅ 9/9 (+18 domain = 27) | ✅ fetch/null/latest/spawn×2/print×2/PM-fail | ✅ exit return + type predicate |

### Work Unit 2 (this batch)

| Task | Test File                           | Layer | Safety Net | RED        | GREEN        | TRIANGULATE                                            | REFACTOR                     |
| ---- | ----------------------------------- | ----- | ---------- | ---------- | ------------ | ------------------------------------------------------ | ---------------------------- |
| 3.1  | `test/adapters/cli/program.test.ts` | Unit  | ✅ 143/143 | ✅ Written | —            | —                                                      | —                            |
| 3.2  | `test/adapters/cli/program.test.ts` | Unit  | ✅ 143/143 | ✅ Written | —            | —                                                      | —                            |
| 3.3  | `test/adapters/cli/program.test.ts` | Unit  | ✅ 143/143 | —          | ✅ 146/146   | ✅ help+no-update / npm spawn / npx skip (`asked===1`) | ✅ `skipsUpdateCheck` helper |
| 3.4  | `test/adapters/cli/program.test.ts` | Unit  | ✅ 143/143 | —          | ✅ via 3.3   | ✅ `installMethod` on CliDeps wired from main          | ➖ None needed               |
| 4.1  | README (docs)                       | Docs  | N/A        | ➖ Docs    | ✅ Written   | ➖ Single: docs only                                   | ➖ None needed               |
| 4.2  | verification                        | Guard | N/A        | ➖ N/A     | ✅ All green | ➖ Structural                                          | ➖ None needed               |

### Test Summary (WU2)

- **Total tests written (WU2)**: 3 new (help registration, e2e spawn wire, notifier skip)
- **Total tests passing (focused)**: 146 (`program.test.ts`)
- **Full suite**: 888 passed / 46 files
- **Layers used**: Unit (3 new), Docs (1), Guard (1)
- **Approval tests**: None
- **Pure functions created**: 1 (`skipsUpdateCheck`)

## Work Unit Evidence

### Unit 1 (preserved)

| Evidence                                          | Value                                                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm exec vitest run test/domain/install-method.test.ts test/application/upgrade-cli.test.ts` → exit 0, 2 files, 27 passed                               |
| Runtime harness command/scenario and exact result | N/A — unit fakes only; no CLI entry yet (PR 2)                                                                                                            |
| Rollback boundary                                 | Remove `src/application/upgrade-cli.ts`, `test/application/upgrade-cli.test.ts`, and revert `isRunnableUpgrade`/`upgradeArgv` additions in domain + tests |

### Unit 2 (this batch)

| Evidence                                          | Value                                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command and exact result             | `pnpm exec vitest run test/adapters/cli/program.test.ts` → exit 0, 146 passed                                                                                                              |
| Runtime harness command/scenario and exact result | `pnpm run build` → exit 0; `node dist/main.js upgrade --help` → exit 0, shows `Usage: shitaku upgrade [options]`                                                                           |
| Full verification (4.2)                           | `pnpm test` 888/888; `pnpm run typecheck` exit 0; `pnpm run lint` exit 0; `pnpm run format:check` exit 0                                                                                   |
| Rollback boundary                                 | Drop `upgrade` registration + `skipsUpdateCheck`/`runUpgrade` in `program.ts`, remove `installMethod` from `CliDeps`/`main.ts`, revert README Upgrade section + program.test upgrade cases |

## Files Changed (WU2 only)

| File                                | Action   | What Was Done                                                                   |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `test/adapters/cli/program.test.ts` | Modified | Registration, spawn wire, notifier-skip tests; `installMethod` on CliDeps       |
| `src/adapters/cli/program.ts`       | Modified | `installMethod` on CliDeps; `upgrade` command; `skipsUpdateCheck`; `runUpgrade` |
| `src/main.ts`                       | Modified | Pass `installMethod` on CliDeps                                                 |
| `README.md`                         | Modified | Usage + Upgrade section; notifier skip list includes `upgrade`                  |

## Authored Line Estimate (WU2)

~101 lines (program +41 net, tests +38, README +15, main +1). Under 400-line PR budget.

## Workload / PR Boundary

- Mode: stacked PR slice (stacked-to-main)
- Current work unit: Unit 2 — CLI register, notifier skip, main wire, README
- Boundary: starts after `upgradeCli` use case; ends with CLI wiring + docs + full verification. Depends on Unit 1.
- Estimated review budget impact: ~101 authored lines (safe under 400)

## Deviations from Design

None — `CliDeps.installMethod`, `skipsUpdateCheck` extends version skip, `upgradeCli` via `updates.source` + `processRunner`, no `#46` `update` command, notice wording unchanged.

## Issues Found

Prettier format drift on WU1 OpenSpec/test files blocked `format:check`; reformatted those files so 4.2 passes.

## Status

13/13 tasks complete. Ready for verify (`sdd-verify`).

## Verify remediation (2026-10-06) — README present coverage

**Trigger**: sdd-verify FAIL — scenario `cli-upgrade` / **README present** had no covering runtime test (version README asserted in `naming.test.ts`, upgrade docs were not).

**Tasks**: remain 13/13 — no checkboxes unchecked; remediation only.

### TDD Cycle Evidence (remediation)

| Task           | Test File             | Layer              | Safety Net | RED                                 | GREEN                                                  | TRIANGULATE                       | REFACTOR       |
| -------------- | --------------------- | ------------------ | ---------- | ----------------------------------- | ------------------------------------------------------ | --------------------------------- | -------------- |
| README present | `test/naming.test.ts` | Unit (docs assert) | ✅ 3/3     | ✅ Written (upgrade README asserts) | ✅ 4/4 — README already had strings; no README rewrite | ➖ Single: docs-presence scenario | ➖ None needed |

### Work Unit Evidence (remediation)

| Evidence                                          | Value                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm exec vitest run test/naming.test.ts` → exit 0, 4 passed (was 3)                   |
| Runtime harness command/scenario and exact result | N/A — same layer as version README naming test (read `README.md` contents)              |
| Rollback boundary                                 | Revert the new `it('documents shitaku upgrade...')` block in `test/naming.test.ts` only |

### Files Changed (remediation)

| File                  | Action   | What Was Done                                                                                                        |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `test/naming.test.ts` | Modified | Assert README Upgrade section: `shitaku upgrade`, spawn vs print-only, already-up-to-date, CLI package / not catalog |

### Notes

- GREEN required no README edits — Upgrade section (~line 363) already documented required language.
- Prior WU1/WU2 evidence above is preserved unchanged.

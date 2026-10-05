# Apply Progress: catalog-scripts

**Mode**: Strict TDD
**Batch**: Phase 1–2 preserved + Phase 3 / PR3 (tasks 3.1–3.7)
**Branch**: feat/catalog-scripts-run (stacked on feat/catalog-scripts-install / PR2)
**Chain strategy**: stacked-to-main
**Status**: Phase 3 complete
**Date**: 2026-10-05

## Completed Tasks

### Phase 1 (prior batch — preserved)

- [x] 1.1 RED: `test/domain/catalog/script.test.ts` — parse `script.json`; reject invalid/guards
- [x] 1.2 GREEN: `src/domain/catalog/script.ts` — `ScriptItem`/`ScriptMetaSchema`
- [x] 1.3 RED→GREEN: `src/domain/scripts-paths.ts` + tests — project/user roots; not agent dirs
- [x] 1.4 RED→GREEN: `schema.ts`/`profile.ts`/`listing.ts` + tests — `items.scripts`, profile `scripts[]`, `LIST_KINDS`
- [x] 1.5 RED→GREEN: `folder-source.ts` + tests — `loadScripts`; empty OK
- [x] 1.6 RED→GREEN: CLI `list scripts` / JSON `"kind":"script"` in `program.ts` + tests

### Phase 2 (prior batch — preserved)

- [x] 2.1 RED→GREEN: `script-plan.ts` + `change-plan.ts` — create|skip|update|conflict; dry-run/force
- [x] 2.2 RED→GREEN: `manifest.ts` — `kind:'script'` tree hash + ownership
- [x] 2.3 RED: init conflict exit 2 / dry-run no writes / unknown `--scripts`
- [x] 2.4 GREEN: `init-mcps.ts`/`skill-tree.ts`/`prompter.ts` — Paths roots; `--scripts`; prompts
- [x] 2.5 RED→GREEN: mid-write failure rollback — no partial dir; no manifest row
- [x] 2.6 RED→GREEN: `status-plan.ts`/`status.ts` — script states; unsafe → `modified`
- [x] 2.7 RED→GREEN: `undo-install.ts` — script undo; refuse drift
- [x] 2.8 RED→GREEN: `uninstall-item.ts` — `--kind script`; collision; modified exit 3 / force keeps extras

### Phase 3 (this batch)

- [x] 3.1 RED (threat): reject path-like names; no spawn; never spawn metadata
- [x] 3.2 RED→GREEN: name/tool policy + Win path fixtures
- [x] 3.3 RED→GREEN: `process-runner.ts` + `node-process-runner.ts` — `shell:false`; exit passthrough; Win `.cmd`
- [x] 3.4 RED→GREEN: `run-script.ts` — bare list; project→user; args/exit; `.bin` then `npx`
- [x] 3.5 RED→GREEN: unknown name non-zero + suggest bare `run`
- [x] 3.6 RED→GREEN: `doctor-plan.ts`/`doctor.ts` — `info`/`script-tool-missing`; warn-only exit 0
- [x] 3.7 GREEN: CLI `run` + `main.ts` wire; architecture guard bans spawn in domain

## Remaining (out of this batch)

- Phase 4 tasks still open (PR4)

## TDD Cycle Evidence

### Phase 1–2 (preserved)

See prior apply-progress revisions for full Phase 1–2 tables.

### Phase 3

| Task    | Test File                                                    | Layer       | Safety Net       | RED                            | GREEN           | TRIANGULATE                        | REFACTOR                 |
| ------- | ------------------------------------------------------------ | ----------- | ---------------- | ------------------------------ | --------------- | ---------------------------------- | ------------------------ |
| 3.1–3.2 | `test/domain/scripts-run.test.ts`                            | Unit        | N/A (new)        | ✅ Written (import miss)       | ✅ 11 passed    | ✅ POSIX/Win paths + bin/npx       | ➖ None needed           |
| 3.3     | `test/adapters/process/node-process-runner.test.ts`          | Integration | N/A (new)        | ✅ Written (import miss)       | ✅ 4 passed     | ✅ exit 0/3 + Win .cmd via cmd.exe | ✅ Injectable spawn      |
| 3.4–3.5 | `test/application/run-script.test.ts`                        | Integration | ✅ domain green  | ✅ Written (import miss)       | ✅ 8 passed     | ✅ list/resolve/path/unknown/PATH  | ✅ Shared install helper |
| 3.6     | `test/domain/plan/doctor-plan.test.ts` + `doctor.test.ts`    | Unit+App    | ✅ 31/31         | ✅ Written (1 fail then green) | ✅ 34 passed    | ✅ missing tool info; present → [] | ✅ tool field on Finding |
| 3.7     | `test/adapters/cli/program.test.ts` + `architecture.test.ts` | Integration | ✅ program suite | ✅ Written (run cases)         | ✅ 143 + 9 arch | ✅ bare/path/args/unknown + help   | ✅ raw argv parseRunArgv |

## Work Unit Evidence

| Evidence                              | Value                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | `vitest run test/application/run-script.test.ts test/adapters/process test/domain/scripts-run.test.ts test/architecture.test.ts test/domain/plan/doctor-plan.test.ts test/application/doctor.test.ts` → **66 passed / 6 files**; CLI `program.test.ts` → **143 passed** |
| Runtime harness                       | Fake ProcessRunner + temp FS install via `initMcps`; CLI `run` with injected runner; architecture bans `child_process`/`process.` in domain                                                                                                                             |
| Rollback boundary                     | Revert commits `2cc9b0a..846d7dd` (+ openspec task/progress docs); removes Phase 3 run/ProcessRunner/doctor-tool without touching Phase 1–2                                                                                                                             |

## Verification (observed)

- Focused Phase 3: 66 + 143 CLI passed
- Full: `vitest run` → **834 passed / 43 files**
- `tsc --noEmit`: pass
- `eslint .`: pass
- `prettier --check .`: pass
- Architecture: domain still free of `fs`/`os`/`path`/`child_process`/`process.`

## Commits (Phase 3 on feat/catalog-scripts-run)

1. `2cc9b0a` feat(run): reject path-like names and define tool bin policy
2. `0e05ca1` feat(process): add ProcessRunner port with shell-false Node adapter
3. `b70a0b2` feat(run): resolve and execute installed catalog scripts
4. `b5b1ca2` feat(doctor): warn when script tools are missing from local bin
5. `846d7dd` feat(cli): wire shitaku run through ProcessRunner

## Workload / PR Boundary

- Mode: stacked PR slice (PR3 → feat/catalog-scripts-install / PR2 tip)
- Current work unit: Run + ProcessRunner + doctor
- Boundary: tasks 3.1–3.7 only; Phase 4 not started
- Authored Phase 3 lines vs PR2 tip (`bfce67c..HEAD`, excl. pending openspec): **+809 / -5 = 814** changed lines
- **Budget note**: cohesive Phase 3 unit exceeds 400-line review budget; recommend `size:exception` for PR3 (same as PR1/PR2). Do not absorb Phase 4.

## Deviations from Design

- CLI `run` uses raw `argv` parsing (`parseRunArgv`) instead of Commander `passThroughOptions`, because enabling positional options on the root broke `init --no-banner`. Behavior matches the spec (`shitaku run demo --json` passthrough).
- Doctor default `platform` is `'linux'` when unset (injected from `main` / tests); Windows `.cmd` probing is covered in domain + ProcessRunner tests.

## Issues Found

- Local `pnpm` packageManager self-switch store remains broken; commits used `.tmp-bin/pnpm` shim + `node_modules/.bin` on PATH so husky still ran lint-staged.

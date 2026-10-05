# Apply Progress: catalog-scripts

**Mode**: Strict TDD
**Batch**: Phase 1 complete + Phase 2 / PR2 (tasks 2.1–2.8)
**Branch**: feat/catalog-scripts-install (stacked on feat/catalog-scripts / PR1)
**Chain strategy**: stacked-to-main
**Status**: Phase 2 complete
**Date**: 2026-10-05

## Completed Tasks

### Phase 1 (prior batch — preserved)

- [x] 1.1 RED: `test/domain/catalog/script.test.ts` — parse `script.json`; reject invalid/guards
- [x] 1.2 GREEN: `src/domain/catalog/script.ts` — `ScriptItem`/`ScriptMetaSchema`
- [x] 1.3 RED→GREEN: `src/domain/scripts-paths.ts` + tests — project/user roots; not agent dirs
- [x] 1.4 RED→GREEN: `schema.ts`/`profile.ts`/`listing.ts` + tests — `items.scripts`, profile `scripts[]`, `LIST_KINDS`
- [x] 1.5 RED→GREEN: `folder-source.ts` + tests — `loadScripts`; empty OK
- [x] 1.6 RED→GREEN: CLI `list scripts` / JSON `"kind":"script"` in `program.ts` + tests

### Phase 2 (this batch)

- [x] 2.1 RED→GREEN: `script-plan.ts` + `change-plan.ts` — create|skip|update|conflict; dry-run/force
- [x] 2.2 RED→GREEN: `manifest.ts` — `kind:'script'` tree hash + ownership
- [x] 2.3 RED: init conflict exit 2 / dry-run no writes / unknown `--scripts`
- [x] 2.4 GREEN: `init-mcps.ts`/`skill-tree.ts`/`prompter.ts` — Paths roots; `--scripts`; prompts
- [x] 2.5 RED→GREEN: mid-write failure rollback — no partial dir; no manifest row
- [x] 2.6 RED→GREEN: `status-plan.ts`/`status.ts` — script states; unsafe → `modified`
- [x] 2.7 RED→GREEN: `undo-install.ts` — script undo; refuse drift
- [x] 2.8 RED→GREEN: `uninstall-item.ts` — `--kind script`; collision; modified exit 3 / force keeps extras

## Remaining (out of this batch)

- Phase 3–4 tasks still open (PR3–PR4)

## TDD Cycle Evidence

### Phase 1 (preserved)

| Task    | Test File                                              | Layer       | Safety Net        | RED                            | GREEN                  | TRIANGULATE                            | REFACTOR             |
| ------- | ------------------------------------------------------ | ----------- | ----------------- | ------------------------------ | ---------------------- | -------------------------------------- | -------------------- |
| 1.1–1.2 | `test/domain/catalog/script.test.ts`                   | Unit        | N/A (new)         | ✅ Written (import miss)       | ✅ 11 passed           | ✅ schema + parse cases                | ✅ Clean             |
| 1.3     | `test/domain/scripts-paths.test.ts`                    | Unit        | N/A (new)         | ✅ Written (import miss)       | ✅ 4 passed            | ✅ project + user + agent-dir reject   | ➖ None needed       |
| 1.4     | `test/domain/catalog/{schema,profile,listing}.test.ts` | Unit        | ✅ 37/37          | ✅ Written (13 fail)           | ✅ 45 passed           | ✅ scripts index/profile/list          | ✅ Clean             |
| 1.5     | `test/adapters/catalog/folder-source.test.ts`          | Integration | ✅ 19/19          | ✅ Written (6 fail)            | ✅ 26 passed           | ✅ empty/valid/invalid/symlink/profile | ✅ Mirror loadSkills |
| 1.6     | `test/adapters/cli/program.test.ts`                    | Integration | ✅ 27 list passed | ✅ Written (scripts list/JSON) | ✅ 30 list + suite 762 | ✅ text + JSON kind                    | ➖ Description only  |

### Phase 2

| Task    | Test File                                              | Layer       | Safety Net   | RED                              | GREEN                | TRIANGULATE                          | REFACTOR              |
| ------- | ------------------------------------------------------ | ----------- | ------------ | -------------------------------- | -------------------- | ------------------------------------ | --------------------- |
| 2.1     | `test/domain/plan/script-plan.test.ts` (+ change-plan) | Unit        | ✅ 50/50     | ✅ Written (import miss)         | ✅ 23 plan passed    | ✅ create/skip/update/conflict/force | ✅ Mirror skill-plan  |
| 2.2     | `test/domain/manifest.test.ts`                         | Unit        | ✅ prior     | ✅ Written (6 fail before GREEN) | ✅ 36 passed         | ✅ ownership/remove/null afterHash   | ✅ Shared tree helper |
| 2.3–2.5 | `test/application/init-mcps.test.ts`                   | Integration | ✅ skill net | ✅ Spec scenarios first in batch | ✅ 54 init file pass | ✅ roots/unknown/dry-run/rollback    | ✅ Shared treeSteps   |
| 2.6     | `test/application/status.test.ts`                      | Integration | ✅ prior     | ✅ Written                       | ✅ focused green     | ✅ installed/modified/missing/ood    | ➖ Minimal            |
| 2.7     | `test/application/undo-install.test.ts`                | Integration | ✅ prior     | ✅ Written                       | ✅ focused green     | ✅ clean undo + extras refuse        | ✅ treeRoots rename   |
| 2.8     | `test/application/uninstall-item.test.ts`              | Integration | ✅ prior     | ✅ Written                       | ✅ focused green     | ✅ kind/collision/force extras       | ➖ Minimal            |

## Work Unit Evidence

| Evidence                              | Value                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | `vitest run test/domain/plan test/application` → **263 passed / 15 files**; full `vitest run` → **804 passed / 40 files**                      |
| Runtime harness                       | Application init/status/undo/uninstall with temp FS + script fixtures; CLI `--scripts` / conflict messaging covered in program tests           |
| Rollback boundary                     | Revert commits `3182788..e29cf93` (+ openspec task/progress docs); removes Phase 2 install lifecycle without touching Phase 1 schema/list work |

## Verification (observed)

- Focused: `vitest run test/domain/plan test/application` → 263 passed
- Full: `vitest run` → **804 passed / 40 files**
- `tsc --noEmit`: pass
- `eslint .`: pass
- `prettier --check .`: pass

## Commits (Phase 2 on feat/catalog-scripts-install)

1. `3182788` feat(plan): add script install plan and ChangePlan.scripts
2. `b83c47e` feat(manifest): record kind script with tree-hash ownership
3. `4e18689` feat(init): install catalog scripts under shitaku-owned roots
4. `7152c79` feat(status): report script install states from tree hashes
5. `25da7d7` feat(undo): reverse script installs and refuse drifted trees
6. `e29cf93` feat(uninstall): support --kind script with collision and force

## Workload / PR Boundary

- Mode: stacked PR slice (PR2 → feat/catalog-scripts / PR1 tip)
- Current work unit: Install lifecycle
- Boundary: tasks 2.1–2.8 only; Phase 3+ not started
- Authored Phase 2 lines vs PR1 tip (`743e2c7..HEAD`, excl. pending openspec): **+933 / -104 = 1037** changed lines
- **Budget note**: cohesive Phase 2 unit exceeds 400-line review budget; recommend `size:exception` for PR2 (same as PR1). Do not absorb Phase 3.

## Deviations from Design

None material — scripts mirror skills with Paths/`stateDir` roots; `scriptsDir` lives in `journal.ts` next to `stateDir` and is re-exported from `init-mcps` for callers. Entry file written last is `index.mjs`.

## Issues Found

- Local `pnpm` packageManager self-switch store is broken in this worktree; commits used a PATH shim to `node_modules/.bin` so hooks still ran lint-staged.

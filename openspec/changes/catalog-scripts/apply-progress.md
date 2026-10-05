# Apply Progress: catalog-scripts

**Mode**: Strict TDD
**Batch**: Phase 1 / PR1 only (tasks 1.1–1.6)
**Branch**: feat/catalog-scripts
**Chain strategy**: stacked-to-main
**Status**: Phase 1 complete
**Date**: 2026-10-05

## Completed Tasks

- [x] 1.1 RED: `test/domain/catalog/script.test.ts` — parse `script.json`; reject invalid/guards
- [x] 1.2 GREEN: `src/domain/catalog/script.ts` — `ScriptItem`/`ScriptMetaSchema`
- [x] 1.3 RED→GREEN: `src/domain/scripts-paths.ts` + tests — project/user roots; not agent dirs
- [x] 1.4 RED→GREEN: `schema.ts`/`profile.ts`/`listing.ts` + tests — `items.scripts`, profile `scripts[]`, `LIST_KINDS`
- [x] 1.5 RED→GREEN: `folder-source.ts` + tests — `loadScripts`; empty OK
- [x] 1.6 RED→GREEN: CLI `list scripts` / JSON `"kind":"script"` in `program.ts` + tests

## Remaining (out of this batch)

- Phase 2–4 tasks still open (PR2–PR4)

## TDD Cycle Evidence

| Task    | Test File                                              | Layer       | Safety Net        | RED                            | GREEN                  | TRIANGULATE                            | REFACTOR             |
| ------- | ------------------------------------------------------ | ----------- | ----------------- | ------------------------------ | ---------------------- | -------------------------------------- | -------------------- |
| 1.1–1.2 | `test/domain/catalog/script.test.ts`                   | Unit        | N/A (new)         | ✅ Written (import miss)       | ✅ 11 passed           | ✅ schema + parse cases                | ✅ Clean             |
| 1.3     | `test/domain/scripts-paths.test.ts`                    | Unit        | N/A (new)         | ✅ Written (import miss)       | ✅ 4 passed            | ✅ project + user + agent-dir reject   | ➖ None needed       |
| 1.4     | `test/domain/catalog/{schema,profile,listing}.test.ts` | Unit        | ✅ 37/37          | ✅ Written (13 fail)           | ✅ 45 passed           | ✅ scripts index/profile/list          | ✅ Clean             |
| 1.5     | `test/adapters/catalog/folder-source.test.ts`          | Integration | ✅ 19/19          | ✅ Written (6 fail)            | ✅ 26 passed           | ✅ empty/valid/invalid/symlink/profile | ✅ Mirror loadSkills |
| 1.6     | `test/adapters/cli/program.test.ts`                    | Integration | ✅ 27 list passed | ✅ Written (scripts list/JSON) | ✅ 30 list + suite 762 | ✅ text + JSON kind                    | ➖ Description only  |

## Work Unit Evidence

| Evidence                              | Value                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | Full `pnpm test` → **762 passed / 39 files**                                                                                                    |
| Runtime harness                       | `list scripts` / `list --json` via CLI program tests with temp catalog containing scripts                                                       |
| Rollback boundary                     | Revert commits `500ebf9..76d6644` (+ optional openspec `4cf0250`); removes schema/paths/listing/folder-source/CLI list scripts without Phase 2+ |

## Verification (observed)

- `pnpm test`: 762 passed (39 files)
- `pnpm run typecheck`: pass
- `pnpm run lint`: pass
- `pnpm run format:check`: pass

## Commits (Phase 1)

1. `500ebf9` feat(catalog): add script.json schema and parseScript
2. `094d16b` feat(catalog): add shitaku-owned script install roots
3. `3d1effc` feat(catalog): extend index, profiles and list for scripts
4. `8523215` feat(catalog): load scripts from folder catalog sources
5. `011ad71` feat(cli): list catalog scripts in text and JSON
6. `76d6644` test(catalog): expect empty scripts on bundled profiles
7. `4cf0250` docs(openspec): record catalog-scripts Phase 1 task progress

## Workload / PR Boundary

- Mode: stacked PR slice (PR1 → main)
- Current work unit: Schema/load/list
- Boundary: tasks 1.1–1.6 only; Phase 2+ not started
- Authored impl lines vs origin/main (excluding openspec): ~546
- With openspec planning docs: ~1370
- **Budget note**: Phase 1 cohesive unit exceeds 400-line review budget; recommend `size:exception` for PR1 or review impl commits separately from openspec docs.

## Deviations from Design

None — implementation matches design for Phase 1 scope.

## Issues Found

- Bundled-catalog profile expectations needed `scripts: []` after ResolvedProfile extension.
- Branch diverged from origin/main (main advanced); rebase before PR open recommended.

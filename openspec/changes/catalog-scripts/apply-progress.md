# Apply Progress: catalog-scripts

**Mode**: Strict TDD
**Batch**: Phase 1–3 preserved + Phase 4 / PR4 (tasks 4.1–4.3)
**Branch**: feat/catalog-scripts-docs (stacked on feat/catalog-scripts-run / PR3)
**Chain strategy**: stacked-to-main
**Status**: Phase 4 complete — all tasks done
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

- [x] 2.1 RED→GREEN: `script-plan.ts` + `change-plan.ts` — create\|skip\|update\|conflict; dry-run/force
- [x] 2.2 RED→GREEN: `manifest.ts` — `kind:'script'` tree hash + ownership
- [x] 2.3 RED: init conflict exit 2 / dry-run no writes / unknown `--scripts`
- [x] 2.4 GREEN: `init-mcps.ts`/`skill-tree.ts`/`prompter.ts` — Paths roots; `--scripts`; prompts
- [x] 2.5 RED→GREEN: mid-write failure rollback — no partial dir; no manifest row
- [x] 2.6 RED→GREEN: `status-plan.ts`/`status.ts` — script states; unsafe → `modified`
- [x] 2.7 RED→GREEN: `undo-install.ts` — script undo; refuse drift
- [x] 2.8 RED→GREEN: `uninstall-item.ts` — `--kind script`; collision; modified exit 3 / force keeps extras

### Phase 3 (prior batch — preserved)

- [x] 3.1 RED (threat): reject path-like names; no spawn; never spawn metadata
- [x] 3.2 RED→GREEN: name/tool policy + Win path fixtures
- [x] 3.3 RED→GREEN: `process-runner.ts` + `node-process-runner.ts` — `shell:false`; exit passthrough; Win `.cmd`
- [x] 3.4 RED→GREEN: `run-script.ts` — bare list; project→user; args/exit; `.bin` then `npx`
- [x] 3.5 RED→GREEN: unknown name non-zero + suggest bare `run`
- [x] 3.6 RED→GREEN: `doctor-plan.ts`/`doctor.ts` — `info`/`script-tool-missing`; warn-only exit 0
- [x] 3.7 GREEN: CLI `run` + `main.ts` wire; architecture guard bans spawn in domain

### Phase 4 (this batch)

- [x] 4.1 Empty `catalog/scripts/` + `items.scripts: []`; no concrete scripts
- [x] 4.2 README/CONTRIBUTING + generators for scripts / `shitaku run`
- [x] 4.3 Verify: `pnpm test`, typecheck, lint, format:check, build

## Remaining

- None — all catalog-scripts tasks complete. Ready for sdd-verify / PR4 open (orchestrator).

## TDD Cycle Evidence

### Phase 1–3 (preserved)

See prior apply-progress revisions for full Phase 1–3 tables.

### Phase 4

| Task | Test File                                       | Layer       | Safety Net | RED                                   | GREEN         | TRIANGULATE                                           | REFACTOR       |
| ---- | ----------------------------------------------- | ----------- | ---------- | ------------------------------------- | ------------- | ----------------------------------------------------- | -------------- |
| 4.1  | `test/adapters/catalog/bundled-catalog.test.ts` | Integration | ✅ 3/3     | ✅ Written (`scripts` undefined fail) | ✅ 3 passed   | ✅ empty dir + loader `[]` + no concrete entries      | ✅ shared root |
| 4.2  | `test/adapters/catalog/bundled-catalog.test.ts` | Integration | ✅ 3/3     | ✅ Written (README markers missing)   | ✅ 4 passed   | ✅ markers + `shitaku run` + roots + `script.json`    | ➖ docs-only   |
| 4.3  | full suite + docs checks                        | Guard       | N/A        | ➖ verify gate                        | ✅ 835 passed | ✅ typecheck/lint/format/build/docs:catalog(:website) | ➖ None        |

Triangulation skipped for pure docs prose beyond README contract assertions: structural/generator updates validated by `docs:catalog:check` + `docs:website-catalog:check`.

## Work Unit Evidence

| Evidence                              | Value                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command and exact result | `vitest run test/adapters/catalog/bundled-catalog.test.ts` → **4 passed / 1 file**                                                   |
| Runtime harness                       | `pnpm run docs:catalog:check` + `docs:website-catalog:check` → up to date; empty `list`/loader path via bundled catalog              |
| Rollback boundary                     | Revert commits `fbfbc18..411a407` (+ openspec task/progress); removes empty scripts structure + docs without touching Phase 1–3 code |

## Verification (observed)

- Full: `vitest run` → **835 passed / 43 files**
- `tsc --noEmit`: pass
- `eslint .`: pass
- `prettier --check .`: pass
- `pnpm run build`: pass (`check-dist-aliases: 48 files clean`)
- `pnpm run docs:catalog:check`: pass
- `pnpm run docs:website-catalog:check`: pass

## Commits (Phase 4 on feat/catalog-scripts-docs)

1. `fbfbc18` feat(catalog): ship empty scripts catalog structure
2. `411a407` docs(catalog): document scripts kind and shitaku run

## Workload / PR Boundary

- Mode: stacked PR slice (PR4 → feat/catalog-scripts-run / PR3 tip)
- Current work unit: Empty catalog + docs
- Boundary: tasks 4.1–4.3 only
- Authored Phase 4 lines vs PR3 tip (`429ef18..HEAD`, excl. pending openspec): **+198 / -70 = 268** changed lines
- **Budget note**: within 400-line review budget; no size:exception needed for PR4
- PR4 may use `Closes #144` (final stacked slice)

## Deviations from Design

- None — empty `catalog/scripts/` + `items.scripts: []`, docs/generators cover scripts kind / `shitaku run` / scopes / metadata as designed. No concrete scripts shipped.

## Issues Found

- Local `pnpm` packageManager self-switch store remains broken on this worktree; commits used `.tmp-bin/pnpm` JS shim so husky still ran lint-staged.

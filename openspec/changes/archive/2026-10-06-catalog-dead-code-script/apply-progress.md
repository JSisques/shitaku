# Apply Progress: catalog-dead-code-script

**Mode**: Strict TDD (docs slice uses Standard docs-check gate)  
**Slice**: Phase 3 tasks 3.1–3.2 (Docs / Regen = PR3)  
**Delivery**: auto-chain, stacked-to-main  
**Updated**: 2026-10-06

## Completed Tasks

### Phase 1 (PR1) — prior batch

- [x] 1.1 RED: Flip `bundled-catalog.test.ts` to expect `complexity` and `dead-code`
- [x] 1.2 GREEN: Register `dead-code`; stub `index.mjs` + `script.json` (`tools:["knip"]`; exit 2)
- [x] 1.3 RED: Assert dead-code tree has no script-root npm bootstrap
- [x] 1.4 GREEN: Stub ships only `index.mjs` + `script.json`

### Phase 2 (PR2) — prior batch

- [x] 2.1 RED: Fixtures `test/fixtures/dead-code/**` (clean, unused-export, unused-file, unused-deps, with-config, defaults)
- [x] 2.2 RED: Spawn clean → 0 / findings → 1
- [x] 2.3 GREEN: Resolve knip (cwd `.bin` then `npx`); spawn `knip --reporter json` (`shell:false`)
- [x] 2.4 RED: Envelope schema/six keys/sort; JSON default; `--format text`; bad format → 2
- [x] 2.5 GREEN: Map issues → envelope; text formatter; format validation
- [x] 2.6 RED: `--include` filter/unknown; package.json deps split; unlisted; ambiguous → dependencies
- [x] 2.7 GREEN: Include filter + classify (peer/optional → prod)
- [x] 2.8 RED: Consumer `knip.json` ignoreIssues; defaults without config
- [x] 2.9 GREEN: No shipped knip config override
- [x] 2.10 RED (threat): `--fix` → 2 + no mutation; spawn/parse fail → 2
- [x] 2.11 GREEN: Reject `--fix` before spawn; exit 0/1 by included findings only

### Phase 3 (PR3) — this batch

- [x] 3.1 Regen README + website catalog tables for `dead-code`; verify `docs:catalog:check` and `docs:website-catalog:check` (both exit 0; no drift — tables already current from prior PR1 docs work)
- [x] 3.2 Soften complexity-only prose in `README.md`, `CONTRIBUTING.md`, and website catalog overview (en/es). Generator does **not** overwrite `overview.md` (only kind pages under mcps/skills/profiles/scripts); hand-edited overview.

## Remaining Tasks

None — all apply tasks 1.1–3.2 complete.

## Files Changed (Phase 3)

| File                                                          | Action   | What Was Done                                                      |
| ------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `README.md`                                                   | Modified | Scripts intro + install prose mention `complexity` and `dead-code` |
| `CONTRIBUTING.md`                                             | Modified | Bundled scripts list mentions both names                           |
| `website/src/content/docs/en/catalog/overview.md`             | Modified | Ships both scripts                                                 |
| `website/src/content/docs/es/catalog/overview.md`             | Modified | Ships both scripts                                                 |
| `openspec/changes/catalog-dead-code-script/tasks.md`          | Modified | Phase 3 tasks marked `[x]`                                         |
| `openspec/changes/catalog-dead-code-script/apply-progress.md` | Modified | Cumulative progress through Phase 3                                |

## TDD Cycle Evidence

| Task | Test File                                                    | Layer     | Safety Net       | RED          | GREEN                       | TRIANGULATE                                                      | REFACTOR                              |
| ---- | ------------------------------------------------------------ | --------- | ---------------- | ------------ | --------------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| 3.1  | `pnpm run docs:catalog:check` + `docs:website-catalog:check` | Docs gate | N/A (check mode) | ➖ N/A docs  | ✅ Both exit 0 (up to date) | ✅ README scripts table + website kind pages include `dead-code` | ➖ No regen needed                    |
| 3.2  | same checks after prose edits                                | Docs gate | N/A              | ➖ N/A prose | ✅ Checks still pass        | ✅ Four prose sites softened                                     | ➖ Hand edit overview (not generator) |

## Work Unit Evidence

| Evidence             | Result                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm run docs:catalog:check && pnpm run docs:website-catalog:check` → **exit 0** (tables up to date before and after prose edits) |
| Runtime harness      | N/A — docs check only (tasks forecast)                                                                                             |
| Rollback boundary    | Revert README/CONTRIBUTING/website overview prose + tasks/apply-progress checkboxes; catalog tables unchanged this slice           |

## Deviations from Design

None — docs regen already present; prose softened to ship both scripts; generator template not required for overview.

## Issues Found

None.

## Workload / PR Boundary

- Mode: chained/stacked PR slice (PR3)
- Current work unit: Docs / regen + prose softening
- Boundary: docs checks + complexity-only prose only; no script/runtime changes
- Estimated review budget impact: Low authored lines (prose-only)

## Status

17/17 apply tasks complete (Phases 1–3). Ready for orchestrator commit/PR3; next SDD phase: sdd-verify.

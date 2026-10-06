# Apply Progress: catalog-dead-code-script

**Mode**: Strict TDD  
**Slice**: Phase 2 tasks 2.1–2.11 (Behavior = PR2)  
**Delivery**: auto-chain, stacked-to-main  
**Updated**: 2026-10-06

## Completed Tasks

### Phase 1 (PR1) — prior batch

- [x] 1.1 RED: Flip `bundled-catalog.test.ts` to expect `complexity` and `dead-code`
- [x] 1.2 GREEN: Register `dead-code`; stub `index.mjs` + `script.json` (`tools:["knip"]`; exit 2)
- [x] 1.3 RED: Assert dead-code tree has no script-root npm bootstrap
- [x] 1.4 GREEN: Stub ships only `index.mjs` + `script.json`

### Phase 2 (PR2) — this batch

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

## Remaining Tasks

- [ ] Phase 3 (3.1–3.2): Docs / regen

## Files Changed (Phase 2)

| File                                                 | Action    | What Was Done                                                             |
| ---------------------------------------------------- | --------- | ------------------------------------------------------------------------- |
| `catalog/scripts/dead-code/index.mjs`                | Modified  | Full knip adapter: resolve, spawn, map, classify, include, formats, exits |
| `catalog/scripts/dead-code/script.json`              | Unchanged | Still `tools:["knip"]` only                                               |
| `test/catalog/scripts/dead-code.test.ts`             | Created   | Spawn suite (mock knip + real knip smoke + threat)                        |
| `test/fixtures/dead-code/**`                         | Created   | clean, unused-export, unused-file, unused-deps, with-config, defaults     |
| `openspec/changes/catalog-dead-code-script/tasks.md` | Modified  | Phase 2 tasks marked `[x]`                                                |

## TDD Cycle Evidence

| Task | Test File                                   | Layer       | Safety Net                                    | RED                                     | GREEN                  | TRIANGULATE                                            | REFACTOR                 |
| ---- | ------------------------------------------- | ----------- | --------------------------------------------- | --------------------------------------- | ---------------------- | ------------------------------------------------------ | ------------------------ |
| 2.1  | fixtures under `test/fixtures/dead-code/**` | Integration | N/A (new)                                     | ✅ Written (fixture trees)              | ✅ Used by spawn tests | ✅ 6 fixture variants                                  | ➖ Structural            |
| 2.2  | `test/catalog/scripts/dead-code.test.ts`    | Integration | ✅ stub RED (13 fail / 2 coincidental exit-2) | ✅ Written (exit 0/1)                   | ✅ Passed              | ✅ clean + unused export + unused file                 | ➖ None needed           |
| 2.3  | same                                        | Integration | N/A (production)                              | ✅ Driven by 2.2                        | ✅ Passed              | ✅ local `.bin` + fake-npx PATH fallback               | ✅ resolve helpers       |
| 2.4  | same                                        | Integration | via 2.2 net                                   | ✅ Written (envelope/format)            | ✅ Passed              | ✅ six keys + sort + text + bad format                 | ➖ None needed           |
| 2.5  | same                                        | Integration | N/A (production)                              | ✅ Driven by 2.4                        | ✅ Passed              | ✅ JSON + text paths                                   | ✅ map/sort pure helpers |
| 2.6  | same                                        | Integration | via suite                                     | ✅ Written (include/classify)           | ✅ Passed              | ✅ include empty→0; peer/optional; unlisted; ambiguous | ➖ None needed           |
| 2.7  | same                                        | Integration | N/A (production)                              | ✅ Driven by 2.6                        | ✅ Passed              | ✅ peer + optional + ambiguous                         | ✅ classifyDependency    |
| 2.8  | same                                        | Integration | via suite                                     | ✅ Written (config + defaults)          | ✅ Passed              | ✅ mock empty + real knip ignoreIssues                 | ➖ None needed           |
| 2.9  | same                                        | Integration | N/A (production)                              | ✅ Driven by 2.8 (no catalog knip.json) | ✅ Passed              | ✅ assert script dir has no knip config                | ➖ None needed           |
| 2.10 | same                                        | Integration | via suite                                     | ✅ Written (--fix/parse/spawn)          | ✅ Passed              | ✅ --fix no mutation + bad JSON + fatal shim           | ➖ None needed           |
| 2.11 | same                                        | Integration | N/A (production)                              | ✅ Driven by 2.10                       | ✅ Passed              | ✅ reject before spawn                                 | ➖ None needed           |

## Work Unit Evidence

| Evidence             | Result                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm exec vitest run test/catalog/scripts/dead-code.test.ts test/adapters/catalog/bundled-catalog.test.ts` → **21 passed** (exit 0)                                          |
| Runtime harness      | Spawn installed `dead-code` on fixtures: mock knip for unit-like control; real `knip@6.39.0` smoke on unused-export + with-config ignoreIssues                                |
| Rollback boundary    | Revert `catalog/scripts/dead-code/index.mjs` to stub; delete `test/catalog/scripts/dead-code.test.ts` and `test/fixtures/dead-code/`; keep Phase 1 registration/`script.json` |

## Deviations from Design

None — implementation matches design (cwd `.bin` then npx; no bootstrap; package.json classify; `--fix` → 2; six-key envelope).

## Issues Found

- Knip does not report unused exports on entry files; unused-export/with-config/defaults fixtures use a non-entry `lib.js` imported from `index.js`.
- Authored Phase 2 diff is large (~900+ lines with fixtures/tests) — expected for PR2 work unit under auto-chain; do not shrink by deleting tests.

## Workload / PR Boundary

- Mode: chained/stacked PR slice (PR2)
- Current work unit: Behavior (CLI/envelope/classify/exit/no-fix + fixtures/tests)
- Boundary: replaces stub body; adds fixtures + spawn suite; stops before Phase 3 docs regen
- Estimated review budget impact: High authored lines for this slice (honest work unit; chained as PR2)

## Status

Phase 1 + Phase 2 complete (15/15 apply tasks for PR1+PR2). Ready for orchestrator commit/PR2; Phase 3 docs next.

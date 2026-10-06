# Apply Progress: catalog-dead-code-script

**Mode**: Strict TDD  
**Slice**: Phase 1 tasks 1.1–1.4 (Registration / Guards = PR1)  
**Delivery**: auto-chain, stacked-to-main  
**Updated**: 2026-10-06

## Completed Tasks

- [x] 1.1 RED: Flip `bundled-catalog.test.ts` to expect `complexity` and `dead-code`
- [x] 1.2 GREEN: Register `dead-code`; stub `index.mjs` + `script.json` (`tools:["knip"]`; exit 2)
- [x] 1.3 RED: Assert dead-code tree has no script-root npm bootstrap
- [x] 1.4 GREEN: Stub ships only `index.mjs` + `script.json`

## Remaining Tasks

- [ ] Phase 2 (2.1–2.11): Behavior — knip spawn, envelope, fixtures, no-fix
- [ ] Phase 3 (3.1–3.2): Docs / regen

## Files Changed

| File                                            | Action   | What Was Done                                         |
| ----------------------------------------------- | -------- | ----------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts` | Modified | Expect both scripts; no-bootstrap guard for dead-code |
| `catalog/catalog.json`                          | Modified | `items.scripts` → `["complexity","dead-code"]`        |
| `catalog/scripts/dead-code/script.json`         | Created  | Metadata with `tools:["knip"]`                        |
| `catalog/scripts/dead-code/index.mjs`           | Created  | Stub: stderr message, exit 2 (Phase 2 replaces)       |

## TDD Cycle Evidence

| Task | Test File                                                  | Layer       | Safety Net       | RED                              | GREEN     | TRIANGULATE                                           | REFACTOR       |
| ---- | ---------------------------------------------------------- | ----------- | ---------------- | -------------------------------- | --------- | ----------------------------------------------------- | -------------- |
| 1.1  | `test/adapters/catalog/bundled-catalog.test.ts`            | Integration | ✅ 852/852       | ✅ Written (expect both scripts) | ✅ Passed | ✅ complexity bootstrap files + dead-code tools/files | ➖ None needed |
| 1.2  | same                                                       | Integration | N/A (production) | ✅ Driven by 1.1                 | ✅ Passed | ➖ Structural                                         | ➖ Stub only   |
| 1.3  | same (`ships dead-code without script-root npm bootstrap`) | Integration | ✅ via 1.1 net   | ✅ Written (ENOENT then pass)    | ✅ Passed | ✅ explicit not.toContain package.json/lock/nm        | ➖ None needed |
| 1.4  | same                                                       | Integration | N/A (production) | ✅ Driven by 1.3 file list       | ✅ Passed | ➖ Structural (only two files on disk)                | ➖ None needed |

## Work Unit Evidence

| Evidence             | Result                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm exec vitest run test/adapters/catalog/bundled-catalog.test.ts` → **5 passed** (exit 0)                                                                                                         |
| Runtime harness      | Stub smoke: `node catalog/scripts/dead-code/index.mjs` → stderr `dead-code: not implemented yet`, **exit 2**. Full `init --scripts dead-code` deferred to Phase 2/verify (behavior not implemented). |
| Rollback boundary    | Revert `catalog/catalog.json` scripts entry, delete `catalog/scripts/dead-code/`, restore prior complexity-only assertions in `bundled-catalog.test.ts`.                                             |

## Deviations from Design

None — registration + stub only; no knip spawning (Phase 2).

## Issues Found

- Registering `dead-code` makes `test/release-config.test.ts` (website catalog `--check`) fail until Phase 3 docs regen — expected; do not regen in PR1.
- `pnpm test -- test/adapters/catalog/bundled-catalog.test.ts` currently runs the full Vitest suite (passes `--` through); use `pnpm exec vitest run test/adapters/catalog/bundled-catalog.test.ts` for the focused Phase 1 gate (5 passed).

## Workload / PR Boundary

- Mode: chained/stacked PR slice (PR1)
- Current work unit: Registration / Guards
- Boundary: catalog registration + stub + bundled guards; stops before knip behavior/fixtures/docs
- Estimated review budget impact: small authored diff (well under 400 for this slice)

## Status

4/4 Phase 1 tasks complete. Ready for next batch (Phase 2) or orchestrator commit/PR1.

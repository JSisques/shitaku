# Apply Progress: catalog-complexity-script

**Mode**: Strict TDD  
**Slice**: PR1 Foundation + ADR-2 (Phase 1 tasks 1.1–1.6)  
**Delivery**: auto-chain / stacked-to-main  
**Updated**: 2026-10-05

## Completed Tasks

- [x] 1.1 RED: Flip empty-scripts guard in `test/adapters/catalog/bundled-catalog.test.ts`
- [x] 1.2 GREEN: Register `complexity` stubs in catalog
- [x] 1.3 RED: ADR-2 walk skip top-level `node_modules/`
- [x] 1.4 GREEN: Skip top-level `node_modules/` in `walk.ts`
- [x] 1.5 RED: Undo/uninstall recursive `node_modules/` coverage
- [x] 1.6 GREEN: Remove script-root `node_modules/` on uninstall/undo

## Remaining Tasks

- [ ] Phase 2 (PR2): 2.1–2.10 behavior / D1A–D4A
- [ ] Phase 3 (PR3): 3.1–3.3 docs / regen

## Work Unit Evidence

| Evidence             | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command | `pnpm exec vitest run test/adapters/catalog/bundled-catalog.test.ts test/adapters/fs/walk.test.ts test/application/uninstall-item.test.ts` |
| Focused test result  | exit 0 — 3 files, **59 passed**                                                                                                            |
| Runtime harness      | `pnpm run build && node dist/main.js init --scripts complexity --scope project --dry-run`                                                  |
| Runtime result       | exit 0 — `complexity: create`, `dry run: nothing was written`                                                                              |
| Rollback boundary    | Revert catalog entry/stubs + walk/uninstall/undo ADR-2 + empty-scripts guard flip; Phase 2/3 untouched                                     |

## TDD Cycle Evidence

| Task | Test File                                            | Layer       | Safety Net                     | RED                               | GREEN               | TRIANGULATE                                     | REFACTOR                                  |
| ---- | ---------------------------------------------------- | ----------- | ------------------------------ | --------------------------------- | ------------------- | ----------------------------------------------- | ----------------------------------------- |
| 1.1  | `test/adapters/catalog/bundled-catalog.test.ts`      | Unit        | ✅ 838/838 baseline            | ✅ Written (expect complexity)    | ✅ 4/4 via 1.2      | ✅ index + dir + load + tools + files           | ➖ None needed                            |
| 1.2  | (same)                                               | Unit        | N/A (new stubs)                | (driven by 1.1)                   | ✅ Catalog loadable | ➖ Structural stub                              | ➖ Minimal stubs                          |
| 1.3  | `test/adapters/fs/walk.test.ts`                      | Unit        | ✅ prior walk suite green      | ✅ Written (top-level skip fails) | ✅ 24/24 via 1.4    | ✅ nested `vendor/node_modules` still walked    | ✅ one-line skip + ADR-2 comment          |
| 1.4  | `src/adapters/fs/walk.ts`                            | Unit        | (same)                         | (driven by 1.3)                   | ✅ Passed           | (with 1.3)                                      | ✅ Clean                                  |
| 1.5  | `test/application/uninstall-item.test.ts`            | Integration | ✅ prior uninstall suite green | ✅ 3 failing cases                | ✅ 31/31 via 1.6    | ✅ uninstall clean / force+extra / undo install | ➖ None needed                            |
| 1.6  | `uninstall-item.ts`, `undo-install.ts`, `node-fs.ts` | Integration | (same)                         | (driven by 1.5)                   | ✅ Passed           | (with 1.5)                                      | ✅ recursive `remove` + script-only roots |

### Test Summary

- **Total tests written**: 5 new behavioral cases (1 catalog flip, 2 walk, 3 uninstall/undo)
- **Total tests passing (focused)**: 59
- **Layers used**: Unit (catalog, walk), Integration (uninstall/undo)
- **Approval tests**: None — behavior change, not pure refactor
- **Pure functions created**: 0 (`scriptRoots` helper is a small Set projection)

## Files Changed

| File                                            | Action   | What Was Done                                                                             |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `catalog/catalog.json`                          | Modified | `items.scripts: ["complexity"]`                                                           |
| `catalog/scripts/complexity/*`                  | Created  | Stub `index.mjs` (exit 2), `script.json` (D2A tools), `eslint.config.mjs`, `package.json` |
| `test/adapters/catalog/bundled-catalog.test.ts` | Modified | Expect complexity registered/loadable                                                     |
| `test/adapters/fs/walk.test.ts`                 | Modified | ADR-2 skip + nested triangulation                                                         |
| `src/adapters/fs/walk.ts`                       | Modified | Skip top-level `node_modules/`                                                            |
| `test/application/uninstall-item.test.ts`       | Modified | Uninstall/undo nm cleanup cases                                                           |
| `src/application/uninstall-item.ts`             | Modified | Remove script-root `node_modules` on uninstall                                            |
| `src/application/undo-install.ts`               | Modified | Remove script-root `node_modules` on undo                                                 |
| `src/adapters/fs/node-fs.ts`                    | Modified | `remove` recursive                                                                        |
| `src/ports/file-system.ts`                      | Modified | Document recursive `remove`                                                               |
| `openspec/.../tasks.md`                         | Modified | Phase 1 marked `[x]`                                                                      |

## Deviations from Design

None — implementation matches ADR-2 (top-level walk skip; recursive rm on undo/uninstall). Stub body intentionally exits 2 (PR2 owns D1A–D4A). `skill-tree.ts` unchanged; skip lives in shared `listTree`/`scan`.

## Issues Found

- Branch tracks / is behind `origin/main` by 7 commits; rebase/ff before opening PR1.
- OpenSpec planning artifacts (proposal/design/research/…) were untracked from prior phases; including them in PR1 authored count may push over 400 — see workload note.

## Workload / PR Boundary

- Mode: stacked PR slice (PR1 → main)
- Current work unit: Foundation + ADR-2
- Boundary: catalog registration + ADR-2 only; no script behavior, no docs regen
- Authored implementation (code+stubs+tests): **~122** lines (add+del)
- OpenSpec planning folder (if included): **~760** lines — recommend either (a) commit planning artifacts in PR1 with `size:exception` for docs/history, or (b) land planning in a tiny stacked precursor; **implementation alone is well under budget**

## Status

6/19 tasks complete (Phase 1 / PR1 done). Next: open PR1 after rebase onto main, then `sdd-apply` for PR2 — or verify PR1 first if opening immediately.

# Apply Progress: catalog-complexity-script

**Mode**: Strict TDD  
**Slice**: PR1 + PR2 + PR3 (docs/regen) complete  
**Delivery**: auto-chain / stacked-to-main  
**Updated**: 2026-10-05

## Completed Tasks

### PR1 Foundation + ADR-2

- [x] 1.1 RED: Flip empty-scripts guard in `test/adapters/catalog/bundled-catalog.test.ts`
- [x] 1.2 GREEN: Register `complexity` stubs in catalog
- [x] 1.3 RED: ADR-2 walk skip top-level `node_modules/`
- [x] 1.4 GREEN: Skip top-level `node_modules/` in `walk.ts`
- [x] 1.5 RED: Undo/uninstall recursive `node_modules/` coverage
- [x] 1.6 GREEN: Remove script-root `node_modules/` on uninstall/undo

### PR2 Behavior (D1A–D4A)

- [x] 2.1 RED: Fixtures + spawn exit 0/1 cases
- [x] 2.2 GREEN: D1A self-bootstrap + local eslint + package-lock
- [x] 2.3 RED: D4A JSON shape/sort/cognitive-zero, text format, unsupported → 2
- [x] 2.4 GREEN: Map ESLint JSON → envelope; CLI thresholds/formats
- [x] 2.5 RED: Ignore `.gitignore` + fixed `node_modules`/`.git`; shipped `-c`
- [x] 2.6 GREEN: D3A `includeIgnoreFile` + fixed ignores (per-run config)
- [x] 2.7 RED (threat): Tool failure → exit 2; consumer package.json unchanged
- [x] 2.8 GREEN: `shell:false`; npm cwd = script install root only
- [x] 2.9 RED: Doctor five tools → `script-tool-missing` info when binless
- [x] 2.10 GREEN: Finalize `script.json` D2A tools list

### PR3 Docs / regen

- [x] 3.1 Soften empty-scripts prose in README + CONTRIBUTING
- [x] 3.2 Regen README + website catalog tables; docs checks pass
- [x] 3.3 Website lists `complexity`; overview copy updated (en/es)

## Remaining Tasks

- None (19/19 tasks complete; verify/archive when PR chain lands)

## Decision: cognitive threshold 0 vs -1

**Choice: `0`.** Fixture evidence on `test/fixtures/complexity/under/simple.js`:

- With `sonarjs/cognitive-complexity: ['error', 0]`, simple functions emit only cyclomatic messages; join fills `cognitive: 0`.
- Over fixtures still emit cognitive scores (e.g. nested TS → cognitive 120) and merge by file+line.
- Threshold `-1` unnecessary for D4A zero-fill; keeps sonar noise lower on trivial functions.

## Decision: eslint major + includeIgnoreFile

- ESLint **10** + `eslint-plugin-sonarjs` **4** (peer supports eslint 10).
- ESLint 9.39 `eslint/config` does **not** export `includeIgnoreFile`; ESLint 10 does.
- Per-run temp config under script root (unique filename) so consumer `.gitignore` is not frozen by ESM module cache; cleaned up before `process.exit`.

## Work Unit Evidence

### PR1 (preserved)

| Evidence             | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command | `pnpm exec vitest run test/adapters/catalog/bundled-catalog.test.ts test/adapters/fs/walk.test.ts test/application/uninstall-item.test.ts` |
| Focused test result  | exit 0 — 3 files, **59 passed**                                                                                                            |
| Runtime harness      | `pnpm run build && node dist/main.js init --scripts complexity --scope project --dry-run`                                                  |
| Runtime result       | exit 0 — `complexity: create`, `dry run: nothing was written`                                                                              |
| Rollback boundary    | Revert catalog entry/stubs + walk/uninstall/undo ADR-2 + empty-scripts guard flip; Phase 2/3 untouched                                     |

### PR2 Behavior

| Evidence             | Value                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `node node_modules/vitest/vitest.mjs run test/catalog/scripts/complexity.test.ts test/application/doctor.test.ts`                       |
| Focused test result  | exit 0 — 2 files, **23 passed**                                                                                                         |
| Also verified        | `bundled-catalog.test.ts` expects package-lock + eslint.rules — **27 passed** with those three files                                    |
| Runtime harness      | Spawn installed/`catalog` complexity on under (exit 0) and over (exit 1) fixtures                                                       |
| Runtime result       | under → exit 0 JSON with `underJs`/`underTs`; over → exit 1 with exceedances; gitignore probe → tracked only                            |
| Rollback boundary    | Revert `catalog/scripts/complexity/**` body+lock + `test/fixtures/complexity/**` + complexity/doctor tests; keep PR1 registration/ADR-2 |

## TDD Cycle Evidence

### PR1 (preserved)

| Task | Test File                                            | Layer       | Safety Net                     | RED                               | GREEN               | TRIANGULATE                                     | REFACTOR                                  |
| ---- | ---------------------------------------------------- | ----------- | ------------------------------ | --------------------------------- | ------------------- | ----------------------------------------------- | ----------------------------------------- |
| 1.1  | `test/adapters/catalog/bundled-catalog.test.ts`      | Unit        | ✅ 838/838 baseline            | ✅ Written (expect complexity)    | ✅ 4/4 via 1.2      | ✅ index + dir + load + tools + files           | ➖ None needed                            |
| 1.2  | (same)                                               | Unit        | N/A (new stubs)                | (driven by 1.1)                   | ✅ Catalog loadable | ➖ Structural stub                              | ➖ Minimal stubs                          |
| 1.3  | `test/adapters/fs/walk.test.ts`                      | Unit        | ✅ prior walk suite green      | ✅ Written (top-level skip fails) | ✅ 24/24 via 1.4    | ✅ nested `vendor/node_modules` still walked    | ✅ one-line skip + ADR-2 comment          |
| 1.4  | `src/adapters/fs/walk.ts`                            | Unit        | (same)                         | (driven by 1.3)                   | ✅ Passed           | (with 1.3)                                      | ✅ Clean                                  |
| 1.5  | `test/application/uninstall-item.test.ts`            | Integration | ✅ prior uninstall suite green | ✅ 3 failing cases                | ✅ 31/31 via 1.6    | ✅ uninstall clean / force+extra / undo install | ➖ None needed                            |
| 1.6  | `uninstall-item.ts`, `undo-install.ts`, `node-fs.ts` | Integration | (same)                         | (driven by 1.5)                   | ✅ Passed           | (with 1.5)                                      | ✅ recursive `remove` + script-only roots |

### PR2

| Task | Test File                                 | Layer       | Safety Net            | RED                                       | GREEN                    | TRIANGULATE                                 | REFACTOR                                    |
| ---- | ----------------------------------------- | ----------- | --------------------- | ----------------------------------------- | ------------------------ | ------------------------------------------- | ------------------------------------------- |
| 2.1  | `test/catalog/scripts/complexity.test.ts` | Integration | N/A (new)             | ✅ Written (stub exit 2)                  | ✅ via 2.2               | ✅ under exit 0 + over exit 1               | ➖                                          |
| 2.2  | (impl)                                    | Integration | N/A                   | (driven by 2.1)                           | ✅ npm ci + local eslint | ➖ bootstrap structural                     | ✅ realpath targets; throw-not-exit cleanup |
| 2.3  | `complexity.test.ts`                      | Integration | ✅ 2.1 green          | ✅ shape/sort/zero/text/bad-format        | ✅ via 2.4               | ✅ JSON fields + text table + format exit 2 | ➖                                          |
| 2.4  | `index.mjs` map/thresholds                | Integration | (same)                | (driven by 2.3)                           | ✅ Passed                | (with 2.3)                                  | ✅ named cyclomatic parse                   |
| 2.5  | `complexity.test.ts`                      | Integration | ✅ prior green        | ✅ gitignore + nm/.git + conflicting `-c` | ✅ via 2.6               | ✅ tracked present; ignored/nm/.git absent  | ➖                                          |
| 2.6  | `eslint.config.mjs` + runtime config      | Integration | (same)                | (driven by 2.5)                           | ✅ Passed                | (with 2.5)                                  | ✅ per-run config for ESM cache + D3A       |
| 2.7  | `complexity.test.ts` threat               | Integration | ✅ prior green        | ✅ broken eslint bin → 2; pkg unchanged   | ✅ via 2.8               | ✅ bootstrap success then fail path         | ➖                                          |
| 2.8  | `index.mjs` spawn                         | Integration | (same)                | (driven by 2.7)                           | ✅ Passed                | ➖ shell:false + SCRIPT_ROOT npm cwd        | ➖                                          |
| 2.9  | `test/application/doctor.test.ts`         | Integration | ✅ doctor suite green | ✅ five D2A tools → info findings         | ✅ (no code change)      | ✅ five tools sorted                        | ➖                                          |
| 2.10 | `script.json`                             | Unit        | N/A                   | (asserted via catalog + doctor)           | ✅ tools finalized       | ➖ Single structural                        | ➖ description stub removed                 |

### Test Summary (PR2 batch)

- **Total tests written**: 7 complexity spawn cases + 1 doctor five-tools case
- **Total tests passing (focused PR2)**: 23 (complexity + doctor); 27 including bundled-catalog
- **Layers used**: Integration (spawn), Integration (doctor)
- **Approval tests**: None
- **Pure functions created**: map/sort helpers inside `index.mjs` (script-local)

## Files Changed (PR2)

| File                                                      | Action   | What Was Done                                                          |
| --------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `catalog/scripts/complexity/index.mjs`                    | Modified | D1A bootstrap, eslint spawn, D4A map, thresholds, formats, threat-safe |
| `catalog/scripts/complexity/complexity.eslint.config.mjs` | Created  | D3A includeIgnoreFile + fixed ignores (non-auto-load name)             |
| `catalog/scripts/complexity/eslint.config.mjs`            | Deleted  | Renamed away from auto-discovered flat-config filename                 |
| `catalog/scripts/complexity/eslint.rules.mjs`             | Created  | Shared complexity/sonar rules                                          |
| `catalog/scripts/complexity/package.json`                 | Modified | eslint 10 + sonarjs 4                                                  |
| `catalog/scripts/complexity/package-lock.json`            | Created  | Shipped lock for `npm ci`                                              |
| `catalog/scripts/complexity/script.json`                  | Modified | Description; D2A tools already present                                 |
| `test/fixtures/complexity/**`                             | Created  | under/over/gitignore fixtures                                          |
| `test/catalog/scripts/complexity.test.ts`                 | Created  | Spawn RED/GREEN coverage                                               |
| `test/application/doctor.test.ts`                         | Modified | Five-tool binless info                                                 |
| `test/adapters/catalog/bundled-catalog.test.ts`           | Modified | Expect lock + rules files                                              |
| `openspec/.../tasks.md`                                   | Modified | Phase 2 marked `[x]`                                                   |

## Deviations from Design

- Per-run eslint config file under script root (unique name) instead of only static `complexity.eslint.config.mjs`, because ESM caches flat configs by URL and would freeze the first consumer `.gitignore`. Still uses shipped rules + `includeIgnoreFile` + `-c` (not consumer config).
- Tool versions: eslint 10 / sonarjs 4 (design ranges were ^9/^3); required for `includeIgnoreFile` named export and sonar peer range.
- Shipped config file named `complexity.eslint.config.mjs` (not `eslint.config.mjs`) so repo lint-staged does not auto-load the scoring rules against the script sources.

## Issues Found

- macOS `/var` vs `/private/var` broke absolute lint targets until `realpathSync` normalization.
- `process.exit` inside `try` skipped `finally` cleanup; switched fail paths to throw + exit after cleanup.

## Workload / PR Boundary

- Mode: stacked PR slice (PR2 → `feat/catalog-complexity-script`)
- Current work unit: Behavior / D1A–D4A
- Boundary: script body + fixtures/tests/doctor; no docs regen (PR3)
- Authored implementation+tests (excl. lockfile): **~657** add+del
- With `package-lock.json` (generated): **~2050** add+del
- **size:exception**: after one honest pass, PR2 cannot cohesive-split further (behavior+lock+spawn tests are one unit); lockfile is required by design for D1A `npm ci`

## Status

16/19 tasks complete (Phase 1 + Phase 2 done). Next: orchestrator opens chained PR2; then `sdd-apply` for PR3 docs or `sdd-verify` on PR2.

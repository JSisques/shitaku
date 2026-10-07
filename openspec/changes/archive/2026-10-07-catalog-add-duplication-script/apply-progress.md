# Apply Progress: catalog-add-duplication-script

**Batch**: PR 2 remediation (sdd-verify FAIL candidates); prior PR 1 + PR 2 retained
**Mode**: Strict TDD
**Date**: 2026-10-06
**Delivery**: auto-chain / stacked-to-main

## Completed Tasks

### PR 1 (retained)

- [x] 1.1 Fixtures `test/fixtures/duplication/{clone,clean}/`
- [x] 1.2 Reject `--baseline` → exit 2; project files unchanged
- [x] 1.3 Never forward shitaku `--format` to jscpd argv
- [x] 1.4 No leftover cwd `report/` after runs
- [x] 1.5 Unparsable/missing report or spawn failure → exit 2
- [x] 1.6 Clean → exit 0 + empty clones; clone over threshold → exit 1
- [x] 1.7 Envelope `shitaku.catalog.duplication/v1`; text format; bad format → 2
- [x] 1.8 Focused test run RED (ENOENT before script existed)
- [x] 2.1 `catalog/scripts/duplication/script.json`
- [x] 2.2 `catalog/scripts/duplication/index.mjs` adapter
- [x] 2.3 Defaults: gitignore, ignore paths, threshold 0, reject baseline
- [x] 2.4 GREEN all Phase 1 tests
- [x] 2.5 local-bin vs fake-npx + ignore-path argv asserts

### PR 2 (retained)

- [x] 3.1 RED bundled-catalog expects `duplication` with complexity/dead-code; no script-root npm bootstrap
- [x] 3.2 Append `duplication` after `dead-code` in `catalog/catalog.json` `items.scripts`
- [x] 3.3 GREEN bundled-catalog; shipped files `index.mjs` + `script.json` only
- [x] 4.1 Regen docs: `pnpm run docs:catalog` and `pnpm run docs:website-catalog`
- [x] 4.2 Full gate: test, typecheck, lint, format:check (no `src/**`)

## Remaining Tasks

- [ ] 4.3 Defer `openspec/specs/scripts-install/spec.md` merge to sdd-archive

## Remediation Note (sdd-verify FAIL → apply)

Closed verify gaps without reopening completed planning tasks:

1. **CRITICAL UNTESTED — Project install root duplication**: added `initMcps (bundled duplication script)` in `test/application/init-mcps.test.ts` mirroring dead-code — installs under `<cwd>/.shitaku/scripts/duplication/` with `index.mjs` + `script.json` only (bootstrap-free).
2. **WARNING PARTIAL — ignore defaults argv-only**: added fixture `test/fixtures/duplication/ignored-only/` (clones under `node_modules/` + `dist/` only) and behavioral tests in `duplication.test.ts` with mock `respectIgnore` — exit 0 + empty clones when only ignored-path clones exist; triangulated with non-ignored clone still exit 1.

## TDD Cycle Evidence

### PR 1 (retained)

| Task    | Test File                                  | Layer       | Safety Net   | RED                  | GREEN        | TRIANGULATE                             | REFACTOR            |
| ------- | ------------------------------------------ | ----------- | ------------ | -------------------- | ------------ | --------------------------------------- | ------------------- |
| 1.1     | fixtures only                              | N/A         | N/A (new)    | ➖ Structural        | ➖ Fixtures  | ➖ Triangulation skipped: fixture trees | ➖ None needed      |
| 1.2     | `test/catalog/scripts/duplication.test.ts` | Integration | N/A (new)    | ✅ Written           | ✅ Passed    | ✅ mutate check + stderr                | ➖ None needed      |
| 1.3     | same                                       | Integration | N/A (new)    | ✅ Written           | ✅ Passed    | ✅ text + json formats                  | ➖ None needed      |
| 1.4     | same                                       | Integration | N/A (new)    | ✅ Written           | ✅ Passed    | ✅ pathExists + readdir                 | ➖ None needed      |
| 1.5     | same                                       | Integration | N/A (new)    | ✅ Written           | ✅ Passed    | ✅ failParse + missing + spawn          | ➖ None needed      |
| 1.6     | same                                       | Integration | N/A (new)    | ✅ Written           | ✅ Passed    | ✅ clean exit 0 + clone exit 1          | ➖ None needed      |
| 1.7     | same                                       | Integration | N/A (new)    | ✅ Written           | ✅ Passed    | ✅ JSON + text + bad format             | ➖ None needed      |
| 1.8     | same                                       | Integration | N/A (new)    | ✅ Suite fail ENOENT | —            | —                                       | —                   |
| 2.1–2.3 | same                                       | Integration | N/A (new)    | ✅ Prior RED         | ✅ 13/13     | ✅ covered by 1.x                       | ✅ Mirror dead-code |
| 2.4     | same                                       | Integration | ✅ prior RED | —                    | ✅ 13 passed | —                                       | ➖ None needed      |
| 2.5     | same                                       | Integration | N/A (new)    | ✅ Written           | ✅ Passed    | ✅ local-bin + npx + ignore argv        | ➖ None needed      |

### PR 2 (retained)

| Task | Test File                                       | Layer       | Safety Net                                                 | RED                                             | GREEN                                 | TRIANGULATE                                | REFACTOR                          |
| ---- | ----------------------------------------------- | ----------- | ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- | ------------------------------------------ | --------------------------------- |
| 3.1  | `test/adapters/catalog/bundled-catalog.test.ts` | Integration | ⚠️ Pre-existing fail: PR1 dir present, not in catalog.json | ✅ Written (expect 3 scripts + bootstrap-free)  | —                                     | ✅ list + load + bootstrap paths           | ➖ None needed                    |
| 3.2  | catalog.json                                    | N/A         | —                                                          | —                                               | ✅ Append after dead-code             | ➖ Structural                              | ➖ None needed                    |
| 3.3  | same test                                       | Integration | —                                                          | ✅ Prior RED (catalog.json missing duplication) | ✅ 5/5                                | ✅ tools jscpd + files only                | ➖ Prettier gate fix on index.mjs |
| 4.1  | docs regen                                      | N/A         | N/A                                                        | ➖ Structural                                   | ✅ README + website pages             | ➖ Triangulation skipped: generated tables | ➖ None needed                    |
| 4.2  | full gate                                       | Integration | ✅ suite green after format                                | ➖ Gate                                         | ✅ 883 tests; typecheck; lint; format | ➖ N/A                                     | ✅ Prettier on slice files        |

### Remediation batch (this apply)

| Task                                       | Test File                                             | Layer       | Safety Net               | RED                                                               | GREEN               | TRIANGULATE                                       | REFACTOR       |
| ------------------------------------------ | ----------------------------------------------------- | ----------- | ------------------------ | ----------------------------------------------------------------- | ------------------- | ------------------------------------------------- | -------------- |
| R1 Project install root duplication        | `test/application/init-mcps.test.ts`                  | Integration | ✅ dead-code install 1/1 | ➖ Coverage gap: production already installs; test written first  | ✅ 1/1 passed       | ✅ bootstrap-free + jscpd script.json + no skills | ➖ None needed |
| R2 Behavioral ignore (ignored-path clones) | `test/catalog/scripts/duplication.test.ts` + fixtures | Integration | ✅ 13/13 prior           | ✅ Written: exit 1 before respectIgnore mock (clone payload kept) | ✅ 15/15 after mock | ✅ ignored-only exit 0 empty + clone still exit 1 | ➖ None needed |

## Work Unit Evidence

### PR 1 (retained)

| Evidence                              | Value                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | `pnpm exec vitest run test/catalog/scripts/duplication.test.ts` → **13 passed (13)** exit 0              |
| Runtime harness                       | N/A: mock `.bin/jscpd` spawn; no agent/runtime install (per tasks)                                       |
| Rollback boundary                     | `catalog/scripts/duplication/`, `test/catalog/scripts/duplication.test.ts`, `test/fixtures/duplication/` |

### PR 2 (retained)

| Evidence                              | Value                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | `pnpm exec vitest run test/adapters/catalog/bundled-catalog.test.ts` → **5 passed (5)** exit 0                                                                                           |
| Runtime harness                       | `pnpm run docs:catalog:check` + `pnpm run docs:website-catalog:check` → both exit 0 (tables/pages up to date)                                                                            |
| Rollback boundary                     | `catalog/catalog.json` scripts entry, `test/adapters/catalog/bundled-catalog.test.ts` asserts, README catalog markers, `website/src/content/docs/{en,es}/catalog/scripts/duplication.md` |

### Remediation batch (this apply)

| Evidence                              | Value                                                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | `pnpm exec vitest run test/catalog/scripts/duplication.test.ts` → **15 passed**; `init-mcps` `-t "bundled duplication"` → **1 passed**; full `pnpm run test` → **886 passed** |
| Runtime harness                       | initMcps project-scope install of bundled `duplication` under `.shitaku/scripts/` (real FolderCatalogSource + apply path)                                                     |
| Rollback boundary                     | `test/application/init-mcps.test.ts` describe block; `test/catalog/scripts/duplication.test.ts` respectIgnore + ignored-only cases; `test/fixtures/duplication/ignored-only/` |

## Files Changed

### PR 1 (retained)

| File                                                                     | Action  |
| ------------------------------------------------------------------------ | ------- |
| `test/fixtures/duplication/clone/{a.js,b.js,package.json}`               | Created |
| `test/fixtures/duplication/clean/{unique-a.js,unique-b.js,package.json}` | Created |
| `test/catalog/scripts/duplication.test.ts`                               | Created |
| `catalog/scripts/duplication/script.json`                                | Created |
| `catalog/scripts/duplication/index.mjs`                                  | Created |

### PR 2 (retained)

| File                                                         | Action                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts`              | Modified — expect three scripts; bootstrap-free for dead-code + duplication |
| `catalog/catalog.json`                                       | Modified — append `duplication` after `dead-code`                           |
| `README.md`                                                  | Modified — docs:catalog regen                                               |
| `website/src/content/docs/en/catalog/scripts/duplication.md` | Created — docs:website-catalog                                              |
| `website/src/content/docs/es/catalog/scripts/duplication.md` | Created — docs:website-catalog                                              |
| `catalog/scripts/duplication/index.mjs`                      | Modified — Prettier only (gate; no behavior change)                         |
| `openspec/changes/catalog-add-duplication-script/*`          | Modified — tasks checkboxes + apply-progress merge; Prettier                |

### Remediation batch (this apply)

| File                                                                | Action                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `test/application/init-mcps.test.ts`                                | Modified — `initMcps (bundled duplication script)` install root scenario   |
| `test/catalog/scripts/duplication.test.ts`                          | Modified — `respectIgnore` mock + ignored-only + non-ignored triangulation |
| `test/fixtures/duplication/ignored-only/**`                         | Created — clones only under `node_modules/` and `dist/`                    |
| `openspec/changes/catalog-add-duplication-script/apply-progress.md` | Modified — merge remediation note + TDD evidence                           |

## Workload / PR Boundary

- Mode: stacked PR slice (PR 2 remediation attaches to PR2)
- Current work unit: verify remediation — install-root runtime test + behavioral ignore
- Boundary: test-only; no `src/**`; no catalog production changes
- Authored review impact (remediation exclusive): ~+120 lines (init-mcps describe + mock/tests + fixture tree)
- Under 400-line budget for this remediation slice

## Deviations from Design

None — remediation closes verify coverage gaps only; scripts-install main-spec merge still deferred (task 4.3).

## Issues Found

None new. Prior PR2 notes retained (format Prettier gate on index.mjs).

## Status

15/16 task checkboxes for full change complete; **PR 2 + verify remediation complete**. Remaining: 4.3 archive-only. Ready for sdd-verify (no commit in this batch).

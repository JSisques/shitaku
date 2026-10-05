# Tasks: Catalog Complexity Script

## Review Workload Forecast

| Field                   | Value                                                      |
| ----------------------- | ---------------------------------------------------------- |
| Estimated changed lines | 550–850 authored                                           |
| 400-line budget risk    | High                                                       |
| Chained PRs recommended | Yes                                                        |
| Suggested split         | PR1 Foundation+ADR-2 → PR2 Behavior/tests → PR3 Docs/regen |
| Delivery strategy       | auto-chain                                                 |
| Chain strategy          | stacked-to-main                                            |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                                | Likely PR              | Focused test command                                                                                                               | Runtime harness                                                         | Rollback boundary                                                  |
| ---- | ------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1    | Register `complexity` + ADR-2 nm skip/rm; flip empty-scripts guards | PR1 → main             | `pnpm test -- test/adapters/catalog/bundled-catalog.test.ts test/adapters/fs/walk.test.ts test/application/uninstall-item.test.ts` | `node dist/main.js init --scripts complexity --scope project --dry-run` | Catalog entry/stubs + walk/undo only; restore empty-scripts guards |
| 2    | D1A–D4A CLI/JSON/thresholds/ignore/TS + doctor info                 | PR2 → main (after PR1) | `pnpm test -- test/catalog/scripts/complexity.test.ts test/application/doctor.test.ts`                                             | Spawn installed `complexity` on under/over fixtures                     | Script body + fixtures/tests; keep registration                    |
| 3    | Docs tables + README/CONTRIBUTING/website                           | PR3 → main (after PR2) | `pnpm run docs:catalog:check && pnpm run docs:website-catalog:check`                                                               | N/A — docs check only                                                   | Doc/table regen only                                               |

## Phase 1: Foundation + ADR-2 (PR1)

- [x] 1.1 RED: Flip empty-scripts guard in `test/adapters/catalog/bundled-catalog.test.ts` to expect `complexity` registered/loadable.
- [x] 1.2 GREEN: Set `items.scripts: ["complexity"]` in `catalog/catalog.json`; add stub `catalog/scripts/complexity/{index.mjs,script.json,eslint.config.mjs,package.json}` (D2A five tools; stub exits 2).
- [x] 1.3 RED: Assert ADR-2 in `test/adapters/fs/walk.test.ts` — script present walk skips top-level `node_modules/`.
- [x] 1.4 GREEN: Skip script-root `node_modules/` in `src/adapters/fs/walk.ts` (and `src/application/skill-tree.ts` if needed).
- [x] 1.5 RED: Cover recursive script-root `node_modules/` delete on undo/uninstall in `test/application/uninstall-item.test.ts`.
- [x] 1.6 GREEN: Remove script-root `node_modules/` in `src/application/uninstall-item.ts` and/or `src/application/undo-install.ts`.

## Phase 2: Behavior — strict TDD (PR2)

- [x] 2.1 RED: Add `test/fixtures/complexity/**` (JS/TS under + over 10/15) and spawn cases in `test/catalog/scripts/complexity.test.ts` for exit 0/1.
- [x] 2.2 GREEN: Implement D1A self-bootstrap + local eslint in `catalog/scripts/complexity/index.mjs`; ship `catalog/scripts/complexity/package-lock.json`.
- [x] 2.3 RED: Assert D4A JSON shape/sort/cognitive-zero, default JSON, `--format text`, unsupported format → exit 2.
- [x] 2.4 GREEN: Map ESLint JSON → envelope; enforce CLI thresholds/formats in `catalog/scripts/complexity/index.mjs`.
- [x] 2.5 RED: Ignore `.gitignore` + fixed `node_modules`/`.git`; conflicting consumer ESLint config ignored (shipped `-c`).
- [x] 2.6 GREEN: Wire D3A in `catalog/scripts/complexity/eslint.config.mjs` (`includeIgnoreFile` + fixed ignores).
- [x] 2.7 RED (threat): Tool/npm failure → exit 2; consumer `package.json` (read-only) unchanged.
- [x] 2.8 GREEN: Fail-closed `shell:false`; npm cwd = script install root only.
- [x] 2.9 RED: Doctor expects five tools; binless → `script-tool-missing` info (`test/application/doctor.test.ts`).
- [x] 2.10 GREEN: Finalize `catalog/scripts/complexity/script.json` tools: eslint, eslint-plugin-sonarjs, typescript-eslint, typescript, `@eslint/js`.

## Phase 3: Docs / regen (PR3)

- [x] 3.1 Soften empty-scripts / “ships none” prose in `README.md` and `CONTRIBUTING.md` for shipped `complexity`.
- [x] 3.2 Regen README + website catalog tables; verify `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`.
- [x] 3.3 Confirm website catalog surfaces list `complexity`; remove leftover no-scripts copy under `website/`.

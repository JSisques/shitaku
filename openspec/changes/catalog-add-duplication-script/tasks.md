# Tasks: Catalog Duplication Script

## Review Workload Forecast

| Field                   | Value                                                      |
| ----------------------- | ---------------------------------------------------------- |
| Estimated changed lines | 550–750                                                    |
| 400-line budget risk    | High                                                       |
| Chained PRs recommended | Yes                                                        |
| Suggested split         | PR 1 (script+tests+fixtures) → PR 2 (catalog+bundled+docs) |
| Delivery strategy       | auto-chain                                                 |
| Chain strategy          | stacked-to-main                                            |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                       | Likely PR                | Focused test command                                             | Runtime harness                                        | Rollback boundary                                                                                        |
| ---- | ---------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1    | `duplication` adapter + spawn tests + clone/clean fixtures | PR 1 → main              | `pnpm run test -- test/catalog/scripts/duplication.test.ts`      | N/A: mock `.bin/jscpd` spawn; no agent/runtime install | `catalog/scripts/duplication/`, `test/catalog/scripts/duplication.test.ts`, `test/fixtures/duplication/` |
| 2    | Catalog register + bundled-catalog + docs regen            | PR 2 → main (after PR 1) | `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts` | `pnpm run docs:catalog:check` (+ website check)        | `catalog/catalog.json`, bundled-catalog asserts, README/website catalog markers                          |

## Phase 1: RED — fixtures + process-contract + core scenarios (PR 1)

- [x] 1.1 Add `test/fixtures/duplication/clone/` and `test/fixtures/duplication/clean/` (minimal trees; clone has known duplicate files).
- [x] 1.2 RED in `test/catalog/scripts/duplication.test.ts`: reject `--baseline` → exit 2; project files unchanged.
- [x] 1.3 RED: with `--format text|json`, mock jscpd argv MUST NOT include shitaku `--format` (jscpd language flag collision).
- [x] 1.4 RED: after any fixture run, cwd has no leftover `report/` (temp `--output` lifecycle).
- [x] 1.5 RED: unparsable/missing jscpd report or spawn failure → exit 2; no project-file mutation.
- [x] 1.6 RED: clean ≤ threshold → exit 0 + `clones: []`; clone over threshold → exit 1 + clones in output.
- [x] 1.7 RED: default JSON envelope `shitaku.catalog.duplication/v1` (`percentage`, `threshold`, both locations, `lines`, `tokens`); `--format text` human-readable; bad `--format` → exit 2.
- [x] 1.8 Run `pnpm run test -- test/catalog/scripts/duplication.test.ts` — expect RED.

## Phase 2: GREEN — script adapter (PR 1)

- [x] 2.1 Add `catalog/scripts/duplication/script.json` (`tools: ["jscpd"]`, args, exitCodes; no package.json/bootstrap).
- [x] 2.2 Implement `catalog/scripts/duplication/index.mjs`: parseArgs; resolve `.bin` then `npx jscpd`; mkdtemp + `--reporters json --output`; map `jscpd-report.json`; cleanup; print; exit 0/1/2.
- [x] 2.3 Defaults: `--gitignore`; ignore `node_modules`, `dist`/`build`/`coverage`, `test/fixtures`; default `--threshold 0`; reject `--baseline`.
- [x] 2.4 GREEN Phase 1 tests; refactor only within script/tests (mirror dead-code (read-only) patterns).
- [x] 2.5 Optional: local-bin vs fake-npx + ignore-path mock cases in same test file if still under PR 1 budget.

## Phase 3: Catalog registration (PR 2)

- [x] 3.1 RED update `test/adapters/catalog/bundled-catalog.test.ts`: expect `duplication` with complexity/dead-code; no script-root npm bootstrap.
- [x] 3.2 Append `duplication` after `dead-code` in `catalog/catalog.json` `items.scripts`.
- [x] 3.3 GREEN bundled-catalog; assert shipped files `index.mjs` + `script.json` only.

## Phase 4: Docs + verify (PR 2)

- [x] 4.1 Regen docs: `pnpm run docs:catalog` and `pnpm run docs:website-catalog`.
- [x] 4.2 Full gate: `pnpm run test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` (no `src/**` edits).
- [x] 4.3 Defer `openspec/specs/scripts-install/spec.md` (read-only until archive) merge to sdd-archive.

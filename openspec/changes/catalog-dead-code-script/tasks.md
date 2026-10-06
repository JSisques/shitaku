# Tasks: Catalog Dead-Code Script

## Review Workload Forecast

| Field                   | Value                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| Estimated changed lines | 550–850 authored                                                       |
| 400-line budget risk    | High                                                                   |
| Chained PRs recommended | Yes                                                                    |
| Suggested split         | PR1 Registration/guards → PR2 Behavior+fixtures/tests → PR3 Docs/regen |
| Delivery strategy       | auto-chain                                                             |
| Chain strategy          | stacked-to-main                                                        |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                                        | Likely PR              | Focused test command                                                 | Runtime harness                                                        | Rollback boundary                                      |
| ---- | --------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | Register `dead-code` + flip bundled guards; stub exits 2; no script-root nm | PR1 → main             | `pnpm test -- test/adapters/catalog/bundled-catalog.test.ts`         | `node dist/main.js init --scripts dead-code --scope project --dry-run` | Catalog entry/stub only; restore complexity-only guard |
| 2    | CLI/envelope/classify/exit/no-fix + fixtures + spawn (strict TDD)           | PR2 → main (after PR1) | `pnpm test -- test/catalog/scripts/dead-code.test.ts`                | Spawn installed `dead-code` on clean/unused fixtures                   | Script body + fixtures/tests; keep registration        |
| 3    | Docs tables + README/website catalog                                        | PR3 → main (after PR2) | `pnpm run docs:catalog:check && pnpm run docs:website-catalog:check` | N/A — docs check only                                                  | Doc/table regen only                                   |

**Apply order:** registration/guards → behavior (CLI/envelope/classify/exit/no-fix) with fixtures/tests RED-before-GREEN → docs regen.

## Phase 1: Registration / Guards (PR1)

- [x] 1.1 RED: Flip `test/adapters/catalog/bundled-catalog.test.ts` to expect `complexity` **and** `dead-code` registered/loadable.
- [x] 1.2 GREEN: Add `dead-code` to `items.scripts` in `catalog/catalog.json`; stub `catalog/scripts/dead-code/{index.mjs,script.json}` (`tools:["knip"]`; stub exits 2; no `package.json`/lock/nm).
- [x] 1.3 RED: Assert install-root dead-code tree has no script-root npm bootstrap (scenario in spawn/guard test or bundled-catalog).
- [x] 1.4 GREEN: Confirm stub ships only `index.mjs` + `script.json` (no catalog deps).

## Phase 2: Behavior — strict TDD (PR2)

- [x] 2.1 RED: Add `test/fixtures/dead-code/**` (clean; unused export; unused file; unused prod+dev deps) with local knip in fixture `.bin` where needed.
- [x] 2.2 RED: Spawn cases in `test/catalog/scripts/dead-code.test.ts` — clean → exit 0; findings → exit 1.
- [x] 2.3 GREEN: Resolve knip (cwd `.bin` then `npx`); spawn `knip --reporter json` (`shell:false`) in `catalog/scripts/dead-code/index.mjs`.
- [x] 2.4 RED: Assert envelope `shitaku.catalog.dead-code/v1`, six keys always present, sort file/name/line; default JSON; `--format text`; bad `--format` → exit 2.
- [x] 2.5 GREEN: Map knip issues → envelope; text formatter; CLI format validation.
- [x] 2.6 RED: `--include exports` filters output/exit-1 count; unknown include → exit 2; split deps via `package.json` (lodash→`dependencies`, unused-dev→`devDependencies`); `unlisted` unchanged; ambiguous → `dependencies`.
- [x] 2.7 GREEN: Implement include filter + package.json classify (peer/optional → prod) in `catalog/scripts/dead-code/index.mjs`.
- [x] 2.8 RED: Consumer `knip.json` hides ignored export; fixture without config uses knip defaults.
- [x] 2.9 GREEN: Do not ship overriding knip config; rely on consumer/defaults.
- [x] 2.10 RED (threat): `--fix` → exit 2 + fixture tree/`package.json` unchanged; spawn/parse fail → exit 2; never forward `--fix`.
- [x] 2.11 GREEN: Reject `--fix` before spawn; map tool/parse/CLI/IO → exit 2; exit 0/1 by included findings only.

## Phase 3: Docs / Regen (PR3)

- [x] 3.1 Regen README + website catalog tables for `dead-code`; verify `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`.
- [x] 3.2 Soften any complexity-only / single-script prose in `README.md` / `CONTRIBUTING.md` / `website/` if present.

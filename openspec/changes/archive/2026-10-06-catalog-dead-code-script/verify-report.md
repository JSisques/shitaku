```yaml
schema: gentle-ai.verify-result/v1
change: catalog-dead-code-script
evidence_revision: sha256:d65851c79e5650965b6a7e6a8d62143f5b1651792eab7f3ecccd15cf219bbf4b
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 11/11
scenarios: 19/19
tasks: 17/17
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:ed89b30f8e4e8bea1bad319aab1428c27dc94c79cab68fcfd99ab6ba3988ae1e
test_summary: 870 passed (45 files)
build_command: pnpm run build
build_exit_code: 0
build_output_hash: sha256:eaaeb55c46aa2d00fe734d63e6375b4b14e256802e4a7899ec7146e2ccfbd0ac
typecheck_exit_code: 0
lint_exit_code: 0
format_check_exit_code: 0
docs_catalog_check_exit_code: 0
docs_website_catalog_check_exit_code: 0
validator: unavailable (gentle-ai 3.7.0 has no sdd-verify-validate); report persisted per hybrid verify + complexity precedent
remediation:
  - added initMcps bundled dead-code project-install covering Scenario Project install root dead-code
```

# Verify Report: catalog-dead-code-script

**Verdict**: PASS WITH WARNINGS  
**Mode**: Strict TDD  
**Updated**: 2026-10-06  
**Branch tip**: `feat/catalog-dead-code-docs` (stack #184 → #185 → #186)

## Summary

All 17 tasks complete. Spec envelope totals (native heading counts): **11** `### Requirement:` / **19** `#### Scenario:` across `catalog-scripts-dead-code` (9/16) and `scripts-install` delta (2/3). After verify remediation, the previously UNTESTED _Project install root dead-code_ scenario is covered by `test/application/init-mcps.test.ts` (`initMcps (bundled dead-code script)`). Local gates green; focused + full suites pass.

## Completeness

| Metric           | Value |
| ---------------- | ----- |
| Tasks total      | 17    |
| Tasks complete   | 17    |
| Tasks incomplete | 0     |

## Commands

| Command                                                                                                     | Exit | Notes                                                   |
| ----------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `pnpm exec vitest run test/catalog/scripts/dead-code.test.ts test/adapters/catalog/bundled-catalog.test.ts` | 0    | 21 passed / 2 files                                     |
| `pnpm test`                                                                                                 | 0    | 870 passed / 45 files (post-remediation)                |
| `pnpm run typecheck`                                                                                        | 0    |                                                         |
| `pnpm run lint`                                                                                             | 0    |                                                         |
| `pnpm run format:check`                                                                                     | 0    |                                                         |
| `pnpm run build`                                                                                            | 0    | 48 files alias check clean                              |
| `pnpm run docs:catalog:check`                                                                               | 0    |                                                         |
| `pnpm run docs:website-catalog:check`                                                                       | 0    |                                                         |
| Fixture smoke `node catalog/scripts/dead-code/index.mjs` (clean + mock knip)                                | 0    | envelope `shitaku.catalog.dead-code/v1`, empty findings |
| `gentle-ai sdd-verify-validate`                                                                             | n/a  | CLI not present in gentle-ai 3.7.0                      |

**Coverage**: skipped this verify pass (tool available as `pnpm run test:coverage`; threshold 0) — informational only.

## Spec compliance matrix

### catalog-scripts-dead-code (9 requirements / 16 scenarios)

| Requirement               | Scenario                | Test                                                      | Result       |
| ------------------------- | ----------------------- | --------------------------------------------------------- | ------------ |
| Dead-code CLI             | Clean project           | `dead-code.test.ts` > exits 0 for clean                   | ✅ COMPLIANT |
| Dead-code CLI             | Findings present        | `dead-code.test.ts` > unused export/file exit 1           | ✅ COMPLIANT |
| Output formats            | Default JSON            | `dead-code.test.ts` > schema/tool six keys                | ✅ COMPLIANT |
| Output formats            | Text format             | `dead-code.test.ts` > `--format text` + bad format → 2    | ✅ COMPLIANT |
| Include filter            | Include subset          | `dead-code.test.ts` > `--include exports` / unknown → 2   | ✅ COMPLIANT |
| JSON envelope             | Shape and empty keys    | `dead-code.test.ts` > six keys always present             | ✅ COMPLIANT |
| JSON envelope             | Stable sort             | `dead-code.test.ts` > file/name/line order                | ✅ COMPLIANT |
| Exit codes                | Fatal tool error        | `dead-code.test.ts` > parse fail / spawn fail → 2         | ✅ COMPLIANT |
| No fix                    | Fix rejected            | `dead-code.test.ts` > `--fix` → 2, files unchanged        | ✅ COMPLIANT |
| Knip config policy        | Consumer config         | `dead-code.test.ts` > real knip `ignoreIssues`            | ✅ COMPLIANT |
| Knip config policy        | Defaults without config | `dead-code.test.ts` > defaults fixture                    | ✅ COMPLIANT |
| Tool resolution           | Local bin               | `dead-code.test.ts` > cwd `.bin/knip`                     | ✅ COMPLIANT |
| Tool resolution           | Npx fallback            | `dead-code.test.ts` > fake npx on PATH                    | ✅ COMPLIANT |
| Tool resolution           | No catalog bootstrap    | `bundled-catalog.test.ts` + real knip smoke               | ✅ COMPLIANT |
| Dependency classification | Split deps and devDeps  | `dead-code.test.ts` > lodash / unused-dev / peer/optional | ✅ COMPLIANT |
| Dependency classification | Unlisted unchanged      | `dead-code.test.ts` > rimraf under unlisted               | ✅ COMPLIANT |

### scripts-install delta (2 requirement headings / 3 scenarios)

| Requirement                                            | Scenario                        | Test                                                             | Result       |
| ------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------- | ------------ |
| Bundled complexity → Bundled catalog scripts (RENAMED) | (rename/migration)              | `bundled-catalog.test.ts` expects both scripts                   | ✅ COMPLIANT |
| Bundled catalog scripts                                | Registered and loadable         | `bundled-catalog.test.ts` > complexity + dead-code               | ✅ COMPLIANT |
| Bundled catalog scripts                                | Project install root complexity | `init-mcps.test.ts` > bundled complexity                         | ✅ COMPLIANT |
| Bundled catalog scripts                                | Project install root dead-code  | `init-mcps.test.ts` > bundled dead-code (**verify remediation**) | ✅ COMPLIANT |

**Compliance summary**: 19/19 scenarios compliant

## Acceptance / proposal success criteria (#146)

| Criterion                                                   | Evidence                                                       | Status |
| ----------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| Local knip or npx; no catalog npm deps                      | resolution tests + catalog tree only `index.mjs`/`script.json` | ✅     |
| Envelope + text + `--include`; exit 0/1/2; `--fix` rejected | spawn suite                                                    | ✅     |
| Fixtures unused export/file/deps; both scripts registered   | fixtures + bundled-catalog                                     | ✅     |
| Docs regen; strict-TDD green                                | docs checks exit 0; suite green                                | ✅     |

## Correctness (static)

| Requirement area             | Status         | Notes                                    |
| ---------------------------- | -------------- | ---------------------------------------- |
| Catalog script adapter       | ✅ Implemented | `catalog/scripts/dead-code/index.mjs`    |
| Registration                 | ✅ Implemented | `catalog.json` items.scripts             |
| No hexagonal `src/**` change | ✅ Followed    | install PATH reuse only                  |
| Docs dual-script prose       | ✅ Implemented | README / CONTRIBUTING / website overview |

## Coherence (design)

| Decision                                  | Followed? | Notes |
| ----------------------------------------- | --------- | ----- |
| cwd `.bin` then `npx`; no bootstrap       | ✅ Yes    |       |
| Script-local resolve (no `src` edits)     | ✅ Yes    |       |
| Envelope six keys + package.json classify | ✅ Yes    |       |
| `--fix` → exit 2                          | ✅ Yes    |       |
| Consumer knip config / defaults           | ✅ Yes    |       |

## TDD Compliance (Strict)

| Check                         | Result | Details                                                         |
| ----------------------------- | ------ | --------------------------------------------------------------- |
| TDD Evidence reported         | ⚠️     | Cumulative `apply-progress` retains only Phase 3 docs-gate rows |
| All behavior tasks have tests | ✅     | `dead-code.test.ts`, `bundled-catalog.test.ts`, init install    |
| RED confirmed (tests exist)   | ✅     | fixtures + spawn + guards present                               |
| GREEN confirmed (tests pass)  | ✅     | 870/870 on execution                                            |
| Triangulation adequate        | ✅     | multi-fixture / multi-kind cases                                |
| Safety Net for modified files | ⚠️     | Phase 1–2 safety-net rows not retained in final apply-progress  |

**TDD Compliance**: 4/6 checks fully evidenced in artifacts; runtime GREEN confirmed for all covering tests.

### Test Layer Distribution

| Layer                      | Tests   | Files                                          | Tools                        |
| -------------------------- | ------- | ---------------------------------------------- | ---------------------------- |
| Unit / spawn isolation     | ~19     | `test/catalog/scripts/dead-code.test.ts`       | vitest + mock knip           |
| Integration (catalog/init) | ~4      | `bundled-catalog.test.ts`, `init-mcps.test.ts` | vitest + FolderCatalogSource |
| E2E                        | 0       | —                                              | not installed                |
| **Total (change-focused)** | **~23** | **3**                                          |                              |

### Assertion Quality

**Assertion quality**: ✅ All assertions verify real behavior (exits, envelope shape, findings, no mutation)

### Quality Metrics

**Linter**: ✅ No errors  
**Type Checker**: ✅ No errors

## Issues Found

**CRITICAL**: None (after remediation)

**WARNING**:

1. Cumulative `apply-progress.md` TDD Cycle Evidence only lists Phase 3 docs tasks — Phase 1–2 RED/GREEN rows were not retained; confirmed via test files + green suite instead.
2. Package `engines.node` wants `v26.10.0`; verify host ran `v26.7.0` (non-blocking).
3. `gentle-ai sdd-verify-validate` unavailable in 3.7.0 — report admitted by evidence review (same as complexity).
4. Verify remediation test (`initMcps (bundled dead-code script)`) is present in workspace; orchestrator should include it in the tip commit/PR if not already pushed.

**SUGGESTION**:

1. Keep cumulative TDD evidence across apply slices (append rows) so Strict verify does not rely on Engram history.
2. Optional: run `pnpm run test:coverage` filtered to `catalog/scripts/dead-code` before archive if coverage dashboards matter.

## Remediation applied before PASS WITH WARNINGS

1. **CRITICAL (UNTESTED Project install root dead-code)** — added vitest covering real bundled `dead-code` install under `<cwd>/.shitaku/scripts/dead-code/` with only `index.mjs` + `script.json` (no script-root npm bootstrap).

## Stacked PRs

| PR                                                                    | Status                                 |
| --------------------------------------------------------------------- | -------------------------------------- |
| [#184](https://github.com/JSisques/shitaku/pull/184) Foundation (PR1) | OPEN (base main)                       |
| [#185](https://github.com/JSisques/shitaku/pull/185) Behavior (PR2)   | OPEN (base PR1)                        |
| [#186](https://github.com/JSisques/shitaku/pull/186) Docs (PR3)       | OPEN (base PR2); Website build SUCCESS |

## Next

Do **not** archive yet. Commit verify remediation install test if desired; then `sdd-archive` after stacked chain merges to main (or maintainer accepts).

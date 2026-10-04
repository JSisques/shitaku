# Apply Progress: product-website

**Mode**: Strict TDD
**Updated**: 2026-10-04
**Branch**: `feat/product-website`
**Chain strategy**: stacked-to-main (user confirmed)

## Completed Tasks

- [x] 1.1–1.7 Phase 1 scaffold + ignores + website.yml
- [x] 2.1–2.4 Phase 2 EN landing + CLI + security
- [x] 3.1–3.4 Phase 3 ES chrome + prefixed locales
- [x] 4.1–4.6 Phase 4 emitter/check + profiles + docs

**Total**: 21/21 tasks complete

## TDD Cycle Evidence

| Task    | Test File                     | Layer       | Safety Net    | RED                                     | GREEN                                                  | TRIANGULATE                      | REFACTOR               |
| ------- | ----------------------------- | ----------- | ------------- | --------------------------------------- | ------------------------------------------------------ | -------------------------------- | ---------------------- |
| 1.1     | `test/tooling.test.ts`        | Integration | ✅ 612/612    | ✅ Written                              | ✅ Passed                                              | ✅ Prettier + ESLint + gitignore | ✅ Clean               |
| 1.2     | `test/tooling.test.ts`        | Integration | ✅ via 1.1    | ✅ Covered by 1.1                       | ✅ Ignores updated                                     | ➖ Structural                    | ➖ None needed         |
| 1.3     | build smoke                   | Runtime     | N/A (new)     | ✅ Nested package required for build    | ✅ Starlight package created                           | ➖ Structural                    | ➖ None needed         |
| 1.4     | build smoke                   | Runtime     | N/A (new)     | ✅ Prefixed locales required for routes | ✅ `base` + `en`/`es`                                  | ✅ Both locale trees             | ➖ None needed         |
| 1.5     | `test/release-config.test.ts` | Integration | ✅ baseline   | ✅ website.yml missing → fail           | ✅ Workflow created                                    | ✅ Path filters asserted         | ➖ None needed         |
| 1.6     | `test/release-config.test.ts` | Integration | ✅ baseline   | ✅ Isolation contracts written          | ✅ Passed                                              | ✅ ci/cd/files cases             | ➖ None needed         |
| 1.7     | focused tests + build         | Runtime     | ✅            | ✅ Verify gate                          | ✅ 47→53 focused; build OK                             | ➖ Verify                        | ➖ None needed         |
| 2.1–2.4 | build smoke                   | Content     | N/A           | ✅ Spec scenarios as content            | ✅ EN docs + sidebar                                   | ➖ Content per design            | ➖ None needed         |
| 3.1–3.4 | build smoke                   | Content     | N/A           | ✅ Prefixed i18n + ES chrome            | ✅ `/en/`+`/es/`; Buscar/Seleccionar                   | ✅ Both trees                    | ➖ None needed         |
| 4.1     | `test/release-config.test.ts` | Integration | ✅ 47 focused | ✅ Drift/check tests written            | ✅ Passed after emitter                                | ✅ pass + fail drift             | ✅ Prettier in emitter |
| 4.2     | `test/release-config.test.ts` | Integration | ✅            | ✅ Scripts + emitter missing            | ✅ Script + package scripts                            | ✅ `${VAR}` + locales            | ✅ Format via Prettier |
| 4.3     | `test/release-config.test.ts` | Integration | ✅            | ✅ Callout assertion                    | ✅ Profiles caution                                    | ✅ EN=ES body                    | ➖ None needed         |
| 4.4     | `test/release-config.test.ts` | Integration | ✅            | ✅ Emit-before-build order              | ✅ website.yml updated                                 | ✅ Isolation still green         | ➖ None needed         |
| 4.5     | docs inspection               | Docs        | N/A           | ✅ CONTRIBUTING/README contracts        | ✅ Refresh note + site link; no #78 badge; no `src/**` | ➖ Docs                          | ➖ None needed         |
| 4.6     | focused + gates + build       | Runtime     | ✅            | ✅ Verify gate                          | ✅ lint/format/typecheck/check/build green             | ➖ Verify                        | ➖ None needed         |

### Test Summary

- **Total tests written**: 12 new (7 tooling ignore + 5 website isolation/emitter; some via `it.each`)
- **Total tests passing (focused)**: 53
- **Layers used**: Unit (0), Integration (12), E2E (0; website build smoke)
- **Approval tests** (refactoring): None — no refactoring-only tasks
- **Pure functions created**: emitter helpers (`placeholderNames`, `renderMcp`, `renderSkill`, `renderProfile`)

## Work Unit Evidence

| Unit           | Focused test command and result                                                                        | Runtime harness and result                              | Rollback boundary                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1 PR1 scaffold | `pnpm exec vitest run test/tooling.test.ts test/release-config.test.ts` → 53 passed (after full apply) | `cd website && pnpm run build` → 51 pages               | Remove `website/`, `.github/workflows/website.yml`, ignore/eslint edits |
| 2 PR2 EN docs  | N/A (content)                                                                                          | `cd website && pnpm run build` → EN routes under `/en/` | Revert `website/src/content/docs/en/**` hand-written pages              |
| 3 PR3 ES/i18n  | N/A (i18n)                                                                                             | Build emits `/es/`; chrome shows Buscar/Seleccionar     | Revert i18n config + `website/src/content/docs/es/**`                   |
| 4 PR4 emitter  | `pnpm exec vitest run test/release-config.test.ts` → passed                                            | `pnpm run docs:website-catalog:check` → up to date      | Remove emitter, generated catalog MD, doc/script/workflow emit step     |

## Deviations from Design

None — implementation matches design (nested Starlight, base `/shitaku/`, prefixed locales, emitter B, isolated `website.yml`, profiles browse-only, no `src/**`).

## Issues Found

- Root Prettier formats OpenSpec change markdown; formatted those files so `format:check` stays green.
- Starlight hero absolute links do not auto-prefix `base`; used relative `getting-started/` links.

## Remaining Tasks

None.

## Workload / PR Boundary

- Mode: stacked PR slices (`stacked-to-main`)
- All four work units implemented on `feat/product-website` for later split
- PR slice readiness:
  1. **Ready to split**: scaffold + ignores + website.yml
  2. **Ready to split**: EN landing + CLI + security
  3. **Ready to split**: ES chrome + `/en/`+`/es/`
  4. **Ready to split**: emitter/check + profiles + CONTRIBUTING/README
- Estimated review budget impact: High authored line count across all four; keep stacked PRs ≤~400 authored each (generated catalog MD excluded from authored budget)

## Status

21/21 tasks complete. Ready for `sdd-verify`.

# Apply Progress: add-test-writing-skill

Mode: Strict TDD (`pnpm test`). Status: 20/20 tasks complete. Commits: 9459332 `feat(catalog): add test-writing skill`, cf41294 `docs: list test-writing skill in README and website`.

## TDD Cycle Evidence

| Task              | Test File                                       | Layer        | Safety Net             | RED                                                   | GREEN                                            | TRIANGULATE                                                        | REFACTOR             |
| ----------------- | ----------------------------------------------- | ------------ | ---------------------- | ----------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ | -------------------- |
| 1.1-1.6 / 2.1-2.4 | `test/adapters/catalog/bundled-catalog.test.ts` | Unit/adapter | 23/23 existing in file | Written; 2 failed (list mismatch, ENOENT on SKILL.md) | 25/25 in file; 2571 passed full suite after docs | Registration test + contract test (8 required, 3 forbidden tokens) | Prettier format only |

## Work Unit Evidence

| Evidence          | Value                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Focused test      | `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts`: RED 2 failed/23 passed, GREEN all pass                            |
| Runtime harness   | `node dist/main.js init --skills test-writing --scope project --dry-run` -> `test-writing: create`, `dry run: nothing was written` |
| Rollback boundary | Revert commits cf41294 and 9459332                                                                                                 |

## Observations

- After commit 1 alone, `test/release-config.test.ts` (website catalog emitter `--check`) fails until generated docs land in commit 2. Design assumed commit 1 passed; push only after commit 2 (full suite 83/83 passes at HEAD).
- Final: test 2571 passed/1 skipped; typecheck, lint, format:check, docs:catalog:check, docs:website-catalog:check clean; build OK. No `src/` or CHANGELOG changes.

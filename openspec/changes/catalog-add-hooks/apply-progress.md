# Apply Progress: catalog-add-hooks

Mode: Strict TDD. Delivery: auto-chain, stacked-to-main. Store: hybrid.

## PR 1 of 8: Catalog schema, loader, profiles, list (complete)

Commits: `a438407` (hook schema), `746ff3b` (loader, profiles, list, fixtures).

### Completed Tasks

- [x] 1.1 RED: hook schema tests (`test/domain/catalog/hook.test.ts`)
- [x] 1.2 GREEN: `src/domain/catalog/hook.ts`; `schema.ts` (`items.hooks`, `Catalog.hooks`), profile `hooks`, `resolveProfile`/`validateProfiles` hook names
- [x] 1.3 RED/GREEN: folder-source loads `catalog/hooks/*.json`, rejects bad files
- [x] 1.4 RED/GREEN: `src/domain/catalog/listing.ts` hook rows and six-kind filter; `catalog/hooks/.gitkeep`
- [x] 1.5 REFACTOR: `loadCommands` and `loadHooks` share `loadFileItems` in folder-source

### TDD Cycle Evidence

| Task              | Test file                           | RED                                               | GREEN                           | Triangulation                                                                                     | REFACTOR                                                              |
| ----------------- | ----------------------------------- | ------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1.1/1.2 schema    | `test/domain/catalog/hook.test.ts`  | module missing, suite failed to load              | 35 passed                       | required/optional fields, 8 invalid shapes, unknown fields, 5 secret shapes, 4 allowed references | secret message helper simplified, command no longer trimmed           |
| 1.2 index/profile | `schema.test.ts`, `profile.test.ts` | 10 failed                                         | 134 passed (catalog domain dir) | default, listed, invalid name, dedupe, unknown                                                    | none needed                                                           |
| 1.3 loader        | `folder-source.test.ts`             | 9 failed (traversal case passed via index schema) | 52 passed (adapters/catalog)    | valid, 5 invalid kinds, ghost, unlisted, symlink file, symlink dir, size, profile                 | `loadFileItems` shared with commands (all command tests stayed green) |
| 1.4 listing       | `listing.test.ts`                   | 6 failed                                          | 22 passed                       | six kinds, filter, search, empty hooks kind                                                       | none needed                                                           |

Safety net before editing existing files: whole suite green at base (1,057 tests before; 1,092 after).

### Work Unit Evidence

| Evidence          | Value                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test      | `pnpm vitest run test/domain/catalog test/adapters/catalog`: pass; full `pnpm run test`: 53 files, 1092 tests passed                                                                                                                       |
| Runtime harness   | built `node dist/main.js list hooks --source <fixture>` prints `hooks:` / `fmt  Format after edits`, exit 0; `list --json` emits `"kind": "hook"`; `list widgets` rejected with choices `mcps, skills, profiles, scripts, commands, hooks` |
| Rollback boundary | revert `a438407` and `746ff3b`: `src/domain/catalog/{hook,schema,profile,listing}.ts`, `src/adapters/catalog/folder-source.ts`, `catalog/hooks/.gitkeep` and their tests/fixtures                                                          |

### Deviations and Notes

- Task 1.4 names `src/domain/listing.ts`; the real file is `src/domain/catalog/listing.ts`.
- Event is validated as an identifier (`^[A-Za-z][A-Za-z0-9]*$`), not a closed enum, because Claude Code skips unknown events and the list can lag.
- Literal secret detection is heuristic: known token shapes plus `*TOKEN|SECRET|PASSWORD|API_KEY=literal` and `Bearer literal`; `$VAR` and `${VAR}` are allowed.
- `type: "command"` is accepted optionally in a hook file; any other value is rejected.
- `Catalog.hooks` is required, so ~12 test fixtures gained `hooks: []`.
- `tasks.md` has 29 checkboxes (PR 1 has 5); the "38 tasks" figure does not match.
- Review budget: 479 changed lines (443 added, 36 deleted) vs the 400 budget; about 335 are tests and fixtures, 144 production. Recommend `size:exception`.

### PR 1 verify remediation

- WARNING 1 fixed: `hasLiteralSecret` now checks every `SECRET_ASSIGNMENT` and `BEARER` match (`matchAll`), so a literal after a safe reference is rejected. RED: 2 new reject cases failed; GREEN: `hook.test.ts` 39 passed. Triangulated with two multi-reference allowed cases.
- SUGGESTION 1 done: `program.test.ts` covers `list hooks` with no hooks ("no matching items", custom and bundled source) and the widgets assertion now names `hooks` among the choices (both were already satisfied by production code, so added as coverage).
- SUGGESTION 3 done: task 1.4 path corrected in `tasks.md`.

## PR 2 of 8: hook-merge pure module (complete)

Commit: `9ecf681` (`src/domain/hook-merge.ts`, `test/domain/hook-merge.test.ts`). Stacked on PR 1; not pushed.

### Completed Tasks

- [x] 2.1 RED: table tests in `test/domain/hook-merge.test.ts` (30 tests)
- [x] 2.2 GREEN: `addHook` with strict `JSON.parse` and `ConfigError("<file>: <reason>")`
- [x] 2.3 RED/GREEN: `removeHook` (group/event dropped only if created and empty) and `updateHook` (in place)
- [x] 2.4 REFACTOR: shared `locate` helper for remove and update; shared `readHooks`/`readGroups`/`serialize`

### API

`addHook(text|null, file, {event, matcher|null, handler})` returns `{text, action: 'create'|'skip', createdEvent, createdGroup}`. `removeHook(text, file, spec, created)` returns `{text, removed}`. `updateHook(text|null, file, spec(previous handler), next)` returns `{text, updated}`. Handlers are located by `canonicalJson` equality in groups with a strictly equal matcher. A missing `hooks` object counts as a created event; the empty `hooks: {}` left after a remove is intentionally kept (undo restores bytes).

### TDD Cycle Evidence

| Task    | Test file                        | RED                                                                  | GREEN                                                                                                                       | Triangulation                                                                                                                                 | REFACTOR                                                 |
| ------- | -------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 2.1/2.2 | `test/domain/hook-merge.test.ts` | suite failed to load (module missing)                                | add tests 17 passed; 13 failed (remove/update not yet exported, plus an array-matcher message mismatch in the test)         | append, new event, same/other matcher, omitted matcher, skip with key reorder, empty arrays, tab/4-space, trailing newline, 8 malformed cases | n/a                                                      |
| 2.3     | same                             | 12 remove/update tests failed (not exported) before the code existed | 29 passed, 1 failed: `readGroups` returned a copy from `.map`, so removing a created group was lost; fixed to edit in place | created flags, user handler kept, other matcher untouched, absent, indent preserved, in-place update                                          | n/a                                                      |
| 2.4     | same                             | n/a (refactor)                                                       | 30 passed                                                                                                                   | n/a                                                                                                                                           | `locate` shared by remove and update; tests stayed green |

Safety net: whole suite green at base (1,097 tests); 1,127 after.

### Work Unit Evidence

| Evidence          | Value                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Focused test      | `pnpm vitest run test/domain/hook-merge.test.ts`: 30 passed; full `pnpm run test`: 54 files, 1127 tests passed           |
| Runtime harness   | N/A: pure module, not reachable from any entry point until PR 4. `test/architecture.test.ts` (domain purity) stays green |
| Rollback boundary | revert `9ecf681`: `src/domain/hook-merge.ts` and `test/domain/hook-merge.test.ts`                                        |

### Validation

`pnpm run typecheck`, `lint`, `format:check`, `test`, `build` all exit 0. Review budget: 371 added lines (0 deleted) against base `5035cc9`, within the 400 budget; no `size:exception`.

### Deviations and Notes

- Update signature is `updateHook(text, file, spec, next)` where `spec.handler` is the previous handler.
- Matcher present but not a string, groups without a `hooks` array, and non-object groups raise a `ConfigError` naming the file and path.
- `ConfigError` is reused from `json-merge.ts` rather than redefined.

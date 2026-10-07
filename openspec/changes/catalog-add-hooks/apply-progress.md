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

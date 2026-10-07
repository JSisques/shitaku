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

## PR 3 of 8: Manifest and hook-plan (tasks 3.1-3.4, complete)

Branch `feat/hooks-3-manifest-plan`, stacked on `feat/hooks-2-hook-merge`. Strict TDD. Commits `d214268` feat(domain) manifest hook item and `bb591aa` feat(plan) hook-plan, plus a docs(openspec) commit; not pushed.

API: manifest `hook` item `{name, action, entryHash, event, matcher|null, handler, previous?, createdEvent, createdGroup}` (no `root`; the owning file path is the settings file). `deriveHookOwnership(manifest)` returns settings path -> hook name -> `OwnedHook`. `OwnedItem.kind` gains `hook` (path = settings file). `buildHookPlan({path, scope, existing, hooks, owned})` returns `HookFileChange {path, scope, beforeHash, before, after, items: PlannedHook[]}`; actions are `create | update | skip` (type `HookAction` excludes `conflict`). `hookEntryHash`, `writesHookFile` exported. `ChangePlan.hooks: HookFileChange[]` (empty from `buildPlan`).

Planning rules: `addHook` first (deep-equal present -> skip); else if the owned handler sits at the same event and matcher and `updateHook` finds it -> in-place update, `previous` = owned handler, created flags carried from the owned entry; else create (appended). An owned hook that was edited or removed therefore creates again and never conflicts.

### TDD Cycle Evidence

| Task    | Test file                              | RED                                                                                  | GREEN     | Triangulation                                                                                                                      | REFACTOR               |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 3.1/3.2 | `test/domain/manifest.test.ts`         | 9 failed, 46 passed (hook item rejected by the union, `deriveHookOwnership` missing) | 55 passed | round-trip, null matcher, `previous`, missing event, null afterHash rejected, update/undone/remove replay, ownership maps isolated | n/a                    |
| 3.3/3.4 | `test/domain/plan/hook-plan.test.ts`   | suite failed to load (module missing)                                                | 14 passed | create (absent/existing group/new group), multi-hook, skip x2, update x2, never-conflict x4, malformed                             | lint-only typed helper |
| 3.4     | `test/domain/plan/change-plan.test.ts` | added after the code (typecheck, not a failing test, flagged `hooks` missing)        | passed    | single assertion                                                                                                                   | n/a                    |

Note: the old-manifest parse test passes without production changes once `deriveHookOwnership` exists; it is a regression guard, not a RED. The `change-plan.test.ts` assertion is coverage added after GREEN.

### Work Unit Evidence (PR 3)

| Evidence          | Value                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Focused test      | `pnpm vitest run test/domain`: all passed; full `pnpm run test`: 55 files, 1154 tests passed |
| Runtime harness   | N/A: not wired; nothing calls `buildHookPlan` or writes hook items until PR 4                |
| Rollback boundary | revert `bb591aa` and `d214268`: manifest, plan files, and the three one-line compile guards  |

### Validation

`pnpm run typecheck`, `lint`, `format:check`, `test`, `build` all exit 0. Review budget: 461 added / 5 deleted lines vs `0320079` (code 164, tests 296), over the 400 budget. No `size:exception` was approved for this PR; reported honestly, not compressed.

### Branch audit (design decision h) and temporary measures

- `manifest.ts`: `deriveOwnership` (`!== 'mcp'` skip) and the `afterHash` refine already exclude hooks correctly; `deriveOwnedItems` path now uses `file.path` for `mcp` and `hook`.
- `undo-install.ts` `itemRoots`: hooks have no root, so they are excluded (permanent and correct). `isByteFile` still treats a hook file as bytes (`kind !== 'mcp'`): left for PR 5.
- `uninstall-item.ts`: temporary guard in `applyUninstall` throws for a hook so the root-bearing tree branch compiles; PR 6 replaces it. `expectedPath`, `installed-state.ts` observation and `desiredFor`, and `doctor-plan.ts` branches fall through to tree behavior for `hook`; unreachable until PR 4 writes hook items, handled in PRs 5 and 6.
- `init-mcps.ts`: only the empty-plan literal gained `hooks: []`.

### Deviations and Notes

- Added `deriveHookOwnership` and `OwnedHook`, not named in the task list, because `buildHookPlan` needs the owned event, matcher, handler and created flags.
- An owned hook whose event or matcher changed in the catalog is appended as a new create; the old handler is left in place (no move). Open edge case for a later PR.

## PR 4: Port, target, init/apply (tasks 4.1-4.4)

Branch `feat/hooks-4-init-apply` (stacked on #217, not pushed). Commits: `feat(claude-code)` settingsPath and toHookHandler, `feat(init)` install catalog hooks into the settings file, plus this `docs(openspec)` commit. Strict TDD.

### TDD Cycle Evidence (PR 4)

| Task    | Test file                                  | RED                                                                                                      | GREEN                 | Triangulate                                                                                                                                                                                                                | Refactor |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 4.1/4.2 | `test/adapters/claude-code/target.test.ts` | 4 failed (`settingsPath` / `toHookHandler` is not a function), safety net 80/80 over target + init tests | 12 passed             | user and project scope; handler with and without timeout (key absent)                                                                                                                                                      | n/a      |
| 4.3/4.4 | `test/application/init-mcps.test.ts`       | 13 failed of 85 (hooks not planned or applied, `UnknownHookError` missing)                               | 85 passed (full 1171) | user/project write, manifest item and createdDirs, other keys kept plus byte-identical backup, idempotent skip, update in place, malformed fails closed, dry run, unknown hook, stale abort, replan-and-write, rollback x2 | n/a      |

### Work Unit Evidence (PR 4)

| Evidence          | Value                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Focused test      | `pnpm vitest run test/application/init-mcps.test.ts test/adapters/claude-code/target.test.ts`: 97 passed; full suite 1171 passed |
| Runtime harness   | Application tests against the real `NodeFileSystem` in a temp HOME/cwd, plus a fault-injecting fs for rollback                   |
| Rollback boundary | revert the two code commits: `agent-target.ts`, `claude-code/target.ts`, `init-mcps.ts`, their tests and `test/helpers/hooks.ts` |

### Validation

`pnpm run typecheck`, `lint`, `format:check`, `test`, `build` all exit 0. Budget: 312 added / 9 deleted lines vs `d04cdce` (code 107, tests 205), under 400.

### Notes

- API: `InitRequest.hooks?: string[]`, `UnknownHookError`; `planInit` yields one `HookFileChange` per scope settings file; `applyPlan` refreshes (re-read, replan, `StaleFileError` when actions differ), backs up with the MCP backup counter, writes with `writeAtomic`, journals `hook` items (skips excluded, `previous` only on update) and records the created `.claude/` through `missingDirs`.
- No CLI flag or prompter selects hooks (PR 7). Until PR 5/6, undo, uninstall, status and doctor still fall through for hook items; reachable only via the use case API.
- Deviation: none from design.

## PR 5: Undo (tasks 5.1-5.2)

Branch `feat/hooks-5-undo` (stacked on #218, not pushed). Commits: `feat(undo)` undo installed hooks with a targeted reverse, plus this `docs(openspec)` commit. Strict TDD.

### TDD Cycle Evidence (PR 5)

| Task    | Test file                               | RED                                                                                                                                  | GREEN                              | Triangulate                                                                                                                                                                                                                                                                                                                                   | Refactor |
| ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 5.1/5.2 | `test/application/undo-install.test.ts` | 7 failed of 45 (safety net 33 passed before the new block): `.claude/` not pruned, symlink drift, no targeted reverse, no precompute | 45 passed (full suite 1183 passed) | byte restore, created file + `.claude/` deleted, pre-existing `.claude/` kept, user file keeps `.claude/`, symlink to identical content is not drift, refused exit 3, `--force` keeps user hooks, shared group kept in order, update puts `previous` back, removal re-added, deleted file left alone, corrupt settings fails before any write | n/a      |

### Work Unit Evidence (PR 5)

| Evidence          | Value                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Focused test      | `pnpm vitest run test/application/undo-install.test.ts`: 45 passed; full suite 1183 passed                    |
| Runtime harness   | Real `NodeFileSystem` in a temp HOME/cwd: `initMcps` installs hooks, `undoInstall` reverses them              |
| Rollback boundary | revert the `feat(undo)` commit: `src/application/undo-install.ts` and `test/application/undo-install.test.ts` |

### Validation

`pnpm run typecheck`, `lint`, `format:check`, `test`, `build` all exit 0. Budget: 224 added / 10 deleted lines vs `2fc72a0` (src + test), under 400.

### Notes

- `isByteFile` is false for `hook` and `mcp` files, so a symlinked settings.json is read as text and not reported as drift.
- A drifted hook-only file is reversed by `reverseHooks` (newest item first: create -> `removeHook` with the created flags, update -> `updateHook` back to `previous`, remove -> `addHook`), computed for all files before the first write; a missing settings file is left untouched. Backups are only required for files that are restored whole.
- `prunableDirs` anchors on settings file paths as well as item roots, so the `.claude/` the install created is pruned when empty.
- The `itemRoots` hook exclusion from PR 3 is NOT removed: it is a type-level necessity (hook items have no `root`), not a temporary measure. LIFO per file path already covers hooks.
- Uninstall, status and doctor are untouched (PR 6).
- Deviation: none from design.

## PR 6: Uninstall, status, doctor (tasks 6.1-6.4)

Branch `feat/hooks-6-uninstall-status` (stacked on #219, not pushed). Commits: `feat(uninstall)` (6.1/6.2, `7f35ab9`), `feat(status)` (6.3/6.4, `a428586`), plus this `docs(openspec)` commit. Strict TDD.

### TDD Cycle Evidence (PR 6)

| Task    | Test file                                                                                | RED                                                                                                      | GREEN                                            | Triangulate                                                                                                                                                                                                                                                                  | Refactor                                                                        |
| ------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 6.1/6.2 | `test/application/uninstall-item.test.ts`                                                | 12 failed of 55 (safety net 43 passed): hook not resolved ("was not installed by shitaku")               | 55 passed                                        | shared group kept, created group/event dropped, no `--force` needed, dry run, deleted, edited, file gone, malformed, kind collision, stale, journal rollback, undo restores bytes                                                                                            | n/a                                                                             |
| 6.1/6.2 | `test/domain/manifest.test.ts`                                                           | 1 failed: owned item lacked the `hook` detail                                                            | 55 passed                                        | exact detail incl. created flags                                                                                                                                                                                                                                             | `ownedHook` shared with `deriveHookOwnership`                                   |
| 6.3/6.4 | `installed-state.test.ts`, `doctor.test.ts`, `doctor-plan.test.ts`, `hook-merge.test.ts` | 19 failed of 107 (88 passed): `hasHook` missing, hook fell through to the tree branch, no `hook-missing` | 743 passed in `test/application` + `test/domain` | intact, edited, deleted, file missing, malformed JSON and wrong shape, read once per file, catalog hash (event/matcher change), out-of-date, missing-from-catalog, other scope still classified, unrelated keys and user hooks ignored, `${CLAUDE_PROJECT_DIR}` no env-unset | `SettingsText` named type after a lint error (`no-redundant-type-constituents`) |

### Work Unit Evidence (PR 6)

| Evidence          | Value                                                                                                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test      | `pnpm vitest run test/application test/domain`: 36 files, 743 passed; full `pnpm run test`: 55 files, 1218 passed                                                                                                                                                      |
| Runtime harness   | Built CLI in a temp HOME/cwd after installing a hook through `initMcps`: `status` lists `hooks:` / `fmt` with the settings path; `status --json` has `"kind": "hook"`; after editing the command, `status` says `missing` and `doctor` reports `hook-missing` (exit 4) |
| Rollback boundary | Part A: revert `7f35ab9` (`uninstall-item.ts`, `manifest.ts` hook detail and their tests). Part B: revert `a428586` (`installed-state.ts`, `hook-merge.ts` `hasHook`, `doctor-plan.ts` and their tests)                                                                |

### Validation

`pnpm run typecheck`, `lint`, `format:check`, `test`, `build` all exit 0. Budget (src + test, `bd58d2e...HEAD`): 647 added / 20 deleted = 667. Part A (`7f35ab9`): 221 + 15 = 236. Part B (`a428586`): 426 + 5 = 431 (about 91 production, the rest tests). The two parts are separable commits on this branch; the orchestrator decides the PR cut.

### Notes and Deviations

- Design decision c makes "edited" indistinguishable from "removed", so the spec scenario "Edited hook refused (exit 3)" cannot be produced: an edited handler is `already-absent` (exit 0, nothing written, `modified: false`). A hook is therefore never refused and never needs `--force`; `refused`/exit 3 remain for the other kinds. A malformed settings file still fails closed (ConfigError, exit 1) before any write. This resolves the spec's open `--force` question; flagged for verify.
- `OwnedItem` gained an optional `hook` detail (design table h, "optional `hook` detail"); `deriveHookOwnership` shares `ownedHook`.
- Uninstall journals a hook `remove` item carrying event, matcher, handler and created flags, so `undo` re-adds or byte-restores it.
- `desiredFor` now handles hooks (not named in tasks): without it an installed hook would read `missing-from-catalog`.
- Doctor with a deleted settings file reports `config-missing` for the file (like MCP), not `hook-missing` per hook.
- `--kind hook` on the CLI (`uninstall` choices, `UninstallOptions.kind`) is deliberately left to PR 7 (task 7.2); the use case already accepts it. Status/doctor text and JSON need no CLI change.
- Task paths: `doctor-plan.ts` lives in `src/domain/plan/`.

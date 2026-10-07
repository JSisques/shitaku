# Apply Progress: catalog-add-commands

## Batch 1: PR 1 (catalog) — tasks 1.1-1.9 complete

Mode: Strict TDD. Chain: stacked-to-main. Remaining: 2a._, 2b._, 2c._, 3a._, 3b.* (not started).

### TDD Cycle Evidence

| Task    | Test File                                                  | Layer       | Safety Net             | RED                    | GREEN        | Triangulate                       | Refactor                                         |
| ------- | ---------------------------------------------------------- | ----------- | ---------------------- | ---------------------- | ------------ | --------------------------------- | ------------------------------------------------ |
| 1.1/1.2 | `test/domain/catalog/frontmatter.test.ts`, `skill.test.ts` | Unit        | 85/85 (domain/catalog) | Written, import failed | 85/85 pass   | 6 cases + skill unchanged         | Skill reader moved to `frontmatter.ts`           |
| 1.3/1.4 | `test/domain/catalog/command.test.ts`                      | Unit        | N/A (new)              | Written, import failed | Pass         | names x2, description x3, body x2 | None needed                                      |
| 1.5/1.6 | `schema.test.ts`, `profile.test.ts`, `listing.test.ts`     | Unit        | 93/93                  | 15 failing before code | 93/93 pass   | extends dedupe, unknown, empty    | None needed                                      |
| 1.7/1.8 | `folder-source.test.ts`, `bundled-catalog.test.ts`         | Integration | 42/42                  | 10 failing before code | Pass         | 10 loader cases                   | `flagUnlisted` shared by skills/scripts/commands |
| 1.9     | whole suite                                                | Gate        | N/A                    | N/A                    | 944/944 pass | N/A                               | typecheck, lint, format:check, build clean       |

### Work Unit Evidence

| Evidence             | Value                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm vitest run test/domain/catalog test/adapters/catalog`: 9 files, 135 tests passed                                                                    |
| Runtime harness      | Real `FolderCatalogSource` against tmp folders and the bundled `catalog/`; `list --json` CLI path unchanged (kind wiring lands in 3a)                     |
| Rollback boundary    | `src/domain/catalog/{frontmatter,command}.ts`, catalog schema/profile/listing, folder-source `loadCommands`, `catalog.json` `commands: []`, test literals |

### Deviations from design

- Loader tests build command fixtures in tmp dirs (existing `folder-source.test.ts` style, and symlinks cannot be committed reliably) instead of `test/fixtures/**/commands/`.
- `readFrontmatter` also returns `body` (needed for the empty-body rule).
- Task 1.9 dedupe was done by manual search (`FRONTMATTER` and `unquote` live only in `frontmatter.ts`); jscpd is not installed locally, so no jscpd run backs it.
- Size: about 560 changed lines (482 added, 78 removed), above the 400 budget. Contingency split 1a/1b from tasks.md applies (about 190 / 370).

## Batch 2: PR 2a (domain install model) — tasks 2a.1-2a.9 complete

Mode: Strict TDD. Chain: stacked-to-main (on `feat/commands-1b-catalog-schema`). Remaining: 2b.\*, 2c.\*, 3a.\*, 3b.\* (not started).

### TDD Cycle Evidence

| Task      | Test File                                                        | Layer | Safety Net                    | RED                    | GREEN        | Triangulate                                   | Refactor                                                  |
| --------- | ---------------------------------------------------------------- | ----- | ----------------------------- | ---------------------- | ------------ | --------------------------------------------- | --------------------------------------------------------- |
| 2a.1/2a.2 | `test/domain/plan/classify.test.ts`, `skill-plan`, `script-plan` | Unit  | 29/29 (existing plan tests)   | Written, import failed | Pass         | 6 cases: create/skip/update/force/conflict x2 | `classifySkill`/`classifyScript` delegate; one classifier |
| 2a.3/2a.4 | `test/domain/plan/flat-file-plan.test.ts`                        | Unit  | N/A (new)                     | Written, import failed | Pass         | 7 cases incl. multi-entry order and scopes    | None needed                                               |
| 2a.5/2a.6 | `test/domain/manifest.test.ts`                                   | Unit  | existing manifest tests green | 5 failing before code  | Pass         | ownership, remove, reinstall, undone, null    | `deriveTreeOwnership` reused for commands                 |
| 2a.7/2a.8 | `test/adapters/claude-code/target.test.ts`                       | Unit  | existing target tests green   | 2 failing before code  | Pass         | user and project scope                        | None needed                                               |
| 2a.9      | whole suite                                                      | Gate  | N/A                           | N/A                    | 966/966 pass | N/A                                           | typecheck, lint, format:check, build clean                |

### Work Unit Evidence

| Evidence             | Value                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm vitest run test/domain/plan test/domain/manifest.test.ts test/adapters/claude-code`: 9 files, 132 tests passed                                     |
| Runtime harness      | N/A: pure domain, unreachable from the CLI                                                                                                               |
| Rollback boundary    | `src/domain/plan/{classify,flat-file-plan}.ts`, classifier delegation in skill/script plans, `ChangePlan.commands`, manifest command kind, `commandsDir` |

### Deviations from design

- Two application-layer touches were needed to keep typecheck green: `init-mcps.ts` empty plan literal gets `commands: []`, and `uninstall-item.ts` widens `UninstallResult.item.kind` to `OwnedItem['kind']` and maps the command path in `expectedPath`. Full command uninstall stays in 2c.
- `classifySkill`/`classifyScript` are now arrow-function consts (exports and signatures unchanged).
- The `afterHash: null` refine is written as "no `mcp` item" instead of listing skill|script|command; equivalent for the current kinds.

## Batch 3: PR 2b (`init` apply + undo) — tasks 2b.1-2b.6 complete

Mode: Strict TDD. Chain: stacked-to-main (on `feat/commands-2b-init-undo`, stacked on `feat/commands-2a-install-model`). Remaining: 2c.\*, 3a.\*, 3b.\* (not started).

### TDD Cycle Evidence

| Task      | Test File                                                          | Layer       | Safety Net            | RED                              | GREEN        | Triangulate                                                                            | Refactor                                                              |
| --------- | ------------------------------------------------------------------ | ----------- | --------------------- | -------------------------------- | ------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 2b.1/2b.3 | `test/application/init-mcps.test.ts` (`initMcps (commands)`)       | Integration | 58/58 (existing init) | 13 failing before code           | 71/71 pass   | user+project roots, neighbor, skip, conflict, force, update, dry-run, unknown          | `TreeStep` generalized to `ByteStep` (item carried on the step)       |
| 2b.2/2b.3 | same file (write failure, forced-replace failure, stale)           | Integration | same                  | failing before code (same batch) | pass         | create failure, manifest failure with created dirs, forced replace restore, stale      | `writesFlatFile` mirrors `writesSkill`; `refreshFlatFile`             |
| 2b.4/2b.5 | `test/application/undo-install.test.ts` (`undoInstall (commands)`) | Integration | 27/27 (existing undo) | 2 failing (prune), 1 (non-UTF-8) | 33/33 pass   | prune created, keep pre-existing, keep neighbor, drift, forced restore, missing backup | `itemRoots` (LIFO + prune) split from `treeRoots` (`unrecordedFiles`) |
| 2b.6      | whole suite                                                        | Gate        | N/A                   | N/A                              | 986/986 pass | N/A                                                                                    | typecheck, lint, format:check, build clean                            |

### Work Unit Evidence

| Evidence             | Value                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm vitest run test/application`: 12 files, 245 tests passed                                                                         |
| Runtime harness      | N/A: no CLI flag until 3a; tests run `initMcps`/`undoInstall` against the real `NodeFileSystem` in tmp dirs (and `faultyFs`)           |
| Rollback boundary    | `src/application/init-mcps.ts`, `src/application/undo-install.ts`, `writesFlatFile` in `flat-file-plan.ts`, `test/helpers/commands.ts` |

### Deviations from design

- Command files go through `writeBytes` (already temp-then-rename in `NodeFileSystem`), so no new write primitive was added.
- Undo hashes and restores command files as bytes (`isByteFile` = any non-mcp item), so non-UTF-8 originals round-trip.
- `refreshFlatFile` fixes the noun to `'command'`; generalize it when #42 agents reuse the module.
- Size: about 391 code+test lines (357 added, 34 removed), within the 400 budget.

## Batch 4: PR 2c (uninstall, status, doctor) — tasks 2c.1-2c.7 complete

Mode: Strict TDD. Chain: stacked-to-main (on `feat/commands-2c-uninstall-status`, stacked on `feat/commands-2b-init-undo`). Remaining: 3a.\*, 3b.\* (not started).

### TDD Cycle Evidence

| Task      | Test File                                                                                           | Layer       | Safety Net                 | RED                                                                                                              | GREEN        | Triangulate                                                                                                                  | Refactor                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------- | ----------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 2c.1/2c.2 | `test/application/uninstall-item.test.ts` (`uninstallItem (commands)`)                              | Integration | 34/34 (existing uninstall) | 8 failing before code (`UnsafeTreeError` on file)                                                                | 41/42 pass   | removed, refused, force+neighbor, absent, dry-run, symlink, stale, undo, skill+command and mcp+command collisions            | `doomed` carries absolute paths (`expectedPath` command branch now exercised by every test) |
| 2c.3/2c.4 | `test/application/installed-state.test.ts` (`observeInstalled`, `getStatus`, `desiredFor` commands) | Integration | 9/9 (existing)             | 6 failing before code                                                                                            | 57/57 pass   | hash, absent, directory, symlink, no `listFiles`, 5 states, other items classified, `mine.md` ignored, two scopes, no writes | `observeFile` beside `observeMcp`/`observeTree`                                             |
| 2c.5/2c.6 | `test/domain/plan/doctor-plan.test.ts`, `test/application/doctor.test.ts`                           | Unit + Int. | 20/20 (existing)           | 1 failing before code                                                                                            | 21/21 pass   | missing, healthy, modified (info); end-to-end deleted, healthy, directory-replaced                                           | None needed                                                                                 |
| extra     | `test/adapters/fs/node-fs.test.ts` (named pipe), `init-mcps.test.ts` (`commands: []`)               | Integration | 15/15, 71/71               | pipe test blocked (1s race timeout); `commands` plan assertions passed at once (leftover coverage, code from 2b) | 40/40, 72/72 | pipe + regular file; absent vs requested commands                                                                            | None needed                                                                                 |
| 2c.7      | whole suite                                                                                         | Gate        | N/A                        | N/A                                                                                                              | 1008/1008    | N/A                                                                                                                          | typecheck, lint, format:check, build clean                                                  |

### Work Unit Evidence

| Evidence             | Value                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm vitest run test/application/uninstall-item.test.ts test/application/installed-state.test.ts test/domain/plan/doctor-plan.test.ts test/application/doctor.test.ts`: all pass |
| Runtime harness      | N/A: no CLI flag until 3a; tests run `uninstallItem`/`getStatus`/`getDiagnosis` against the real `NodeFileSystem` in tmp dirs                                                     |
| Rollback boundary    | `uninstall-item.ts`, `installed-state.ts`, `doctor-plan.ts`, the `O_NONBLOCK` flag in `walk.ts`, and their tests                                                                  |

### Deviations from design

- Fixed a hang found while testing special files: `readFileNoFollow` opened a named pipe with a blocking `O_RDONLY`, so `status`/`uninstall` would wait forever on a FIFO at a command path. Added `O_NONBLOCK` (tree walkers were never affected, they `lstat` first).
- `UninstallRequest.kind` now reuses `OwnedItem['kind']`; `Plan.doomed` holds absolute paths for all kinds so a command is a one-entry list (no tree helper involved).
- A symlink or directory at a command path makes `uninstall` throw `UnsafeTreeError` even with `--force` (same as skills); `status`/`doctor` report it `modified`.
- Size: about 436 code+test lines (412 added, 24 removed), above the 400 budget (130 code, 306 tests). Contingency: split uninstall (2c.1-2c.2 + FIFO fix, ~250) from status/doctor (2c.3-2c.6, ~190).

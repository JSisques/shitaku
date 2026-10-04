# Tasks: Uninstall Command

## Review Workload Forecast

| Field                   | Value                                                     |
| ----------------------- | --------------------------------------------------------- |
| Estimated changed lines | PR 1 ~280-340; PR 2 ~420-520 (incl. tests, README)        |
| 400-line budget risk    | High                                                      |
| Chained PRs recommended | Yes                                                       |
| Suggested split         | PR 1 (domain, extraction) -> PR 2 (use case, CLI, README) |
| Delivery strategy       | ask-on-risk                                               |
| Chain strategy          | pending                                                   |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

PR 2 may exceed 400 lines; if so, split 2.x use case from 3.x CLI/README (PR 2a/2b) or accept size:exception.

### Suggested Work Units

| Unit | Goal                                                       | Likely PR | Focused test command                                                                        | Runtime harness                                     | Rollback boundary             |
| ---- | ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------- |
| 1    | `remove` action, replay, `removeAtPath`, helper extraction | PR 1      | `pnpm vitest run test/domain test/application/init-mcps.test.ts`                            | N/A: no user-visible change                         | Revert PR 1 (unused by CLI)   |
| 2    | `uninstallItem`, CLI command, README                       | PR 2      | `pnpm vitest run test/application/uninstall-item.test.ts test/adapters/cli/program.test.ts` | `shitaku uninstall <name> --dry-run` on a temp HOME | Revert PR 2; PR 1 stays inert |

## Phase 1: Domain (PR 1)

- [x] 1.1 RED: `test/domain/json-merge.test.ts` for `removeAtPath` (siblings/order/indent/newline kept, missing path ignored, non-object -> `ConfigError`)
- [x] 1.2 GREEN: add `removeAtPath` in `src/domain/json-merge.ts`
- [x] 1.3 RED: `test/domain/manifest.test.ts` replay of `remove` in `deriveOwnership`, `deriveSkillOwnership`, `deriveOwnedItems` (remove-then-reinstall, undone uninstall, schema accepts `remove`, version stays 1)
- [x] 1.4 GREEN: add `remove` to item `action` enum and delete ownership on it in `src/domain/manifest.ts`

## Phase 2: Helper extraction (PR 1)

- [x] 2.1 Create `src/application/install-transaction.ts` (`newInstallId`, `backupPath`, `restoreText`, `restoreBytes`, `rollback`, `StaleFileError`) moved from `src/application/init-mcps.ts`; add small unit test `test/application/install-transaction.test.ts` (`backupPath` format `backups/{id}/{n}-{basename}`)
- [x] 2.2 Refactor `src/application/init-mcps.ts` to use them and re-export `StaleFileError`; `test/application/init-mcps.test.ts` and `undo-install` tests stay green unchanged

## Phase 3: Use case (PR 2)

- [x] 3.1 RED: `test/application/uninstall-item.test.ts` resolution: not owned (even with `--force`) -> `UninstallSelectionError`; scope inferred; `--scope` narrows; ambiguity lists candidates; `--kind` resolves; project entry from other cwd never matches
- [x] 3.2 RED: same file, MCP+skill outcomes: unmodified removed with backup; absent -> `already-absent` no write; modified -> `refused` exit 3 no write; `--force` removes; `--dry-run` writes nothing; `--dry-run` on modified without `--force` -> `refused` exit 3 no write
- [x] 3.3 RED: skill specifics: `SKILL.md` deleted first; forced keeps user file and directory; stale file/tree hash -> `StaleFileError`, nothing changed; injected failure -> rollback
- [x] 3.4 RED: `undoInstall` after uninstall restores bytes and ownership; edited config after MCP uninstall -> undo refuses; LIFO blocks undo of original install; `status` hides then re-lists after undo
- [x] 3.5 GREEN: create `src/application/uninstall-item.ts` (`planUninstall`: refusal check before dry-run check; `applyUninstall`; `uninstallItem`; `UninstallSelectionError`) until 3.1-3.4 pass

## Phase 4: CLI and docs (PR 2)

- [x] 4.1 RED: `test/adapters/cli/program.test.ts` flags `--scope --kind --dry-run --force`, messages, exit 0/1/3, `changed since install: <path>` + `--force` hint on stderr, user-scope MCP close-Claude-Code note
- [x] 4.2 GREEN: register `uninstall <name>` in `src/adapters/cli/program.ts` (`guarded` entry, exit-code comment)
- [x] 4.3 Update `README.md`: command docs, downgrade note (older binaries reject `remove`), MCP-undo whole-file refusal
- [x] 4.4 Run `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test && pnpm run build`

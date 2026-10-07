# Tasks: Claude Code hooks in the catalog (#211)

## Review Workload Forecast

| Field                   | Value                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Estimated changed lines | ~2,700 total (PR1 300, PR2 380, PR3 350, PR4 380, PR5 340, PR6 400, PR7 340, PR8 300) |
| 400-line budget risk    | High (total); Medium for PR2, PR4, PR6                                                |
| Chained PRs recommended | Yes                                                                                   |
| Suggested split         | PR 1 → PR 2 → ... → PR 8                                                              |
| Delivery strategy       | auto-chain                                                                            |
| Chain strategy          | stacked-to-main                                                                       |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                       | PR  | Focused test                                                | Runtime harness                               | Rollback                     |
| ---- | ------------------------------------------ | --- | ----------------------------------------------------------- | --------------------------------------------- | ---------------------------- |
| 1    | Catalog schema, loader, profiles, list     | 1   | `pnpm vitest run test/domain/catalog test/adapters/catalog` | `shitaku list --kind hook` on fixture catalog | catalog/schema/listing files |
| 2    | `hook-merge` pure module                   | 2   | `pnpm vitest run test/domain/hook-merge.test.ts`            | N/A: pure, unreachable                        | `hook-merge.ts` + test       |
| 3    | Manifest `hook` item, `hook-plan`          | 3   | `pnpm vitest run test/domain`                               | N/A: not wired                                | manifest, plan files         |
| 4    | Port, target, init/apply                   | 4   | `pnpm vitest run test/application/init-mcps.test.ts`        | application test on in-memory fs              | init-mcps, target, port      |
| 5    | Undo                                       | 5   | `pnpm vitest run test/application/undo-install.test.ts`     | in-memory install then undo                   | undo-install.ts              |
| 6    | Uninstall, status, doctor                  | 6   | `pnpm vitest run test/application`                          | in-memory status/doctor                       | those use cases              |
| 7    | CLI `--hooks` + `--allow-hooks` + prompter | 7   | `pnpm vitest run test/adapters/cli`                         | CLI harness: `init --hooks x --yes`           | cli/prompter files           |
| 8    | Docs and generators                        | 8   | `pnpm vitest run test/tooling.test.ts`                      | generator scripts, drift check                | docs/scripts                 |

Every PR: RED test first, then GREEN, then REFACTOR; tests and docs stay with code. Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before each PR.

## PR 1: Catalog

- [x] 1.1 RED: tests for hook schema (required/optional fields, unknown field and literal secret rejected) in `test/domain/catalog/hook.test.ts`
- [x] 1.2 GREEN: `src/domain/catalog/hook.ts`; extend `schema.ts` (`items.hooks` optional) and `profile.ts` (`hooks`)
- [x] 1.3 RED/GREEN: folder-source loads `catalog/hooks/*.json`, rejects bad files (`test/adapters/catalog/folder-source.test.ts`, `src/adapters/catalog/folder-source.ts`)
- [x] 1.4 RED/GREEN: `src/domain/catalog/listing.ts` hook rows and six-kind filter; create `catalog/hooks/.gitkeep`
- [x] 1.5 REFACTOR: dedupe against commands-kind code

## PR 2: hook-merge

- [x] 2.1 RED: table tests in `test/domain/hook-merge.test.ts` (append, deep-equal no-op, other matcher, empty arrays, absent file, tab/4-space indent, no trailing newline, wrong shapes, created flags)
- [x] 2.2 GREEN: `src/domain/hook-merge.ts` add/remove/update with strict `JSON.parse` and `ConfigError("<path>: <reason>")`
- [x] 2.3 RED/GREEN: remove drops group/event only if created and empty; update in place
- [x] 2.4 REFACTOR: shared locate helper

## PR 3: Manifest and hook-plan

- [x] 3.1 RED: old-manifest fixture parses; hook item round-trips (`test/domain/manifest.test.ts`)
- [x] 3.2 GREEN: `src/domain/manifest.ts` hook item, `OwnedItem`, `deriveOwnedItems`, `entryHash`
- [x] 3.3 RED: classify skip/update/create, never conflict (`test/domain/plan/hook-plan.test.ts`)
- [x] 3.4 GREEN: `src/domain/plan/hook-plan.ts`; `change-plan.ts` gains `hooks: HookFileChange[]`

## PR 4: Port, target, init/apply

- [ ] 4.1 RED: `settingsPath` user/project and `toHookHandler` (`test/adapters/claude-code/target.test.ts`)
- [ ] 4.2 GREEN: `src/ports/agent-target.ts`, `src/adapters/claude-code/target.ts`
- [ ] 4.3 RED: apply writes, idempotent re-run, `StaleFileError`, rollback, backup, created `.claude/` (`test/application/init-mcps.test.ts`)
- [ ] 4.4 GREEN: `src/application/init-mcps.ts` hook branch (re-read, replan, `writeAtomic`, manifest items)

## PR 5: Undo

- [ ] 5.1 RED: byte restore, delete if created, drift refused exit 3, `--force` targeted reverse, `.claude/` pruning (`test/application/undo-install.test.ts`)
- [ ] 5.2 GREEN: `src/application/undo-install.ts` roots, `isByteFile`, `prunableDirs`, reverse precomputed before first write

## PR 6: Uninstall, status, doctor

- [ ] 6.1 RED: uninstall `--kind hook`, edited exit 3, already absent, `modified: false` (`test/application/uninstall-item.test.ts`)
- [ ] 6.2 GREEN: `src/application/uninstall-item.ts` hook branches
- [ ] 6.3 RED: edited hook is `missing`, unparseable is `modified`, no env-unset false positive (`test/application/installed-state.test.ts`)
- [ ] 6.4 GREEN: `src/application/installed-state.ts` `observeHook`; `src/domain/doctor-plan.ts` `hook-missing`, `config-unreadable`

## PR 7: CLI gate (flag and gate together)

- [ ] 7.1 RED: `--yes` without `--allow-hooks` exits 1, writes nothing; `--allow-hooks`, dry-run, decline, `--source` (`test/adapters/cli/program.test.ts`)
- [ ] 7.2 GREEN: `src/adapters/cli/program.ts` `--hooks`, `--allow-hooks`, `--kind hook`; `src/ports/prompter.ts` `confirmHooks`
- [ ] 7.3 GREEN: `src/adapters/cli/clack-prompter.ts` hooks selection and confirm; hidden when empty

## PR 8: Docs

- [ ] 8.1 RED: generator drift tests for hook section (`test/tooling.test.ts`)
- [ ] 8.2 GREEN: `scripts/generate-catalog-table.mjs`, `scripts/generate-website-catalog.mjs`
- [ ] 8.3 Docs: README, CONTRIBUTING, security page en/es, flags, `/config` note

## Key Learnings

1. Keeping the hooks flag and its confirmation gate in one PR avoids an unguarded install path.
2. Pure merge logic lands before wiring so it can be reviewed without runtime impact.

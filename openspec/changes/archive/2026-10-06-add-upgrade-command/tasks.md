# Tasks: Add CLI Upgrade Command

## Review Workload Forecast

| Field                   | Value           |
| ----------------------- | --------------- |
| Estimated changed lines | 520–680         |
| 400-line budget risk    | High            |
| Chained PRs recommended | Yes             |
| Suggested split         | PR 1 → PR 2     |
| Delivery strategy       | auto-chain      |
| Chain strategy          | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                           | Likely PR | Focused test command                                                                           | Runtime harness                                | Rollback boundary                                      |
| ---- | ---------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| 1    | Domain argv/runnability + `upgradeCli` (TDD)   | PR 1      | `pnpm exec vitest run test/domain/install-method.test.ts test/application/upgrade-cli.test.ts` | N/A — unit fakes only; no CLI entry yet        | Remove `upgrade-cli.ts` + domain helpers/tests         |
| 2    | CLI register, notifier skip, main wire, README | PR 2      | `pnpm exec vitest run test/adapters/cli/program.test.ts`                                       | `node dist/main.js upgrade --help` after build | Drop `upgrade` registration, skip list, README section |

## Phase 1: Domain foundation (TDD)

- [x] 1.1 RED: extend `test/domain/install-method.test.ts` — `isRunnableUpgrade` true only for npm/pnpm-global; `upgradeArgv` exact tokens; npx/unknown not runnable
- [x] 1.2 GREEN: add `isRunnableUpgrade` + `upgradeArgv` in `src/domain/install-method.ts`; keep `upgradeCommand`

## Phase 2: Application use case (TDD)

- [x] 2.1 RED: create `test/application/upgrade-cli.test.ts` — fresh `source.latest` called; null latest → exit ≠0, no spawn
- [x] 2.2 RED: already-latest → exit 0 + clear message, no spawn; newer → current→target before next action
- [x] 2.3 RED: npm/pnpm-global spawn exact `upgradeArgv` via runner; npx/unknown print-only with zero runner calls
- [x] 2.4 RED: non-zero PM exit → CLI ≠0, install unchanged + recovery text, no success claim
- [x] 2.5 GREEN: implement `src/application/upgrade-cli.ts` to pass 2.1–2.4 (~10s AbortSignal default)

## Phase 3: CLI wiring + notifier skip (TDD)

- [x] 3.1 RED: extend `test/adapters/cli/program.test.ts` — `upgrade` registered; no self-update `update` command
- [x] 3.2 RED: `upgrade` skips notifier I/O like version; other commands still notify
- [x] 3.3 GREEN: register `upgrade` in `src/adapters/cli/program.ts`; extend skip predicate; invoke `upgradeCli`
- [x] 3.4 GREEN: pass `installMethod` on `CliDeps` from `src/main.ts`

## Phase 4: Docs + verification

- [x] 4.1 Document `shitaku upgrade` in `README.md` (spawn vs print-only, already-latest, CLI package scope; no #46 `update`)
- [x] 4.2 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`

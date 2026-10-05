# Tasks: Installable catalog scripts

## Review Workload Forecast

| Field                   | Value                                                   |
| ----------------------- | ------------------------------------------------------- |
| Estimated changed lines | 1600–2200                                               |
| 400-line budget risk    | High                                                    |
| Chained PRs recommended | Yes                                                     |
| Suggested split         | PR1 schema/load/list → PR2 install → PR3 run → PR4 docs |
| Delivery strategy       | ask-on-risk                                             |
| Chain strategy          | stacked-to-main                                         |

Decision needed before apply: No (user chose chained PRs + stacked-to-main)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                 | Likely PR | Focused test command                                                   | Runtime harness                    | Rollback boundary                            |
| ---- | -------------------- | --------- | ---------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------- |
| 1    | Schema/load/list     | PR 1      | `vitest run test/domain/catalog test/adapters/catalog`                 | `list scripts`                     | schema/listing/profile/folder-source + tests |
| 2    | Install lifecycle    | PR 2      | `vitest run test/domain/plan test/application`                         | init/status/undo/uninstall dry-run | plan/manifest/lifecycle + tests              |
| 3    | Run + ProcessRunner  | PR 3      | `vitest run test/application/run-script.test.ts test/adapters/process` | `run` list/unknown/path-reject     | runner/run-script/CLI/doctor + tests         |
| 4    | Empty catalog + docs | PR 4      | `pnpm test`                                                            | README / empty list                | `catalog/scripts/`, README, CONTRIBUTING     |

## Phase 1: Schema, paths, load, list (PR1)

- [x] 1.1 RED: `test/domain/catalog/script.test.ts` — parse `script.json`; reject invalid/guards
- [x] 1.2 GREEN: `src/domain/catalog/script.ts` — `ScriptItem`/`ScriptMetaSchema`
- [x] 1.3 RED→GREEN: `src/domain/scripts-paths.ts` + tests — project/user roots; not agent dirs
- [x] 1.4 RED→GREEN: `schema.ts`/`profile.ts`/`listing.ts` + tests — `items.scripts`, profile `scripts[]`, `LIST_KINDS`
- [x] 1.5 RED→GREEN: `folder-source.ts` + tests — `loadScripts`; empty OK
- [x] 1.6 RED→GREEN: CLI `list scripts` / JSON `"kind":"script"` in `program.ts` + tests

## Phase 2: Install lifecycle (PR2)

- [x] 2.1 RED→GREEN: `script-plan.ts` + `change-plan.ts` — create\|skip\|update\|conflict; dry-run/force
- [x] 2.2 RED→GREEN: `manifest.ts` — `kind:'script'` tree hash + ownership
- [x] 2.3 RED: init conflict exit 2 / dry-run no writes / unknown `--scripts`
- [x] 2.4 GREEN: `init-mcps.ts`/`skill-tree.ts`/`prompter.ts` — Paths roots; `--scripts`; prompts
- [x] 2.5 RED→GREEN: mid-write failure rollback — no partial dir; no manifest row
- [x] 2.6 RED→GREEN: `status-plan.ts`/`status.ts` — script states; unsafe → `modified`
- [x] 2.7 RED→GREEN: `undo-install.ts` — script undo; refuse drift
- [x] 2.8 RED→GREEN: `uninstall-item.ts` — `--kind script`; collision; modified exit 3 / force keeps extras

## Phase 3: Run + ProcessRunner + doctor (PR3)

- [x] 3.1 RED (threat): reject path-like names; no spawn; never spawn metadata
- [x] 3.2 RED→GREEN: name/tool policy + Win path fixtures
- [x] 3.3 RED→GREEN: `process-runner.ts` + `node-process-runner.ts` — `shell:false`; exit passthrough; Win `.cmd`
- [x] 3.4 RED→GREEN: `run-script.ts` — bare list; project→user; args/exit; `.bin` then `npx`
- [x] 3.5 RED→GREEN: unknown name non-zero + suggest bare `run`
- [x] 3.6 RED→GREEN: `doctor-plan.ts`/`doctor.ts` — `info`/`script-tool-missing`; warn-only exit 0
- [x] 3.7 GREEN: CLI `run` + `main.ts` wire; architecture guard bans spawn in domain

## Phase 4: Catalog structure + docs (PR4)

- [x] 4.1 Empty `catalog/scripts/` + `items.scripts: []`; no concrete scripts
- [x] 4.2 README/CONTRIBUTING + generators for scripts / `shitaku run`
- [x] 4.3 Verify: `pnpm test`, typecheck, lint, format:check, build

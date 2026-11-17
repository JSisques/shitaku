# Tasks: Add REA MCP Server to the Catalog

## Review Workload Forecast

| Field                   | Value                                    |
| ----------------------- | ---------------------------------------- |
| Estimated changed lines | 40–60 authored (generated docs excluded) |
| 400-line budget risk    | Low                                      |
| Chained PRs recommended | No                                       |
| Suggested split         | Single PR, two commits (feat then docs)  |
| Delivery strategy       | ask-on-risk                              |
| Chain strategy          | pending                                  |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Note: `ask-on-risk` only asks when the budget is at risk; the forecast is Low (`rea.json` about 10 lines, `catalog.json` 1 line, test about 30 lines, README sample 1 line), so no decision is needed. Generated docs (README table row, two website pages) are excluded from the authored count.

### Suggested Work Units

| Unit | Goal                                    | Likely PR | Focused test command                                                 | Runtime harness                                                                        | Rollback boundary                                                                                       |
| ---- | --------------------------------------- | --------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1    | rea entry + registration + test guard   | PR 1      | `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts`     | `node dist/main.js init --mcps rea --scope project --dry-run` (after `pnpm run build`) | Revert `catalog/mcps/rea.json`, `catalog/catalog.json`, `test/adapters/catalog/bundled-catalog.test.ts` |
| 2    | Regenerated README and website listings | PR 1      | `pnpm run docs:catalog:check && pnpm run docs:website-catalog:check` | N/A: generated docs only, covered by the check scripts                                 | Revert `README.md` and `website/src/content/docs/{en,es}/catalog/mcps/rea.md`                           |

## Phase 0: Upstream confirmation

- [ ] 0.1 Confirm the upstream `mcp` subcommand exists in `rea-agents@6.9.0`: run `npx -y rea-agents@6.9.0 mcp --help` bounded (for example with `timeout 60`), non-interactive (stdin from `/dev/null`), and record the observed output or error. If the subcommand is missing, STOP and report; do not proceed with the pinned args. Resolves the design Open Question. Spec: Stdio server definition with exact pin.

## Phase 1: RED (strict TDD)

- [ ] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, append `'rea'` to the exact `catalog.mcps` name list in the first `it`; `catalog.issues` stays empty. Spec: Bundled registration (Bundled load succeeds); Bundled-catalog test covers rea.
- [ ] 1.2 In the same file, add `it('ships rea as a pinned stdio MCP without env, outside every profile')` loading the bundled catalog via `FolderCatalogSource`. Assert: `rea.server` `toEqual({ type: 'stdio', command: 'npx', args: ['-y', 'rea-agents@6.9.0', 'mcp'] })`; `rea.env` `toEqual([])`; raw `catalog/mcps/rea.json` via `readFileSync` contains no `${`; no `args` entry contains `@latest`; `description` has no newline, matches `/reverse/i` and `/Hopper|Ghidra|IDA/`; `resolveProfile` for `base`, `web` and `backend` returns `mcps` without `rea`. Do not modify existing profile assertions. Spec: Stdio server definition with exact pin; No environment or secrets; Description states the native-analysis prerequisite; Excluded from profiles.
- [ ] 1.3 Run `pnpm test` and record the failures as RED evidence (exact list mismatch; `rea` undefined). Do not proceed until observed failing.

## Phase 2: GREEN

- [ ] 2.1 Create `catalog/mcps/rea.json` per the design Interfaces contract: `name` `rea`, one-line description (no `|`, no `"`) `REA (Reverse Engineer Anything) reverse-engineering tools for binaries and apps; native analysis requires Hopper, Ghidra or IDA already installed`, `server` `{ "type": "stdio", "command": "npx", "args": ["-y", "rea-agents@6.9.0", "mcp"] }`, no `env` key anywhere. Spec: Stdio server definition with exact pin; No environment or secrets; Description states the native-analysis prerequisite.
- [ ] 2.2 Append `"rea"` last to `catalog/catalog.json` `items.mcps`. Do not touch `catalog/profiles/*`. Spec: Bundled registration; Excluded from profiles.
- [ ] 2.3 Run `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts` then `pnpm test`; confirm GREEN.

## Phase 3: Refactor and quality gate

- [ ] 3.1 Run `pnpm run format` on touched files, then `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm test`; all pass. Spec: Catalog-only surface (no `src/` change).
- [ ] 3.2 Confirm `git diff --stat` shows no `src/` or `catalog/profiles/` changes, then commit test, `rea.json` and `catalog.json`: `feat(catalog): add rea mcp server` (Conventional Commits; no Co-Authored-By or AI attribution; no `--no-verify`). Spec: No src changes; Profiles unchanged.

## Phase 4: Docs sync

- [ ] 4.1 Run `pnpm run docs:catalog` (updates the `README.md` MCP table). Spec: Generated docs in sync.
- [ ] 4.2 Run `pnpm run docs:website-catalog` (creates `website/src/content/docs/en/catalog/mcps/rea.md` and `website/src/content/docs/es/catalog/mcps/rea.md`); commit any other generator output, never hand-edit generated files.
- [ ] 4.3 In `README.md` "List" section, add the `rea` line to the hand-kept `shitaku list` sample between `playwright` and `sqlite`, keeping the 26-character name column.
- [ ] 4.4 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both pass.
- [ ] 4.5 Run `pnpm run format:check` and confirm it passes on all touched files including the OpenSpec markdown under `openspec/changes/add-rea-mcp-server/` (proposal, spec, design, tasks); run `pnpm run format` on those files if it fails.
- [ ] 4.6 Commit generated docs: `docs: list rea mcp server in README and website` (no Co-Authored-By or AI attribution; no `--no-verify`).

## Phase 5: Acceptance verification

- [ ] 5.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run build`; all pass.
- [ ] 5.2 Run `node dist/main.js init --mcps rea --scope project --dry-run` in a clean temp project; the plan includes `rea` and no file, backup or manifest is written. Spec: Installable under existing mcp-install (Dry-run plans the MCP).
- [ ] 5.3 Confirm `git diff --stat main -- src catalog/profiles` is empty. Spec: Catalog-only surface (No src changes).
- [ ] 5.4 Note for PR time (non-blocking): record the official-source check (npm `rea-agents`, MIT, `morluto/rea`) and the `6.9.0` versus `6.5.0` deviation in the PR body.

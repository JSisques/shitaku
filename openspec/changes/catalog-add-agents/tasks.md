# Tasks: Installable agents in the catalog (#42)

## Review Workload Forecast

| Field                   | Value                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Estimated changed lines | ~2,500 total (PR1 150, PR2 210, PR3a 200, PR3b 200, PR4 350, PR5 350, PR6 300, PR7 350, PR8 350) |
| 400-line budget risk    | High (total); Medium for PR 3a/3b, 4, 5, 7, 8 (each estimate is within 50 lines of the cap)      |
| Chained PRs recommended | Yes                                                                                              |
| Suggested split         | PR 1 -> PR 2 -> PR 3a -> PR 3b -> PR 4 -> PR 5 -> PR 6 -> PR 7 -> PR 8                           |
| Delivery strategy       | ask-on-risk                                                                                      |
| Chain strategy          | stacked-to-main                                                                                  |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Decision needed before apply (ask-on-risk): confirm (1) stacked-to-main is accepted, and (2) PR 3 is pre-split into 3a/3b (design estimates ~380 "tight"; fixtures in `agents: []` plus the `parseAgent` tests make an overrun likely). Risk: with stacked-to-main every PR targets `main`, so PR N+1 must be rebased after PR N merges; if reviewers prefer isolated child diffs while PRs are open, `feature-branch-chain` is the alternative (not assumed here). Confirmed decision: v1 rejects block-scalar `name`/`description`; follow-up is https://github.com/JSisques/shitaku/issues/238.

### Suggested Work Units

| Unit | Goal                                          | PR  | Focused test command                                                                       | Runtime harness                          | Rollback boundary                        |
| ---- | --------------------------------------------- | --- | ------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------- |
| 1    | Dedupe flat-file refactor, `isFlatFileKind`   | 1   | `pnpm vitest run test/application test/domain`                                             | Existing suites (behavior-preserving)    | Param/signature changes only             |
| 2    | Nested frontmatter mode                       | 2   | `pnpm vitest run test/domain/catalog/frontmatter.test.ts`                                  | N/A: pure, unreachable                   | `frontmatter.ts` + test + design.md note |
| 3a   | `parseAgent`, schema `agents`, fixtures       | 3a  | `pnpm vitest run test/domain/catalog`                                                      | N/A: not loaded yet                      | `agent.ts`, `schema.ts`, helpers         |
| 3b   | Loader, listing, profile `agents`, `.gitkeep` | 3b  | `pnpm vitest run test/adapters/catalog test/domain/catalog`                                | `shitaku list agents` on fixture catalog | loader/listing/profile/`catalog.json`    |
| 4    | Manifest kind, ownership, plan, port          | 4   | `pnpm vitest run test/domain test/adapters/claude-code`                                    | N/A: not wired                           | manifest, plan, port, target             |
| 5    | Init plan/apply + undo round trip             | 5   | `pnpm vitest run test/application/init-mcps.test.ts test/application/undo-install.test.ts` | In-memory install then undo              | `init-mcps.ts` agent branches            |
| 6    | Uninstall, status, doctor                     | 6   | `pnpm vitest run test/application`                                                         | In-memory status/doctor                  | those use cases                          |
| 7    | Docs, generators, website, downgrade note     | 7   | `pnpm vitest run test/tooling.test.ts test/generators.test.ts`                             | `pnpm docs:catalog:check`                | docs/scripts only                        |
| 8    | CLI `--agents`, `--kind agent`, trust copy    | 8   | `pnpm vitest run test/adapters/cli`                                                        | CLI harness: `init --agents x --yes`     | `program.ts`, prompter files             |

Every PR: RED test first, then GREEN, then REFACTOR. Verification before each PR (all must pass): `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test && pnpm run build`.

## PR 1: Dedupe (~150 lines)

Spec scenarios: none new (behavior-preserving); supports every later PR.

- [x] 1.1 RED: `isFlatFileKind` table test (`command` true; `agent`, `skill`, `hook` as designed) in `test/domain/manifest.test.ts`
- [x] 1.2 RED: switch profile tests to the object arg (`resolveProfile(name, profiles, known)`, `validateProfiles(profiles, known)`) in `test/domain/catalog/profile.test.ts`
- [x] 1.3 GREEN: add `FlatFileKind`, `isFlatFileKind` in `src/domain/manifest.ts`; `KnownNames` and object-arg signatures in `src/domain/catalog/profile.ts`; update call site in `src/adapters/catalog/folder-source.ts`
- [x] 1.4 GREEN: `refreshFlatFile(deps, change, owned, force, kind)`, `ByteStep.item.kind: TreeKind | FlatFileKind`, `commandStep` -> `flatFileStep(change, kind)` in `src/application/init-mcps.ts`
- [x] 1.5 REFACTOR: run the grep checklist (task 6.8 command) and record the baseline hit list in the PR description; existing command suites stay green

## PR 2: Frontmatter nested mode (~210 lines)

Spec scenarios: catalog "Opt-in nested frontmatter reader" (Strict mode unchanged, Nested mode for agents, Missing frontmatter still rejected).

- [x] 2.1 RED: in `test/domain/catalog/frontmatter.test.ts`, strict mode unchanged (existing tests untouched)
- [x] 2.2 RED: nested mode cases: `tools` list, `mcpServers` map, `|` block, `>` block, empty value, orphan indented line (issue), CRLF, no/unterminated frontmatter rejected, `opaque` names returned
- [x] 2.3 GREEN: `readFrontmatter(text, file, { allowNested: true })` and `FrontmatterResult.opaque` in `src/domain/catalog/frontmatter.ts` (pure; default mode byte-identical)
- [x] 2.4 REFACTOR: share line-splitting helper between modes; keep architecture guard green (`test/architecture.test.ts`)
- [x] 2.5 Edit `openspec/changes/catalog-add-agents/design.md`: resolve the Open Question as "block-scalar `name`/`description` rejected in v1; follow-up https://github.com/JSisques/shitaku/issues/238"

## PR 3a: Agent schema (~200 lines)

Spec scenarios: catalog "Valid agent loads", "Name differs from file stem", "Required fields", "Empty body", "Name regex", "No allowed-field list", "Nested YAML preserved verbatim", "Old catalog without agents".

- [x] 3a.1 RED: `parseAgent` table in `test/domain/catalog/agent.test.ts`: missing/whitespace `name` or `description`, name != stem, opaque `description` -> `key 'description' must be a single-line value`, empty/whitespace body, regex (`Reviewer`, `-x`, `a_b` rejected; `reviewer2` ok), unknown key passes, nested YAML valid, bytes verbatim
- [x] 3a.2 GREEN: create `src/domain/catalog/agent.ts` (`parseAgent(stem, bytes)` using `allowNested`)
- [x] 3a.3 RED/GREEN: `items.agents` optional, default `[]`, a path-traversal agent name (dot-dot-slash prefix) fails whole catalog (`test/domain/catalog/schema.test.ts`, `src/domain/catalog/schema.ts`)
- [x] 3a.4 GREEN: `test/helpers/agents.ts` builder; add `agents: []` to catalog fixtures under `test/fixtures/`
- [x] 3a.5 REFACTOR: reuse the command-name regex constant; no duplicate

## PR 3b: Loader, listing, profile (~200 lines)

Spec scenarios: catalog "Unlisted, ghost, or guarded", "Layout with agents", "Agents resolved", "Unknown agent reference", "Profile without agents field"; catalog-list all four scenarios of "Agents list shape" and "Kind filter" (list side).

- [x] 3b.1 RED: loader loads valid agent, rejects unlisted/ghost/symlink/oversize, `agents/` subdirs not scanned (`test/adapters/catalog/folder-source.test.ts`)
- [x] 3b.2 GREEN: `loadFileItems` agents branch in `src/adapters/catalog/folder-source.ts`; `Catalog.agents`
- [x] 3b.3 RED/GREEN: profile `agents` (default empty, dedupe via `extends`, unknown agent names `ghost`) in `test/domain/catalog/profile.test.ts`, `src/domain/catalog/profile.ts`
- [x] 3b.4 RED/GREEN: listing rows `kind: 'agent'`, seven-kind filter, `list agents` empty -> `no matching items` in `test/domain/catalog/listing.test.ts`, `src/domain/catalog/listing.ts`
- [x] 3b.5 GREEN: `catalog/catalog.json` gains `"agents": []`; create `catalog/agents/.gitkeep`
- [x] 3b.6 REFACTOR: `ResolvedProfile` gains `agents`; typecheck all call sites

## PR 4: Manifest, plan, port (~350 lines)

Spec scenarios: agents-install "Old manifest", "Agent item round trip", "User and project roots" (paths), "Create/Skip/Owned update/Unmanaged different/Owned but user-edited/Force update" (plan level).

- [x] 4.1 RED: old-manifest fixture parses; `agent` item round-trips; null `afterHash` accepted for agent (`test/domain/manifest.test.ts`)
- [x] 4.2 GREEN: `TreeItemSchema.extend({ kind: z.literal('agent') })`; refine uses `isTreeKind(k) || isFlatFileKind(k)`; `deriveAgentOwnership`; `OwnedItem.kind` gains `'agent'` in `src/domain/manifest.ts`
- [x] 4.3 RED: `buildFlatFilePlan` noun `agent` -> create/skip/update/conflict with reason containing "agent"; `ChangePlan.agents` (`test/domain/plan/change-plan.test.ts`)
- [x] 4.4 GREEN: `src/domain/plan/change-plan.ts` agents field; `src/domain/plan/doctor-plan.ts` `agent-missing` code (consumed in PR 6)
- [x] 4.5 RED: `agentsDir('user'|'project')` (`test/adapters/claude-code/target.test.ts`)
- [x] 4.6 GREEN: `AgentTarget.agentsDir` in `src/ports/agent-target.ts`; Claude impl in `src/adapters/claude-code/target.ts`
- [x] 4.7 REFACTOR: update every in-memory `AgentTarget` test double

## PR 5: Init and undo (~350 lines)

Spec scenarios: agents-install "User and project roots", "Nested frontmatter kept verbatim", "Unrelated user agents untouched", "Skip identical", "Conflict refused", "Forced replace with backup", "Dry run", "Stale file at apply", "Clean undo prunes created directory", "Shared directory kept", "Drift refused", "Overwrite restored".

- [x] 5.1 RED: plan phase in `test/application/init-mcps.test.ts`: `planInit` reads agents via `agentsDir` + `readBytes`, conflict reason says "agent"
- [x] 5.2 GREEN: agent plan branch in `src/application/init-mcps.ts` (`buildFlatFilePlan` noun `agent`, `ChangePlan.agents`)
- [x] 5.3 RED: apply: create, update, force, backup, `StaleFileError`, rollback, skip not journaled, `mine.md` untouched
- [x] 5.4 GREEN: apply branch `refreshFlatFile(..., 'agent')` and manifest ownership in `src/application/init-mcps.ts`
- [x] 5.5 RED (verify-only, expected green): undo round trip deletes created file, prunes created `.claude/agents/`, keeps shared dir, refuses drift, restores backup (`test/application/undo-install.test.ts`); `src/application/undo-install.ts` needs NO change (design f); if red, fix generic `isByteFile`/`itemRoots` only
- [x] 5.6 REFACTOR: collapse duplicated command/agent apply code to the shared helper

## PR 6: Uninstall, status, doctor (~300 lines)

Spec scenarios: agents-install "Agent uninstall" (3), item-uninstall (all, incl. "Skill and agent share a name", "Command and agent share a name"), install-status (all).

- [ ] 6.1 RED: uninstall removed / refused modified / already absent / dry-run / `--force`, backup, journal `remove`; undo restores (`test/application/uninstall-item.test.ts`)
- [ ] 6.2 GREEN: `isFlatFileKind` in `assertFresh` and plan branch, agent resolution by absolute path in `src/application/uninstall-item.ts`
- [ ] 6.3 RED: skill+agent and command+agent same-name collision exit 1 with candidates; `--kind agent` disambiguates
- [ ] 6.4 RED: status states installed/modified/out-of-date/missing/missing-from-catalog for agents; same name two scopes; skill+agent both listed (`test/application/status.test.ts`)
- [ ] 6.5 GREEN: `observeFile` dispatch via `isFlatFileKind`, `expectedPath`, `desiredFor` agent branches in `src/application/installed-state.ts`
- [ ] 6.6 RED/GREEN: doctor `agent-missing` names agent and path, healthy/modified agent no finding, writes nothing (`test/domain/plan/doctor-plan.test.ts`, `src/domain/plan/doctor-plan.ts`)
- [ ] 6.7 REFACTOR: remove dead `kind === 'command'` duplicates
- [ ] 6.8 GREP CHECKLIST: run `rg -n "kind === 'command'|kind !== 'command'|'command'" src` and classify every hit as (a) migrated to `isFlatFileKind`, (b) explicit agent branch added (`expectedPath`, `desiredFor`, `doctor-plan.ts`), or (c) intentionally command-only with a code comment; zero unclassified hits (re-run in PR 8 for `program.ts` and `prompter.ts`)

## PR 7: Docs and generators (~350 lines)

Spec scenarios: agents-install "Downgrade documented"; catalog "Limit documented", "Copy mentions agents" (security docs side).

- [ ] 7.1 RED: `test/generators.test.ts` and `test/tooling.test.ts` expect agents in generated tables and `docs:catalog:check` to pass
- [ ] 7.2 GREEN: update `scripts/generate-*.mjs` and README generated markers in `README.md` (agents row, no flag docs yet)
- [ ] 7.3 Edit `CONTRIBUTING.md`: "Adding agents" section, nested-YAML-not-validated limit, and the single-line `name`/`description` limit with reference to https://github.com/JSisques/shitaku/issues/238
- [ ] 7.4 Edit `README.md`: single-line `name`/`description` note referencing https://github.com/JSisques/shitaku/issues/238; manifest downgrade note (undo/uninstall agents before downgrading); security copy mentions agents can grant tools or permissions
- [ ] 7.5 Update website pages (en, es) under `website/` for agents kind and downgrade note
- [ ] 7.6 Verify: `pnpm docs:catalog:check` passes; no drift

## PR 8: CLI and trust copy (~350 lines)

Spec scenarios: agents-install "Agent selection" (3), "Interactive conflict choice"; catalog "Copy mentions agents", "No consent gate"; item-uninstall "Valid agent kind", "Invalid kind"; catalog-list "Invalid kind".

- [ ] 8.1 RED: CLI harness in `test/adapters/cli/`: `--agents reviewer --yes` installs only reviewer; `--agents ghost` exits non-zero naming it; `--agents` counts as a kind flag; no consent gate with `--source`; `--source` help mentions agents and tool/permission grants
- [ ] 8.2 RED: interactive selection offered only when catalog has agents; conflict prompt labels `agent`; `--kind agent` accepted by `uninstall`, `--kind widget` lists `agent` in choices error; `list agents` accepted
- [ ] 8.3 GREEN: `--agents`, `--kind agent`, list choices, trust copy in `src/adapters/cli/program.ts`
- [ ] 8.4 GREEN: agent selection and noun in `src/ports/prompter.ts`, `src/adapters/cli/clack-prompter.ts` (and prompter test doubles under `test/helpers/`)
- [ ] 8.5 Update flag docs in `README.md` (`--agents`, `--kind agent`); re-run `pnpm docs:catalog:check`
- [ ] 8.6 Re-run grep checklist (6.8) across `src`; final full verification and manual smoke: `pnpm run build && node dist/main.js list agents`

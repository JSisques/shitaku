# Tasks: Installable rules in the catalog (issue #237)

Strict TDD (`pnpm test`): every behavior task is RED (failing test) -> GREEN (minimal code) -> REFACTOR. Commits are work units (tests and docs travel with the behavior), Conventional Commits, no AI attribution. Spec refs use `capability / Requirement`.

## Review Workload Forecast

| Field                   | Value                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Estimated changed lines | ~1800 total (additions + deletions, generated website pages excluded), 5 slices of ~350-380 |
| 400-line budget risk    | High                                                                                        |
| Chained PRs recommended | Yes                                                                                         |
| Suggested split         | PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5                                                        |
| Delivery strategy       | ask-on-risk                                                                                 |
| Chain strategy          | stacked-to-main                                                                             |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Decision note: strategy is already chosen (stacked-to-main, decisions are final). `ask-on-risk` still requires the orchestrator to confirm the slice plan with the user before the first `sdd-apply`. Slice 2 and slice 4 carry the most literal-churn risk (`rules: []` in ~25 test literals); if a slice measures above 400 after one honest pass, report the overage and recommend `size:exception` rather than trimming code, tests, or docs.

Branch and base per stacked-to-main (each PR targets the previous PR branch; the first targets `main`):

| PR  | Branch                              | Base                                |
| --- | ----------------------------------- | ----------------------------------- |
| 1   | `feat/rules-1-domain-catalog`       | `main`                              |
| 2   | `feat/rules-2-manifest-plan`        | `feat/rules-1-domain-catalog`       |
| 3   | `feat/rules-3-apply-lifecycle`      | `feat/rules-2-manifest-plan`        |
| 4   | `feat/rules-4-seed-docs-generators` | `feat/rules-3-apply-lifecycle`      |
| 5   | `feat/rules-5-cli-user-docs`        | `feat/rules-4-seed-docs-generators` |

Each child PR carries a dependency diagram marking itself with the pin marker, and states start, end, prior dependencies, follow-up and out-of-scope. Child diffs must show only their own unit; a polluted diff is a base bug (retarget/rebase).

### Suggested Work Units

| Unit | Goal                                                                         | Likely PR | Focused test command                                                                                                       | Runtime harness                                                                                                                                                | Rollback boundary                                                                                                             |
| ---- | ---------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | Domain catalog: `parseRule`, schema, listing, loader, recommended validation | PR 1      | `pnpm vitest run test/domain/catalog test/adapters/catalog/folder-source.test.ts`                                          | `list rules --source <temp catalog with one rule>` via the CLI test harness in `test/adapters/cli/program.test.ts` (rules appear; bundled catalog still empty) | `src/domain/catalog/rule.ts`, schema/listing/loader hunks, `test/helpers/rules.ts`; `rules: []` literals are harmless to keep |
| 2    | Manifest kind, ownership, `ChangePlan.rules`, `rulesDir`, `planInit` rules   | PR 2      | `pnpm vitest run test/domain/manifest.test.ts test/adapters/claude-code/target.test.ts test/application/init-mcps.test.ts` | N/A: plan is computed but never applied and no CLI flag exists; covered by application-level plan tests                                                        | manifest/plan/port/target/init-mcps plan hunks (inert without slice 3 and 5)                                                  |
| 3    | Apply and lifecycle: apply, uninstall, installed-state, doctor, round trips  | PR 3      | `pnpm vitest run test/application test/domain/plan/doctor-plan.test.ts`                                                    | Application-API round trip on the in-memory fs: install -> status -> edit -> uninstall refused -> `--force` -> undo (no CLI exposure yet)                      | `init-mcps` apply hunks, `uninstall-item.ts`, `installed-state.ts`, `doctor-plan.ts` map                                      |
| 4    | Seed rules (10) + `catalog.json` + generators + generated docs               | PR 4      | `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts test/generators.test.ts`                                    | `pnpm run docs:catalog --check` and `pnpm run build` then `node dist/main.js list rules` shows 10 rules                                                        | `catalog/rules/*.md`, `catalog.json` keys, generator hunks, generated pages                                                   |
| 5    | CLI surface, interactive recommended set, user docs, manual smoke check      | PR 5      | `pnpm vitest run test/adapters/cli test/rules-docs.test.ts`                                                                | `node dist/main.js init --rules no-secrets --scope project --yes` in a scratch dir, then manual Claude Code `/memory` check                                    | `program.ts`, `clack-prompter.ts`, `prompter.ts` `selectRules`, docs hunks (revert hides the feature)                         |

## Phase 1: Slice 1 - Domain catalog (PR 1, branch `feat/rules-1-domain-catalog`, base `main`)

Start: no rule concept. Finish: `list rules` works against a `--source` catalog; bundled catalog still has no rules. Out of scope: manifest, plan, CLI flags, seed data.

- [x] 1.1 RED: create `test/helpers/rules.ts` (`ruleBytes`, `ruleItem` mirroring `test/helpers/agents.ts`) and `test/domain/catalog/rule.test.ts` covering: valid rule; name != stem; missing/empty/whitespace/opaque `name` and `description`; empty/whitespace body; scalar `paths`; nested `paths` list accepted; unknown key `futurefield: 1` passes through with bytes identical; `check` and `severity` rejected with `key '<key>' is reserved for rule checks (see #288)`; invalid stems `Naming`, `-x`, `a_b` rejected and `rule2` accepted. Fails (module missing). (catalog / Rule catalog entries; Opt-in nested frontmatter reader)
- [x] 1.2 GREEN: create `src/domain/catalog/rule.ts` with `RuleNameSchema`, `RuleItem` (with `recommended: boolean`), `RESERVED_RULE_KEYS`, `parseRule(stem, bytes)` using `readFrontmatter(..., { allowNested: true })`, returning `recommended: false`. Stays pure (no `fs`/`path`).
- [x] 1.3 RED: extend `test/domain/catalog/schema.test.ts`: `items.rules` defaults to `[]`; `recommended` defaults to `{ rules: [] }`; invalid rule name (`../evil`) in `items.rules` or `recommended.rules` fails naming the entry; old catalog without either key still parses; `ProfileSchema` accepts and rejects exactly as before. (catalog / Old catalog without rules; Invalid name in the index; Profiles unaffected)
- [x] 1.4 GREEN: modify `src/domain/catalog/schema.ts`: `items.rules` default `[]`, top-level `recommended: z.object({ rules: ... }).prefault({})`, `Catalog.rules: RuleItem[]`. Do not touch `ProfileSchema`.
- [x] 1.5 RED: extend `test/domain/catalog/listing.test.ts`: `listEntries` returns kind `rule` entries sorted with others; `list rules` filter returns only rules; `LIST_KINDS` includes `rules`. (catalog-list / Rules list shape; Kind filter)
- [x] 1.6 GREEN: modify `src/domain/catalog/listing.ts`: `LIST_KINDS` + `rules`, `EntryKind` + `rule`, `ENTRY_KIND.rules`, rules in `listEntries`.
- [x] 1.7 RED: extend `test/adapters/catalog/folder-source.test.ts` (temp catalog dirs): listed rule loads with bytes unchanged; listed ghost -> issue; unlisted `rules/x.md` -> issue; symlinked rule refused; invalid rule yields issue while valid rules stay usable; `recommended.rules` name flips `RuleItem.recommended` to true; unknown or failed recommended name -> `CatalogIssue { file: 'catalog.json', reason: "recommended rule '<name>' is not a loaded rule" }` and is dropped; rule subdirectories not scanned. (catalog / Rule catalog entries - Unlisted, ghost, or guarded)
- [x] 1.8 GREEN: modify `src/adapters/catalog/folder-source.ts`: `loadRules` via `loadFileItems('rules', '.md', ...)`, recommended validation + flag, `rules` in the returned catalog. `known` for profiles unchanged.
- [x] 1.9 GREEN (mechanical): add `rules: []` to every `Catalog` literal: run `rg -n "agents: \[\]" src test` and update each `Catalog` site (not yet `ChangePlan`); fix any typecheck fallout.
- [x] 1.10 REFACTOR + verify: `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm test`; confirm `rg -n "ProfileSchema|resolveProfile" src` shows no diff and `rg -n "CLAUDE\.md" src` is empty.
- [ ] 1.11 Commit work units (e.g. `feat(catalog): add rule parser and schema`, `feat(catalog): load and list rules with recommended flag`); open PR 1 against `main` with chain context.

## Phase 2: Slice 2 - Manifest and plan (PR 2, branch `feat/rules-2-manifest-plan`, base `feat/rules-1-domain-catalog`)

Start: slice 1 merged/stacked. Finish: a rule plan can be computed (`planInit`), never applied; no CLI flag. Out of scope: apply, uninstall, status, doctor, CLI.

- [ ] 2.1 RED: extend `test/domain/manifest.test.ts`: manifest accepts item `kind: 'rule'` with null `afterHash`; `deriveRuleOwnership` returns path -> hash keyed by absolute path; `deriveOwnedItems` yields `kind: 'rule'` with path = root; `isFlatFileKind('rule')` true; manifest `version` stays 1; manifest with only old kinds loads unchanged; refine message mentions rule. (rules-install / Manifest backward compatibility)
- [ ] 2.2 GREEN: modify `src/domain/manifest.ts`: manifest item kind `rule` (`TreeItemSchema.extend({ kind: z.literal('rule') })`), `FlatFileKind`/`isFlatFileKind` + `rule`, `deriveTreeOwnership` kind union, `deriveRuleOwnership`, `OwnedItem.kind` + `rule`, refine message.
- [ ] 2.3 RED: extend `test/adapters/claude-code/target.test.ts`: `rulesDir('project', paths)` = `<cwd>/.claude/rules`; `rulesDir('user', paths)` = `<home>/.claude/rules`. (rules-install / Rule install roots)
- [ ] 2.4 GREEN: modify `src/ports/agent-target.ts` (`rulesDir(scope, paths)`) and `src/adapters/claude-code/target.ts`; update any fake `AgentTarget` in tests.
- [ ] 2.5 RED: extend `test/application/init-mcps.test.ts` (memory fs) plan tests: `rules` create when absent; skip when byte-identical and unowned (not journaled); update when owned and unmodified; conflict for unmanaged different file with rule-noun reason; conflict for owned but user-edited; `--force` -> update; unknown rule name throws `UnknownRuleError` naming it with nothing written; user file `mine.md` and `CLAUDE.md` never in plan. (rules-install / Plan classification; Rule selection - Unknown rule)
- [ ] 2.6 GREEN: modify `src/domain/plan/change-plan.ts` (`ChangePlan.rules: FlatFileChange[]`, `buildPlan` returns `rules: []`), `src/domain/plan/flat-file-plan.ts` (doc comment), `src/application/init-mcps.ts` (`InitRequest.rules`, `UnknownRuleError`, planning via `flatFileEntries(target.rulesDir)` + `buildFlatFilePlan` with `deriveRuleOwnership` and noun `rule`, `planMcps` empty plan `rules: []`).
- [ ] 2.7 GREEN (mechanical): add `rules: []` to every `ChangePlan` literal; fix typecheck fallout.
- [ ] 2.8 REFACTOR + verify: typecheck, lint, format:check, `pnpm test`; `rg -n "isFlatFileKind|FlatFileKind" src` reviewed (later branches handled in slice 3).
- [ ] 2.9 Commit work units; open PR 2 targeting `feat/rules-1-domain-catalog`.

## Phase 3: Slice 3 - Apply and lifecycle (PR 3, branch `feat/rules-3-apply-lifecycle`, base `feat/rules-2-manifest-plan`)

Start: plan exists. Finish: rules apply, journal, undo, uninstall, report and doctor correctly from the application API. Out of scope: CLI flag, seed data, docs.

- [ ] 3.1 RED: extend `test/application/init-mcps.test.ts` apply tests: apply writes byte-identical file to `rulesDir/<name>.md` (user and project root); nested-`paths` bytes verbatim; `skip` not journaled; overwrite backs up bytes first; stale file (changed between plan and apply) throws `StaleFileError` without writing; journal item `kind: 'rule'` with root = file path; empty-plan check counts rules; `createdDirs` records a newly created `.claude/rules`. (rules-install / Rule install roots; Conflict, dry-run, backup, and stale-file protection)
- [ ] 3.2 GREEN: modify `src/application/init-mcps.ts`: `refreshFlatFiles('rule')`, `flatFileStep('rule')` in `applyPlan`, rules in the empty-plan sum.
- [ ] 3.3 RED: extend `test/domain/plan/doctor-plan.test.ts`: absent owned rule -> `rule-missing`; edited owned rule -> `modified` info. (install-status / Doctor findings for rules)
- [ ] 3.4 GREEN: modify `src/domain/plan/doctor-plan.ts`: `DoctorCode` + `rule-missing`; replace the ternary with `MISSING_CODE: Record<FlatFileKind, DoctorCode>`.
- [ ] 3.5 RED: extend `test/application/status.test.ts` (and installed-state coverage): rule reports `ok`, `modified` after edit, `missing` after delete; desired hash = sha256(rule bytes). (install-status / Manifest-driven read-only report; Item states)
- [ ] 3.6 GREEN: modify `src/application/installed-state.ts`: `desiredFor` via a `Record<FlatFileKind, ...>` lookup over `commands`/`agents`/`rules`.
- [ ] 3.7 RED: extend `test/application/uninstall-item.test.ts`: unmodified rule removed with backup, journal action `remove`, exit 0; modified rule refused without `--force`; already deleted -> "already absent" exit 0; other files in the dir untouched; kind collision with same-named agent/command requires `--kind`. (item-uninstall / Rule uninstall resolution; Kind collision; rules-install / Rule uninstall)
- [ ] 3.8 GREEN: modify `src/application/uninstall-item.ts`: `expectedPath` rule branch (`rulesDir/<name>.md`) and doc comment.
- [ ] 3.9 RED/GREEN round trip in `test/application/undo-install.test.ts` (no `undo-install.ts` change expected, it is generic): install -> status ok -> edit -> status modified -> uninstall refused -> `--force` uninstall -> undo restores -> undo of install removes file and an emptied created `.claude/rules`; pre-existing or non-empty dir kept; drift refused without `--force`; overwrite backup restored. If a test exposes a kind branch, fix it in `src/application/undo-install.ts`. (rules-install / Undo of rules; round trip)
- [ ] 3.10 Verify grep checklist items: `rg -n "isFlatFileKind|FlatFileKind" src` every hit covers `rule`; `rg -n "plan\.(commands|agents)\.length" src` hits that need rules are updated or deferred to slice 5 (clack `confirm`, hook-decline); `rg -n "agent-missing" src test website README.md` list noted for slice 5 docs.
- [ ] 3.11 REFACTOR + verify: typecheck, lint, format:check, `pnpm test`.
- [ ] 3.12 Commit work units; open PR 3 targeting `feat/rules-2-manifest-plan`.

## Phase 4: Slice 4 - Seed rules and docs generators (PR 4, branch `feat/rules-4-seed-docs-generators`, base `feat/rules-3-apply-lifecycle`)

Start: lifecycle works via API. Finish: `list` shows ten bundled rules; generators and generated docs include rules; install still not exposed in CLI. Out of scope: CLI flag, interactive prompt, user-facing CLI docs.

- [ ] 4.1 RED: extend `test/adapters/catalog/bundled-catalog.test.ts`: bundled catalog loads exactly the ten names (`naming`, `small-changes`, `explain-why`, `no-new-deps`, `error-handling`, `ask-when-unsure`, `module-readme`, `conventional-commits`, `tests-for-changes`, `no-secrets`) with no catalog issues; `recommended` flag true for exactly `module-readme`, `conventional-commits`, `tests-for-changes`, `no-secrets`, `ask-when-unsure`; each seed <= 1,500 bytes, has no `paths`, no `check`/`severity`, and frontmatter keys are exactly `name` + `description`. (rules-install / Seed rules and documentation; Interactive selection and recommended set)
- [ ] 4.2 GREEN: create the ten `catalog/rules/<name>.md` files (instruction text only, short, global) and modify `catalog/catalog.json`: `items.rules` (10 names) and `recommended.rules` (5 names).
- [ ] 4.3 RED: extend `test/generators.test.ts`: README rules table is in sync (`docs:catalog --check`), website rule pages generated for en and es with usage text; generator check fails when a rule is missing from the table.
- [ ] 4.4 GREEN: modify `scripts/generate-catalog-table.mjs` (rules section, noun, describer) and `scripts/generate-website-catalog.mjs` (`generatedKinds` + `rules`, `renderRule`, `RULE_USAGE` en/es); add `<!-- catalog:rules:start -->` / `<!-- catalog:rules:end -->` markers to `README.md`; run the generators to write the README table and `website/src/content/docs/{en,es}/catalog/rules/*.md` (generated files are excluded from the authored-line count).
- [ ] 4.5 Verify grep checklist items: `rg -n "catalog:agents" README.md scripts` all have a `catalog:rules` twin; `rg -n "\bagents\b" src scripts` generator hits covered.
- [ ] 4.6 REFACTOR + verify: typecheck, lint, format:check, `pnpm test`, `pnpm run docs:catalog --check`, `pnpm run build`.
- [ ] 4.7 Commit work units (e.g. `feat(catalog): add ten seed rules`, `docs(catalog): generate rules tables and website pages`); open PR 4 targeting `feat/rules-3-apply-lifecycle`.

## Phase 5: Slice 5 - CLI and user docs (PR 5, branch `feat/rules-5-cli-user-docs`, base `feat/rules-4-seed-docs-generators`)

Start: data and lifecycle exist. Finish: feature live. Out of scope: checks/severity (#288), `add` command (#289), profiles, `CLAUDE.md`.

- [ ] 5.1 RED: extend `test/adapters/cli/program.test.ts` with a fake prompter (add `selectRules` to every fake prompter via `rg -n "selectAgents" src test`): `init --rules no-secrets --scope project --yes` installs only that rule byte-identical; `--scope user` writes under the sandboxed home `.claude/rules`; `--rules ghost` exits non-zero naming `ghost` and writes nothing; `--rules` alone is a kind flag (no other kind installed); conflict without `--force` exits 2 with nothing written; `--dry-run` prints plan only; interactive conflict skip vs overwrite; `init --yes` without `--rules` installs no rules; `uninstall no-secrets --kind rule`; `list rules`; interactive path calls `selectRules` only when the catalog has rules and skips it when a kind flag is given; hook-decline path treats rules as non-empty. (rules-install / Rule selection; Interactive selection; Conflict protection; item-uninstall / Command surface)
- [ ] 5.2 GREEN: modify `src/ports/prompter.ts` (`ConflictInfo.kind` + `rule`, `selectRules(options: RuleItem[])`) and `src/adapters/cli/program.ts`: `--rules <names>`, `hasKindFlag`, selection (rules asked after agents, before hooks), conflict list + `keep.rule`, `printPlan`, hook-decline empty check, `--kind rule`, `UninstallOptions.kind` -> `OwnedItem['kind']`, `UnknownRuleError` in `guarded`, help texts including the `--source` trust warning "its rules instruct the agent".
- [ ] 5.3 RED: extend `test/adapters/cli/clack-prompter.test.ts` (existing clack mock): `selectRules` passes `initialValues` equal to the recommended names, `required: false`, hint `(recommended)` on recommended items; user can return an empty selection; `CONFLICT_LABELS.rule` is `rule`; `confirm` counts `plan.rules`. (rules-install / Recommended set preselected; User narrows selection)
- [ ] 5.4 GREEN: modify `src/adapters/cli/clack-prompter.ts`: `selectRules` with `initialValues`, `CONFLICT_LABELS.rule`, `confirm` counting `plan.rules`.
- [ ] 5.5 RED: create `test/rules-docs.test.ts` (stable tokens): README contains `--rules`, `--kind rule`, and the downgrade note that manifests containing rule items need a newer version; CONTRIBUTING has "Adding to the catalog: rules" and the nested-YAML-not-validated limit; website en and es `cli/commands.md`, `cli/flags.md`, `catalog/overview.md`, `security.md` mention rules. (rules-install / Manifest backward compatibility - Downgrade documented; catalog / Limit documented)
- [ ] 5.6 GREEN: update `README.md` (`init --rules`, `--kind rule`, kind-list sentences, downgrade note includes rules), `CONTRIBUTING.md` ("Adding to the catalog: rules": frontmatter, reserved `check`/`severity`, quote `paths` globs, 1,500-byte size cap, `recommended.rules`, nested-YAML limit), and `website/src/content/docs/{en,es}/cli/commands.md`, `website/src/content/docs/{en,es}/cli/flags.md`, `website/src/content/docs/{en,es}/catalog/overview.md`, `website/src/content/docs/{en,es}/security.md` (en and es kept in sync; `--source` trust note).
- [ ] 5.7 Grep checklist verification (run from the worktree root, each hit gains a `rule` case or is justified as generic):
  - [ ] 5.7.1 `rg -n "'agent'" src scripts`
  - [ ] 5.7.2 `rg -n "\bagents\b" src scripts`
  - [ ] 5.7.3 `rg -n "Agent(Item|Error|Ownership|sDir|NameSchema)" src`
  - [ ] 5.7.4 `rg -n "selectAgents" src test` (port, clack, program, every fake prompter has `selectRules`)
  - [ ] 5.7.5 `rg -n "isFlatFileKind|FlatFileKind" src`
  - [ ] 5.7.6 `rg -n "plan\.(commands|agents)\.length" src`
  - [ ] 5.7.7 `rg -n "agent-missing" src test website README.md` (add `rule-missing` alongside, including docs)
  - [ ] 5.7.8 `rg -n "commands, agents and hooks|command, agent or hook|--agents" README.md CONTRIBUTING.md website/src src`
  - [ ] 5.7.9 `rg -n "catalog:agents" README.md scripts`
  - [ ] 5.7.10 `rg -n "agents: \[\]" src test` (every `Catalog`/`ChangePlan` literal has `rules: []`)
  - [ ] 5.7.11 `rg -n "ProfileSchema|resolveProfile" src` must show no diff across the whole change (`git diff main -- src | rg ProfileSchema` empty)
  - [ ] 5.7.12 `rg -n "CLAUDE\.md" src` must stay empty
- [ ] 5.8 Manual Claude Code check (non-blocking, resolves the design Open Question; record the observed result in the PR body): in a scratch project run `node dist/main.js init --rules no-secrets --scope project --yes`, start Claude Code there, run `/memory` and confirm `.claude/rules/no-secrets.md` is listed and loaded without error; then add a rule with a quoted `paths:` list and confirm it loads conditionally. If Claude Code rejects or misreads `name`/`description`, stop and raise the fallback decision (metadata only in `catalog.json`) before release.
- [ ] 5.9 Full verification: `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm test` (includes `test/architecture.test.ts`, `test/naming.test.ts`), `pnpm run build`, `pnpm run docs:catalog --check`.
- [ ] 5.10 Commit work units (e.g. `feat(cli): add --rules and rule selection`, `docs: document rules kind`); open PR 5 targeting `feat/rules-4-seed-docs-generators`.

## Spec Coverage Map

| Spec requirement                                                            | Tasks                     |
| --------------------------------------------------------------------------- | ------------------------- |
| catalog / Rule catalog entries                                              | 1.1-1.8                   |
| catalog / Catalog layout and schema                                         | 1.3-1.4, 4.2              |
| catalog / Opt-in nested frontmatter reader                                  | 1.1-1.2, 5.5-5.6          |
| catalog-list / Rules list shape, Kind filter                                | 1.5-1.6, 5.1              |
| rules-install / Rule install roots                                          | 2.3-2.4, 3.1-3.2          |
| rules-install / Plan classification                                         | 2.5-2.6                   |
| rules-install / Conflict, dry-run, backup, stale-file protection            | 3.1-3.2, 5.1-5.2          |
| rules-install / Rule selection                                              | 2.5-2.6, 5.1-5.2          |
| rules-install / Interactive selection and recommended set                   | 1.7-1.8, 4.1-4.2, 5.3-5.4 |
| rules-install / Undo of rules                                               | 3.9                       |
| rules-install / Rule uninstall                                              | 3.7-3.8                   |
| rules-install / Manifest backward compatibility and downgrade note          | 2.1-2.2, 5.5-5.6          |
| rules-install / Seed rules and documentation                                | 4.1-4.4, 5.5-5.6          |
| install-status / Doctor findings, report, item states                       | 3.3-3.6                   |
| item-uninstall / Rule uninstall resolution, Command surface, Kind collision | 3.7-3.8, 5.1-5.2          |

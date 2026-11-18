# Tasks: Add pr-creator Catalog Agent (issue #235)

## Review Workload Forecast

- Estimated changed lines: about 145 to 175 authored (agent file 85-110, test 50-60, catalog.json 1, CONTRIBUTING 1); generated README and website pages excluded.
- 400-line budget risk: Low
- Chained PRs recommended: No
- Suggested split: single PR with two work-unit commits
- Delivery strategy: ask-on-risk
- Chain strategy: none (not needed, under budget)

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

- Unit 1: Goal: tests, agent file, registry entry and CONTRIBUTING sentence (commit `feat(catalog): add pr-creator agent`). Likely PR: PR 1. Focused test command: `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts`. Runtime harness: build, then `node dist/main.js init --agents pr-creator --scope project --dry-run` plans a `create` for the project agent target. Rollback boundary: revert the commit (agent file, one catalog.json line, two tests, one CONTRIBUTING line).
- Unit 2: Goal: generated docs (commit `docs: list pr-creator agent in README and website`). Likely PR: PR 1. Focused test command: `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`. Runtime harness: N/A, generated markdown only, verified by the check scripts. Rollback boundary: revert the docs commit; it is independent of unit 1 at runtime, but the check scripts fail until it lands.

## Phase 1: Setup

- [x] 1.1 Run `pnpm install --frozen-lockfile` in the worktree (no node_modules present). Verify: `pnpm test` runs and the existing suite is green before any change (baseline).

## Phase 2: RED (tests first, strict TDD)

- [x] 2.1 In `test/adapters/catalog/bundled-catalog.test.ts` add test `ships pr-creator as a registered loadable bundled agent`: `index.items.agents` equals `['pr-creator']`; `readdirSync` of the agents directory, dotfiles filtered and sorted, equals `['pr-creator.md']`; `FolderCatalogSource(...).load()` has `issues` equal to `[]`, agent names equal to `['pr-creator']`, description length greater than 0. Spec: Bundled registration and valid agent file.
- [x] 2.2 In the same file add test `keeps the pr-creator agent content contract`, frontmatter part: split frontmatter/body with the regex used by the existing skill contract tests; `name: pr-creator`; a single-line `description:` with no `: ` after the key, no quotes, no `|`; `skills:` followed by one `  - pr-writing` item; one `tools:` line; no block scalars. Specs: Skill declaration, Requirements documented.
- [x] 2.3 Same test, tools part: `tools` split on `,` and trimmed equals, as a sorted set, exactly `Read, Grep, Glob, mcp__github__list_branches, mcp__github__list_commits, mcp__github__get_commit, mcp__github__get_file_contents, mcp__github__list_pull_requests, mcp__github__issue_read, mcp__github__list_label, mcp__github__pull_request_read, mcp__github__create_pull_request, mcp__github__update_pull_request` (10 MCP tools); every MCP entry matches `^mcp__github__[a-z_]+$`; no `Bash`, `Write`, `Edit`, wildcard, merge, branch or file-write tool. Spec: Least-privilege tools. Threat matrix rows: PR commands, Push state, Git repository selection.
- [x] 2.4 Same test, body part: body contains `pr-writing`, `mcp__github__create_pull_request`, `mcp__github__update_pull_request`, `CONFIRMED: create pull request`, `CONFIRMED: update pull request #`, `pushed`, `Not discovered`, `draft: false` default wording, a never-set rule naming `state` and `maintainer_can_modify`, and the gates-unverified wording (must not claim gates passed). Body does not instruct `git` or `gh` commands. Raw text does not match `/shitaku/i` and does not contain `Co-Authored-By`. Specs: Two-step confirmation, Edit mode, No state or maintainer change, Pushed branch required, Gates check, Generic English.
- [x] 2.5 Run `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts` and observe RED: test 1 fails (`items.agents` is `[]`), test 2 fails (`ENOENT` for the agent file). Record the observed failures.

## Phase 3: GREEN (implementation)

- [x] 3.1 Create `catalog/agents/pr-creator.md` using the design "Interfaces / Contracts" contract: frontmatter (`name`, one-line `description`, `tools` allowlist, `skills` YAML list) and body (Requirements, Modes, Draft mode steps with the Decision 6 resolution order written out, Output, Never). Include a gates-check step that reports unverified gates instead of claiming they passed. Keep it generic and English. Verify names against the design "Verification Status Of External Names" sources (github-mcp-server README, Claude Code sub-agents docs) before saving.
- [x] 3.2 In `catalog/catalog.json` change `"agents": []` to `"agents": ["pr-creator"]`. The profiles stay without agents.
- [x] 3.3 Run `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts` and observe GREEN, including the unchanged `loads without issues and resolves profiles` test.
- [x] 3.4 In `CONTRIBUTING.md` (about line 220) replace "The bundled catalog ships no agent yet, so tests use fixtures." with the design sentence naming `pr-creator` as the bundled least-privilege example (combines the `pr-writing` skill with `github` MCP tools; install behavior tests still use fixtures). Keep the tokens guarded by `test/agents-docs.test.ts` intact.
- [x] 3.5 Run the guards `pnpm vitest run test/naming.test.ts test/generators.test.ts test/agents-docs.test.ts test/architecture.test.ts` and confirm they pass (docs guards may fail on generated docs until Phase 4; note which).
- [x] 3.6 Commit 1 (Conventional Commit, no AI attribution, hooks not bypassed): `feat(catalog): add pr-creator agent` with the agent file, `catalog/catalog.json`, the test file and `CONTRIBUTING.md`. Record the commit identity.

## Phase 4: Generated docs

- [x] 4.1 Run `pnpm run docs:catalog` to regenerate the `README.md` agents section (replaces "No agents in the bundled catalog yet" with a `pr-creator` row).
- [x] 4.2 Run `pnpm run docs:website-catalog` to generate `website/src/content/docs/en/catalog/agents/pr-creator.md` and `website/src/content/docs/es/catalog/agents/pr-creator.md`.
- [x] 4.3 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass.
- [x] 4.4 Commit 2: `docs: list pr-creator agent in README and website` with the generated files. Record the commit identity.

## Phase 5: Verification

- [x] 5.1 Run the full suite `pnpm test`, then `pnpm run typecheck`, `pnpm run lint` and `pnpm run format:check`; all must pass. Confirm `src/`, `catalog/skills/pr-writing/SKILL.md` and `catalog/mcps/github.json` are unchanged (`git diff --stat` against main).
- [x] 5.2 Run `pnpm run build`, then the manual smoke check: node dist/main.js init --agents pr-creator --scope project --dry-run in a scratch directory under the session scratchpad (not the real home). Expect a `create` plan for the project agent target and no file, backup or manifest written. Spec: Installable create when absent.
- [ ] 5.3 Optional manual runtime check (not automated, do not create a real PR without user confirmation): invoke the installed agent in draft mode and confirm it returns a draft plus the "Confirmation required" block without calling a write tool.

## Phase 6: PR notes

- [x] 6.1 Prepare PR description notes (do not create any issue): record the divergence from the issue's `tools` frontmatter (explicit least-privilege allowlist with two GitHub write tools instead of `Read, Grep, Glob`), the verified-tool-name sources (github-mcp-server README, Claude Code sub-agents docs, checked 2026-11-18), the residual risk that the `state` / `maintainer_can_modify` ban is instruction-level only, and the labels toolset caveat for `list_label`.
- [x] 6.2 Draft follow-up issue text for the PR description only: "Catalog dependency resolution: installing an agent should be able to pull its required skill (`pr-writing`) and MCP (`github`)". Currently out of scope per the spec ("Requirements documented, not resolved").

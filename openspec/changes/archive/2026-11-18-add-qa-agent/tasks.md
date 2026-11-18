# Tasks: Add qa Catalog Agent (issue #44)

## Review Workload Forecast

| Field                   | Value                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | about 150 to 200 authored (agent file 95-115, bundled-catalog test 45-60, program test 1, catalog.json 1, CONTRIBUTING 1); generated README and website pages excluded |
| 400-line budget risk    | Low                                                                                                                                                                    |
| Chained PRs recommended | No                                                                                                                                                                     |
| Suggested split         | Single PR (`Refs #44`), two work-unit commits (plus the orchestrator-owned `docs(openspec)` commit for the change artifacts)                                           |
| Delivery strategy       | ask-on-risk                                                                                                                                                            |
| Chain strategy          | pending (not needed, under budget)                                                                                                                                     |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                                                            | Likely PR | Focused test command                                                                              | Runtime harness                                                                                                                                            | Rollback boundary                                                                            |
| ---- | ----------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1    | Tests, agent file, registry entry, CONTRIBUTING sentence (commit `feat(catalog): add qa agent`) | PR 1      | `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts test/adapters/cli/program.test.ts` | `pnpm run build`, then `node dist/main.js init --agents qa --scope project --dry-run` in a scratch directory plans a `create` for `./.claude/agents/qa.md` | Revert the commit (agent file, one catalog.json line, test edits, one CONTRIBUTING sentence) |
| 2    | Generated docs (commit `docs: list qa agent in README and website`)                             | PR 1      | `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`                           | N/A, generated markdown only, verified by the check scripts                                                                                                | Revert the docs commit; the check scripts fail until it lands                                |

## Spec vs design notes (no blocking mismatch)

| #   | Observation                                                                                                                                            | Resolution                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| N1  | Spec verdict is "pass or failed gate"; design uses `fail` and `static review passed` (never `pass` alone).                                             | Design wording is a refinement of the spec (verdict never implies runtime verification). Implement the design wording.      |
| N2  | Spec Description requirement lists "edge cases" and "may write test files"; design description says "untested edge cases" and "edits only test files". | Design description satisfies the intent; the content test pins `missing tests` and `never claims a check it could not run`. |
| N3  | Design report adds a `Not reviewed` section beyond the spec's five parts.                                                                              | Superset of the spec; keep it.                                                                                              |

## Phase 1: Baseline and Playwright tool verification

- [x] 1.1 Baseline: run `pnpm install --frozen-lockfile` if `node_modules` is absent, then `pnpm test`; the suite must be green before any change. Result: baseline 67 files, 1958 tests green.
- [x] 1.2 Verify the nine Playwright tool names against the current `microsoft/playwright-mcp` README (use context7 or WebFetch; `npx @playwright/mcp@latest --help` only if authorized): `browser_navigate`, `browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`, `browser_resize`, `browser_click`, `browser_type`, `browser_wait_for`, `browser_close`. Also confirm `browser_evaluate`, `browser_run_code`, `browser_file_upload` and `browser_install` still exist as separate tools and stay excluded. If any name differs, update the same name in BOTH the `tools:` line of `catalog/agents/qa.md` (task 3.1) and the `playwrightTools` array in the content test (task 2.2) before continuing; the design is otherwise unchanged. Record the verification source and result in the apply progress. This task MUST be completed before task 2.2 and task 3.1. Spec: Least-privilege tools with optional Playwright allowlist. Result: verified by the orchestrator against the current microsoft/playwright-mcp README; all nine names exist exactly; `browser_evaluate` and `browser_file_upload` exist (excluded); `browser_run_code` no longer exists and is now `browser_run_code_unsafe` (added to the forbidden list in the contract test, `^mcp__playwright__[a-z_]+$` allowlist kept); `browser_install` is absent from the README (kept forbidden anyway). Wording delta: design Decision 1 and the spec forbidden list name `browser_run_code`; the implementation forbids both `browser_run_code` and `browser_run_code_unsafe`. No agent-file change.

## Phase 2: RED (tests first, strict TDD, `pnpm test`)

- [x] 2.1 In `test/adapters/catalog/bundled-catalog.test.ts`, update `ships the bundled agents as registered loadable agents` (design lines 312, 317, 321): `index.items.agents` equals `['pr-creator', 'qa', 'socratic-challenger']`; sorted `catalog/agents/` entries equal `['pr-creator.md', 'qa.md', 'socratic-challenger.md']`; `catalog.agents.map((a) => a.name)` equals `['pr-creator', 'qa', 'socratic-challenger']`; `catalog.issues` stays `[]`. Spec: Bundled registration and valid agent file (Bundled load succeeds).
- [x] 2.2 Same file, add `keeps the qa agent content contract` after `keeps the socratic-challenger agent content contract`, using the same split regex. Frontmatter: exactly 3 non-empty lines; `lines[0]` is `name: qa`; one-line non-empty `description` not matching `/: |['"|]/` and containing `missing tests` and `never claims a check it could not run`; no `skills:` line; one `tools:` line; no block scalar (`/[>|]\s*$/m`). Tools: sorted split equals `['Edit', 'Glob', 'Grep', 'Read', 'Write', ...nine mcp__playwright__ names]` (names as confirmed in task 1.2); every `mcp__` entry matches `^mcp__playwright__[a-z_]+$`; tools line contains none of `Bash`, `*`, `browser_evaluate`, `browser_run_code`, `browser_file_upload`, `browser_install`. Body contains each of the 17 pinned tokens from design ("Pinned body tokens", including `mcp__playwright__<tool>`). Raw text does not match `/shitaku/i` and does not contain `Co-Authored-By`. Specs: Description is a plain single-line scalar, Least-privilege tools, No skills dependency, Requirements section with stop-and-ask, Missing tests fail the gate, Failing reproduction test, Write and Edit only for test files, Honest not-run reporting, Optional Playwright regression check, Never section, Generic English content.
- [x] 2.3 In `test/adapters/cli/program.test.ts`, test `lists the bundled catalog with a header per kind` (after line 1587), add `expect(out).toContainEqual(expect.stringMatching(/^ {2}qa\s+\S/));`. Spec: Bundled load succeeds.
- [x] 2.4 Run `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts test/adapters/cli/program.test.ts` and observe RED: registry test fails (still `['pr-creator', 'socratic-challenger']`), content test fails with `ENOENT`, list test fails (no `qa` line). Record the observed failures. Result: RED observed, 3 failed (registry arrays, qa content test ENOENT on qa.md, list test missing `qa` line), 222 passed.

## Phase 3: GREEN (implementation)

- [x] 3.1 Create `catalog/agents/qa.md` from the design "Agent file contract" (frontmatter exact: `name: qa`, the one-line description, one `tools:` line with `Read, Grep, Glob, Write, Edit` plus the nine verified Playwright names; no `skills:`). Keep every pinned token verbatim, no line equal to `---` in the body, no project name, no attribution. Spec: all agent-file requirements.
- [x] 3.2 In `catalog/catalog.json` change `"agents": ["pr-creator", "socratic-challenger"]` to `"agents": ["pr-creator", "qa", "socratic-challenger"]`. Profiles and `catalog/mcps/` stay unchanged; `qa` is not added to any profile.
- [x] 3.3 Run `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts test/adapters/cli/program.test.ts` and observe GREEN. If Prettier normalizes the agent file, confirm the pinned tokens still match. Result: GREEN, 2 files, 225 tests passed.
- [x] 3.4 In `CONTRIBUTING.md` (line 221) replace the two-agent sentence with the design wording: "The bundled catalog ships three agents: `pr-creator` ...; `qa`, which reviews changes for missing tests and regressions, writes only test files and can use optional `playwright` MCP tools; and `socratic-challenger` ... Install behavior tests still use fixtures." Do not add `--kind agent`; keep the tokens guarded by `test/agents-docs.test.ts` intact. Spec: CONTRIBUTING updated.
- [x] 3.5 Run guards `pnpm vitest run test/naming.test.ts test/generators.test.ts test/agents-docs.test.ts test/architecture.test.ts`; note any docs guard that fails until Phase 4. Result: 4 files, 94 tests passed; no docs guard failed.
- [x] 3.6 Commit 1 (Conventional Commit, no AI attribution, hooks not bypassed): `feat(catalog): add qa agent` with `catalog/agents/qa.md`, `catalog/catalog.json`, both test files and `CONTRIBUTING.md`. Record the commit identity. Commit e71de09.

## Phase 4: Generated docs (commit 2)

- [x] 4.1 Run `pnpm run docs:catalog` to add the `qa` row to the `README.md` agents table.
- [x] 4.2 Run `pnpm run docs:website-catalog` to generate `website/src/content/docs/en/catalog/agents/qa.md` and `website/src/content/docs/es/catalog/agents/qa.md`.
- [x] 4.3 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass. Spec: Generated docs in sync.
- [x] 4.4 Commit 2: `docs: list qa agent in README and website` with the generated files. Record the commit identity. Commit e256c40.

## Phase 5: Verification

- [x] 5.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`; all must pass. Result: test 67 files / 1959 tests pass; typecheck and lint pass; format:check passes after Prettier-formatting the untracked openspec artifacts.
- [x] 5.2 Confirm no `src/`, `catalog/skills/`, `catalog/profiles/` or `catalog/mcps/` change: `git diff --stat main...HEAD -- src catalog/skills catalog/profiles catalog/mcps` is empty. Spec: Catalog-only surface. Result: `git diff --stat HEAD~2 HEAD -- src catalog/skills catalog/profiles catalog/mcps` is empty (local `main` is stale, so `main...HEAD` shows unrelated upstream changes).
- [x] 5.3 Run `pnpm run build`, then in a scratch directory under the session scratchpad (not the real home) run `node dist/main.js init --agents qa --scope project --dry-run`. Expect a `create` plan for `./.claude/agents/qa.md` and no file, backup or manifest written. Spec: Installable create when absent. Result: build ok; dry-run in a scratch dir printed `qa: create` for `./.claude/agents/qa.md` and wrote nothing.
- [ ] 5.4 (Optional manual runtime check, not automated) In a scratch project with the `playwright` MCP installed, run `/agents` or invoke `qa` and confirm the nine Playwright tools are granted; invoke without a change and expect a stop-and-ask with no file written.

## Phase 6: PR notes

- [x] 6.1 Prepare PR description notes: `Refs #44` (not `Closes`); deferred follow-ups (test-map and impact-radius scripts, `shitaku new` QA phase with retry rule, router integration #244, snapshot-baseline infrastructure, profile inclusion #285, running tests from the agent, hard enforcement of the test-files-only rule); the residual risk that the test-files-only write rule is instruction-level; the Playwright tool-name verification result from task 1.2. Notes below.

### PR description notes (task 6.1)

- Use `Refs #44`, not `Closes`.
- Deferred follow-ups: test-map and impact-radius scripts, `shitaku new` QA phase with retry rule, router integration (#244), snapshot-baseline infrastructure, profile inclusion (#285), running tests from the agent, hard enforcement of the test-files-only rule.
- Residual risk: the test-files-only write rule is instruction-level (tools are granted per tool, not per path).
- Playwright tool-name verification: see task 1.2 (all nine names confirmed; `browser_run_code` is now `browser_run_code_unsafe`, forbidden in the contract test).
- Commits: e71de09 `feat(catalog): add qa agent`, e256c40 `docs: list qa agent in README and website`.

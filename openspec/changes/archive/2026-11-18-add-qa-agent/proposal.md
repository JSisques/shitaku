# Proposal: Add qa Catalog Agent (issue #44)

## Intent

The catalog ships two agents (`pr-creator`, `socratic-challenger`) but no quality-assurance reviewer. Issue #44 asks for a QA agent that checks changes for missing tests, edge cases and behavioural regressions, writes a test for every bug it finds, and treats missing tests as a failed gate. Most of the issue's acceptance criteria assume infrastructure that does not exist (test-map and impact-radius scripts, a `shitaku new` phase with a retry rule, a router, snapshot baselines). This change delivers the part that is realistic as a single catalog agent file and records the rest as explicit follow-ups, so users get a ready-made `qa` sub-agent now without the agent pretending to run gates it cannot run.

## Scope

### In Scope

- `catalog/agents/qa.md`:
  - Single-line `name: qa` and a single-line plain-scalar `description` (no `: `, no quotes) stating that it reviews changes for missing tests, edge cases and regressions, may write test files, and never claims a check it could not run.
  - Frontmatter `tools:` one comma-separated line: `Read, Grep, Glob, Write, Edit` plus an optional allowlist of `mcp__playwright__*` tools (exact names fixed in design, see Approach). No `Bash`, no `*`, no other `mcp__` namespace.
  - No `skills:` key (no QA skill exists in the catalog and none is added), so the frontmatter has 3 lines instead of the 5 used by the two existing agents.
  - Generic English body; no repository-specific names, no project name, no attribution.
- Body behavior (instruction-level):
  - `## Requirements`: what the caller must provide (the change under review: files, diff description or paths); if nothing reviewable is given, stop and ask.
  - Review the change with Read/Grep/Glob: locate related tests by heuristic (mirrored test paths, files importing the changed modules), list missing tests and untested edge cases (empty, boundary, error, concurrency, platform paths) and likely regressions.
  - Missing tests for changed behavior are a failed gate in the verdict.
  - For every confirmed bug, write a failing test that reproduces it. Write/Edit only test files (new test files or additions to existing test files); never edit source, configuration, specs or non-test files; never fix the bug.
  - No Bash: the agent cannot run tests, builds or linters. It reports every such check as `not run`, names the command the caller should run, and never states that a test passes or fails unless the caller supplied that output.
  - Behavioural regression via Playwright is optional: use the Playwright tools only when they are available and the change has a runnable UI the caller points to; otherwise report the browser check as `unavailable`. Snapshot baselines are instruction-level only (compare against a baseline the caller provides; never invent one).
  - Output section: a structured QA report (verdict, findings with file locations, tests written, checks not run with the command to run them, unavailable checks).
  - `## Never`: never claim a gate it could not run, never edit non-test files, never fix bugs, never invent test output.
- Register `qa` in `catalog/catalog.json` -> `items.agents` (becomes `["pr-creator", "qa", "socratic-challenger"]`, ordering confirmed against the loader in design).
- Tests first (strict TDD, `pnpm test`) in `test/adapters/catalog/bundled-catalog.test.ts`:
  - Update the three hard-coded agent arrays (registry, `catalog/agents/` entries, loaded names).
  - Add a `qa` content-contract test: frontmatter line count and name, single-line plain description, exact `tools` set, every `mcp__` entry matches `^mcp__playwright__[a-z_]+$`, forbidden `Bash`, `*` and code-execution Playwright tools, no `skills:` line, required body phrases (not-run reporting, test-files-only writes, failing test per bug, missing tests fail the gate, Playwright unavailable reporting, never claim a gate), no `shitaku` and no `Co-Authored-By`.
  - Verify `test/adapters/cli/program.test.ts` (list output) still passes; update only if a hard-coded list breaks.
- `CONTRIBUTING.md` agents section (line 221): reword "ships two agents" to cover three (guarded by `test/agents-docs.test.ts`).
- Regenerate docs: `pnpm run docs:catalog` (README) and `pnpm run docs:website-catalog` (website en/es); verify with the `:check` variants.

### Out of Scope (deferred, documented as follow-ups; PR uses `Refs #44`, not `Closes`)

- Test-map and impact-radius scripts (the agent uses a path/import heuristic instead).
- A `shitaku new` QA phase and the 3-retry rule.
- Router integration (#244).
- Real snapshot-baseline infrastructure.
- A dedicated QA skill, any script, any `src/` change.
- Running tests from the agent (`Bash`), by user decision.
- Adding the agent to any profile (#285).
- Auto-installing the Playwright MCP with the agent (documented as optional only).
- Hard enforcement of the test-files-only write rule (Claude Code allowlists grant whole tools, not paths).

## Capabilities

### New Capabilities

- `qa-agent`: catalog-bundled `qa` agent content (frontmatter, least-privilege tools without Bash, optional namespaced Playwright tools, review of missing tests, edge cases and regressions, failing test per confirmed bug, test-files-only writes, honest not-run and unavailable gate reporting, structured QA report) and installability acceptance.

### Modified Capabilities

None. Install, list and validation behavior stay under the existing `catalog` and `agents-install` specs; the CONTRIBUTING sentence is documentation only. `pr-creator-agent` and `socratic-challenger-agent` requirements are unchanged.

## Approach

Content only, mirroring the archived `add-socratic-challenger-agent` change: one agent file, one registry entry, tests first, regenerated docs, one CONTRIBUTING sentence, no code. `parseAgent` already passes `tools` through and does not require `skills`.

- **Honest gates without Bash**: the agent's verdict separates what it verified statically (missing tests, edge cases, written reproduction tests) from what it could not run (test suite, build, lint, browser). Each unrun check is listed with the command for the caller. This satisfies "never claim a gate it could not run" while keeping the no-Bash least-privilege stance.
- **Test-files-only writes**: instruction-level, like the socratic-challenger Q&A-log rule; asserted by the content-contract test so the wording cannot silently regress.
- **Playwright tools**: the "no stray `mcp__`" pin is per-agent, not global. `socratic-challenger` forbids `mcp__` entirely, while `pr-creator` allows an exact `mcp__github__*` allowlist checked by regex. The `qa` contract test follows the `pr-creator` pattern with an exact `mcp__playwright__*` allowlist, so the existing tests do not conflict. Claude Code names MCP tools `mcp__<server>__<tool>`, and the catalog server key is `playwright`. Recommended subset (to be verified in design against the `@playwright/mcp` tool list): navigation, accessibility snapshot, screenshot, console messages, resize, click, type, wait, close. Exclude code-execution tools (`browser_evaluate`, `browser_run_code`, `browser_run_code_unsafe`) and file upload, by analogy with the no-Bash rule.

Delivery: one PR (`Refs #44`), two Conventional Commits:

1. `feat(catalog): add qa agent` (agent file, catalog.json, tests, CONTRIBUTING sentence).
2. `docs: list qa agent in README and website` (generated pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and docs only.

| Area                                                    | Impact    | Description                                          |
| ------------------------------------------------------- | --------- | ---------------------------------------------------- |
| `catalog/agents/qa.md`                                  | New       | Agent frontmatter and body                           |
| `catalog/catalog.json`                                  | Modified  | `items.agents` gains `qa`                            |
| `test/adapters/catalog/bundled-catalog.test.ts`         | Modified  | Updated agent arrays; new `qa` content-contract test |
| `test/adapters/cli/program.test.ts`                     | Verify    | Only if a hard-coded agent list breaks               |
| `CONTRIBUTING.md`                                       | Modified  | Agents section sentence (line 221)                   |
| `README.md`                                             | Generated | Agents catalog table                                 |
| `website/src/content/docs/{en,es}/catalog/agents/qa.md` | Generated | Website agent pages                                  |
| `src/`, `catalog/skills/`, `catalog/profiles/`          | Unchanged | No code, skill or profile change                     |

## Risks

| Risk                                                                                                       | Likelihood      | Mitigation                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent claims tests pass or fail without running them                                                       | Med             | Explicit not-run reporting rule and `## Never` entry, asserted by the content test; residual risk accepted (instruction, not guarantee)               |
| Playwright tool names drift: the server runs the unpinned `@playwright/mcp@latest`                         | Med             | Verify names in design against current `@playwright/mcp` docs; the agent reports Playwright as unavailable when the tools are absent; small allowlist |
| User installed the Playwright MCP under a different server key, so `mcp__playwright__*` names do not match | Low             | Document that the optional tools assume the catalog `playwright` MCP name                                                                             |
| Playwright tools with side effects (navigation, click, type on arbitrary pages)                            | Med             | Use only on a target the caller points to; exclude code-execution and upload tools                                                                    |
| Write/Edit misused beyond test files                                                                       | Med             | Test-files-only body rule, never fix bugs, content-tested; residual risk accepted                                                                     |
| Issue #44 acceptance criteria only partially met                                                           | High (expected) | `Refs #44`, deferred items listed as follow-ups in the PR and issue                                                                                   |
| Hard-coded agent arrays in tests break                                                                     | High (expected) | Update them first as the RED step                                                                                                                     |
| 3-line frontmatter departs from the 5-line pattern of the existing agents                                  | Low             | Per-agent contract test pins 3 lines; no shared test assumes 5                                                                                        |
| Stale generated README or website docs fail CI                                                             | Low             | Run both docs scripts and their `:check` variants                                                                                                     |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/agents/qa.md`, the `catalog.json` entry, the test changes, the CONTRIBUTING sentence and the generated README and website pages (or rerun the docs scripts after the revert). No `src/`, manifest or migration impact. Users who installed the agent run `shitaku uninstall qa` or `shitaku undo`.

## Dependencies

- Shipped agents capability (specs `catalog` and `agents-install`).
- Existing `playwright` MCP catalog item (optional runtime capability for users, not a build dependency).

## Success Criteria

- [ ] Updated and new `bundled-catalog.test.ts` agent tests observed RED, then GREEN; the catalog loads with no issues and `catalog.agents` includes `qa`.
- [ ] `pnpm run build` then `node dist/main.js init --agents qa --scope project --dry-run` plans a `create` for `./.claude/agents/qa.md`.
- [ ] Frontmatter: `name: qa`, single-line plain description, `tools` equals `Read, Grep, Glob, Write, Edit` plus the agreed `mcp__playwright__*` subset; no `Bash`, `*`, code-execution tools or `skills:`.
- [ ] Body: Requirements stop-and-ask rule, missing tests fail the gate, failing test per confirmed bug, test-files-only writes, not-run reporting with the command to run, Playwright unavailable reporting, structured QA report, `## Never` section; no `shitaku` and no `Co-Authored-By`.
- [ ] CONTRIBUTING agents section is accurate with three bundled agents.
- [ ] `docs:catalog:check` and the website catalog check pass.
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass; no `src/` changes.
- [ ] PR body uses `Refs #44` and lists the deferred follow-ups.

## Review Workload Forecast

Authored lines: agent file ~110-160, catalog entry ~1, tests ~45-65 (including the three updated arrays), CONTRIBUTING ~2; total ~160-230 (generated README and website pages excluded). Single PR, two commits.

Decision needed before apply: No (Playwright tool subset is a design-phase verification, not a product decision)
Chained PRs recommended: No
400-line budget risk: Low

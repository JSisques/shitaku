# Verify Report: add-qa-agent

Verdict: PASS. CRITICAL 0, WARNING 0, SUGGESTION 2 (one is the known wording delta).

## Execution (actual results, worktree HEAD e256c40)

| Gate                       | Result                                    |
| -------------------------- | ----------------------------------------- |
| typecheck                  | pass                                      |
| lint                       | pass                                      |
| format:check               | pass                                      |
| test                       | 67 files, 1959 tests passed               |
| build                      | pass (check-dist-aliases: 63 files clean) |
| docs:catalog:check         | up to date                                |
| docs:website-catalog:check | up to date                                |

Strict TDD: apply-progress records baseline 1958 green, RED 3 failed/222 passed, GREEN 225 passed, full 1959 passed. The final run reproduces 1959.

## Spec compliance

All 15 requirements and their scenarios are covered by `catalog/agents/qa.md`, `catalog/catalog.json` and the `keeps the qa agent content contract` test: registration, 3-line frontmatter, plain description, exact tools (Read, Grep, Glob, Write, Edit plus nine playwright tools, no Bash), no skills key, stop-and-ask, gate, failing repro test, test-only writes, honest not-run, optional Playwright, report sections, Never section, generic content, install create, catalog-only surface (no diff in src, skills, profiles, mcps), synced docs, CONTRIBUTING updated.

Tasks: all checked except 5.4 (optional manual runtime check, not automated).

## Findings

### SUGGESTION 1: stale tool name in spec

`openspec/changes/add-qa-agent/specs/qa-agent/spec.md:48` names `mcp__playwright__browser_run_code`; the tool is now `browser_run_code_unsafe`. Fix: list both `browser_run_code` and `browser_run_code_unsafe`, matching the test (`test/adapters/catalog/bundled-catalog.test.ts:490-491`).

### SUGGESTION 2: stale tool name in design

`openspec/changes/add-qa-agent/design.md:21` and `:281` (and `proposal.md:61`) use `browser_run_code` only. Fix: add `browser_run_code_unsafe` to the excluded list and the forbidden array snippet. No code change is needed.

### Note

Optional task 5.4 (manual runtime check) remains unexecuted; not a blocker.

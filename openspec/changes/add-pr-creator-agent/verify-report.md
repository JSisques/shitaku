# Verify Report: add-pr-creator-agent

Mode: Strict TDD. Verdict: PASS with 0 CRITICAL, 2 WARNING, 2 SUGGESTION.

## Execution evidence

- pnpm test: 59 files, 1463 tests passed.
- typecheck, lint, format:check, build (58 dist files clean), docs:catalog:check, docs:website-catalog:check: all pass.
- Diff vs main: 13 files, 833 insertions, 11 deletions. Excluding openspec docs and generated README/website: about 150 authored lines (agent 48, tests 86 + 14, CONTRIBUTING 1, catalog.json 1), under the 400 budget. No src/, pr-writing SKILL.md or github.json changes.
- Commits: 4, all Conventional, no AI attribution, body lines under 100 characters.

## Spec compliance

- Bundled registration and valid file: COMPLIANT (test 1 asserts items.agents, directory listing, no issues, description).
- Least-privilege tools: COMPLIANT (Read, Grep, Glob + exactly 10 mcp__github__ tools; no Bash, Write, Edit; only create and update write tools).
- Skill declaration: COMPLIANT (skills list is pr-writing).
- Context without Bash: COMPLIANT (steps 1-4 use Read, Glob, Grep and MCP reads; caller diff accepted).
- Gates check: COMPLIANT (step 6, "unverified" asserted).
- Draft follows pr-writing: COMPLIANT (delegated to the skill; Not discovered, no invention rules).
- Two-step confirmation: COMPLIANT (create mode, literal line, draft: false default).
- Edit mode: COMPLIANT (pull_request_read, literal update line, draft only on explicit request).
- No state or maintainer change: COMPLIANT (Never section, close/reopen refused).
- Pushed branch required: PARTIAL, see WARNING 1.
- Requirements documented: COMPLIANT (description and Requirements section).
- Generic concise English: COMPLIANT (no /shitaku/i, test enforced).
- Installable create when absent: COMPLIANT (runtime smoke recorded in apply-progress; no src change; existing agents-install tests cover byte-identity). Dry-run was not re-run here.
- Catalog-only surface with synced docs: COMPLIANT (CONTRIBUTING updated, README and website en/es present, check scripts pass).
- Frontmatter rejects mismatched identity: COMPLIANT via existing parseAgent tests (not new in this change).

## Frontmatter validity

Parsed by line: name pr-creator, single-line description with no ': ' or quotes, comma-separated tools, skills as one YAML list item. Valid.

## Tasks

All tasks checked except optional 5.3 (manual runtime check), which is not a gate.

## TDD evidence

RED recorded in apply-progress (items.agents [] and ENOENT), GREEN 10/10, full suite 1463. Tests are behavior-meaningful for the contract (exact tool set, forbidden tools, literal strings) but the body checks are string-presence and cannot prove runtime behavior.

## Findings

WARNING 1: catalog/agents/pr-creator.md:22 (Create mode). The remote-existence check of the head branch lives only in draft step 1 (line 27). A confirmed create invocation is independent and could call create_pull_request without verifying the branch is pushed, weakening the "Pushed branch required" scenario. Fix: append to line 22 "Before calling it, confirm the head exists on the remote with `mcp__github__list_branches`; if not, do not create and ask the caller to push."

WARNING 2: test/adapters/catalog/bundled-catalog.test.ts:285-297. Body assertions do not cover the draft-flag-unchanged-in-edit rule ("Change `draft` only if"), the "not supported" refusal for close/reopen, or the stop when the pushed branch is missing. Fix: add the strings `Change \`draft\` only if`and`not supported` to the required list.

SUGGESTION 1: catalog/agents/pr-creator.md:23. The spec lists reviewers among editable fields, but update_pull_request does not set reviewers and the body says nothing about it. Clarify that reviewers are only suggested metadata.

SUGGESTION 2: tasks.md 5.3 remains unchecked. Optionally perform or mark as deferred in PR notes.

Note: test/adapters/cli/program.test.ts changes (agents prompt default, list header) are a necessary consequence of the first bundled agent, not scope creep.

## Resolution

- W1 fixed: create mode now confirms the head exists on the remote before calling `create_pull_request`.
- W2 fixed: the content test now asserts the draft-change rule, the close/reopen refusal and the pushed-head re-check.
- S1 not applied: the GitHub MCP README lists `reviewers` as a parameter of `update_pull_request`, so no clarification is needed.
- S2 deferred: task 5.3 (live runtime check) stays manual and is noted in the PR description.

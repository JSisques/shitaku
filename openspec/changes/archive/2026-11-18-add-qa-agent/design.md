# Design: Add qa Catalog Agent (issue #44)

## Technical Approach

Data-only change that mirrors the archived `add-socratic-challenger-agent` change: one new catalog file (`catalog/agents/qa.md`), one registry entry (`catalog/catalog.json` -> `items.agents`), tests first in `test/adapters/catalog/bundled-catalog.test.ts` plus one list assertion in `test/adapters/cli/program.test.ts`, one CONTRIBUTING sentence, and generated README and website pages. No `src/` change: `parseAgent` (`src/domain/catalog/agent.ts`) validates only `name`, `description` and a non-empty body; `tools` passes through and `skills` is not required. The installer copies the file verbatim to `./.claude/agents/qa.md` or `~/.claude/agents/qa.md`.

The agent is a least-privilege Claude Code subagent that reviews a change statically. It has `Read`, `Grep`, `Glob` to find the changed code and its tests, `Write` and `Edit` only to add test files or test cases, and an optional exact allowlist of nine `mcp__playwright__*` tools for a behavioural check against a running UI the caller points to. It has no `Bash`, so it can never run tests, builds or linters; its report lists every such check as `not run` with the command the caller should run. It has no `skills` key because the catalog ships no QA skill.

Settled user decisions (Engram `sdd/add-qa-agent/product-decisions`): name `qa`; agent only (no skill, no script); tools `Read, Grep, Glob, Write, Edit` with no `Bash`; Playwright optional; the agent may write tests; PR uses `Refs #44` with deferred follow-ups.

## Architecture Decisions

### Decision 1: Tool allowlist `Read, Grep, Glob, Write, Edit` plus nine Playwright tools

**Choice**: one `tools:` line, exact set:

```text
Read, Grep, Glob, Write, Edit, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_console_messages, mcp__playwright__browser_resize, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_close
```

Excluded on purpose: `Bash`, `NotebookEdit`, `WebFetch`, `WebSearch`, the `*` wildcard, any non-`playwright` MCP namespace, and these Playwright tools: `browser_evaluate`, `browser_run_code` and `browser_run_code_unsafe` (arbitrary JavaScript in the page, the browser equivalent of `Bash`), `browser_file_upload` (sends local files to a page), `browser_install` (installs a browser binary), `browser_handle_dialog`, `browser_fill_form`, `browser_select_option`, `browser_drag`, `browser_hover`, `browser_press_key`, `browser_navigate_back`, `browser_tabs`, `browser_network_requests`, `browser_pdf_save` and the opt-in capability tools (vision coordinates, tracing, verification).

**Alternatives considered**: no Playwright tools (loses the issue's behavioural-regression check entirely); all Playwright tools through a server-level wildcard (grants code execution and file upload); adding `browser_press_key`, `browser_fill_form` and `browser_select_option` for richer interaction (more side-effect surface for a reviewer; `browser_type` with `submit` covers the common form case); adding `browser_network_requests` (useful, but not needed for the issue's regression check; easy follow-up).

**Rationale**: the nine tools cover the issue's behavioural check: open the page (`navigate`), read structure (`snapshot`), capture evidence (`take_screenshot`, `console_messages`), test responsive layouts (`resize`), exercise a flow (`click`, `type`, `wait_for`) and clean up (`close`). Claude Code names MCP tools `mcp__<server>__<tool>` and the catalog server key is `playwright` (`catalog/mcps/playwright.json`), which also matches the server description ("accessibility snapshots, screenshots, console messages and viewport resizing"). Excluding code execution mirrors the no-`Bash` rule. Tool names follow the `@playwright/mcp` core tool set (`browser_` prefix, `browser_take_screenshot` not `browser_screenshot`, `browser_wait_for` not `browser_wait`); see Open Questions for the apply-time verification.

### Decision 2: No `skills:` key, three frontmatter lines

**Choice**: frontmatter is exactly `name`, `description`, `tools` (3 non-empty lines). The body carries the review method itself.

**Alternatives considered**: create a `qa` skill and preload it like `pr-creator`/`socratic-challenger` (out of scope by user decision; more surface); reference an existing skill (none covers QA review; the `tests-for-changes` rule is a rule, not a skill, and is not guaranteed installed).

**Rationale**: `parseAgent` does not require `skills`; per-agent contract tests pin frontmatter line counts, so no shared test assumes 5 lines. A `## Requirements` section still exists, but it covers the caller's input instead of a skill.

### Decision 3: Honest gates without Bash

**Choice**: the report separates what the agent verified statically from what it could not run. Every runtime check (test suite, the tests it wrote, build, typecheck, lint, browser check when Playwright is unavailable) appears under `Not run` with the command the caller should run. The agent finds commands by reading project files (`package.json` scripts, `Makefile`, `CONTRIBUTING.md`, CI workflow files); if it finds none it writes `command unknown`. It never states that a test passes or fails unless the caller supplied that output in the request, and then it quotes the source.

Verdict values: `fail` when there is at least one missing test for changed behavior or one confirmed bug; otherwise `static review passed`. The word `pass` is never used alone, because the agent never ran anything.

**Alternatives considered**: grant `Bash` to run tests (rejected by user decision; least privilege); a plain `pass`/`fail` verdict (implies runtime verification it did not perform); omitting commands (forces the caller to rediscover them).

**Rationale**: satisfies the issue's "never claim a gate it could not run" while staying read-mostly. The `static review passed` wording makes the scope of the verdict impossible to misread.

### Decision 4: Missing tests are a failed gate

**Choice**: any changed behavior (new or modified function, branch, error path, public output) with no test that exercises it is a finding of kind `missing test`, and any such finding sets the verdict to `fail`. The agent locates related tests heuristically: mirrored test paths (`src/a/b.ts` -> `test/a/b.test.ts`, `__tests__/b.test.ts`, `b.spec.ts`, `b_test.go` and similar), test files that import or reference the changed module (`Grep` on the module name), and tests that mention changed exported names. When the heuristic finds nothing it says so; it does not claim coverage it could not locate.

**Alternatives considered**: test-map and impact-radius scripts (no infrastructure; deferred follow-up); treating missing tests as a warning (contradicts the issue).

**Rationale**: matches issue #44 and the catalog's `tests-for-changes` rule, with an honest heuristic instead of nonexistent tooling.

### Decision 5: Write and Edit only for test files; a failing test per confirmed bug

**Choice**:

- A confirmed bug is one the agent can show from the code (input, path, and the wrong result or crash), not a suspicion. Suspicions are reported as `regression risk` findings and get no test.
- For every confirmed bug, write one failing test that reproduces it, following the project's existing test framework, file layout and naming. Name the test after the expected behavior.
- Test files only: paths under a test directory (`test/`, `tests/`, `__tests__/`, `spec/`) or file names containing `.test.`, `.spec.` or ending in `_test` before the extension, following what the project already uses. If the right test location is unclear, write nothing and include the proposed test in the report.
- New test files are created with `Write`. Existing test files are changed only with `Edit` to add cases; never remove or weaken existing tests and never use `Write` on an existing file.
- Never edit source, configuration, fixtures shared with non-test code, specs, docs or any other non-test file. Never fix the bug.
- Optionally (same rule) add tests for missing coverage when the caller asks; otherwise list them as missing tests.

**Alternatives considered**: report-only (the issue requires a test per bug); allow fixing bugs (turns a reviewer into an implementer and hides the failing test); `Write` for everything (risk of overwriting a test file).

**Rationale**: the failing test is the bug's evidence and the caller's regression guard. Claude Code allowlists grant whole tools, not paths, so the rule is instruction-level, exactly like the socratic-challenger Q&A-log rule, and the wording is pinned by the content test.

### Decision 6: Playwright is optional and scoped to the caller's target

**Choice**: use the Playwright tools only when (a) they are available in the session and (b) the caller gives the URL of a running app and the flow or pages to check. The agent cannot start the app. It stays on the origin the caller gave and does not navigate to other sites. It never enters real credentials or personal data; it uses only test data the caller supplies. If the tools are absent, or no URL is given, or the page does not load, the browser check is reported as `unavailable` with the reason. Snapshot baselines are instruction-level: compare against a baseline snapshot or screenshot the caller provides; with no baseline, report the comparison as `unavailable` and never invent one. The `## Requirements` section states that the optional tools assume the MCP server is registered under the key `playwright`.

**Alternatives considered**: always attempt a browser check (fails noisily without a running app); bundle the Playwright MCP with the agent (out of scope; no agent-to-MCP dependency mechanism).

**Rationale**: delivers the behavioural part of #44 where possible and reports honestly where not.

### Decision 7: Requirements and turn model

**Choice**: `## Requirements` asks for the change under review (changed file paths, a diff, or a description plus paths) and optionally test output, a running app URL, baselines. If nothing reviewable is given, stop and ask for it, and write nothing. Every invocation is independent; the agent remembers nothing from an earlier one.

**Alternatives considered**: discover the change from `git` (no `Bash`; reading `.git` objects is unreliable); review the whole repository when no change is given (unbounded, noisy).

**Rationale**: same independence statement and stop-and-ask pattern as the existing agents.

### Decision 8: Single-line plain-scalar description

**Choice**: `description: Reviews a change for missing tests, untested edge cases and likely regressions, writes a failing test for each confirmed bug, edits only test files and never claims a check it could not run.` One line, no `: `, no quotes, no `|` or `>`.

**Alternatives considered**: folded block scalar (accepted by the loader, but inconsistent with the other agents and their tests).

**Rationale**: consistent with `pr-creator` and `socratic-challenger`; readable in `shitaku list` and the generated tables.

### Decision 9: Registry order `["pr-creator", "qa", "socratic-challenger"]`

**Choice**: insert `qa` alphabetically.

**Rationale**: `FolderCatalogSource.loadFileItems` (`src/adapters/catalog/folder-source.ts`) iterates the listed names in order, so `catalog.agents` names follow `catalog.json`. Alphabetical order makes the registry array, the sorted directory listing and the loaded names all equal the same sequence, which keeps the three test arrays aligned.

## Data Flow

```text
caller -- change (paths/diff/description) [+ test output, app URL, baseline] --> qa
                                   |  nothing reviewable? -> stop and ask, write nothing
                                   |  Read/Grep/Glob: changed code, related tests (heuristic),
                                   |                  project commands (package.json, Makefile, CI)
                                   |  findings: missing test | edge case | regression risk | confirmed bug
                                   |  confirmed bug -> Write (new test file) or Edit (add case)  [test files only]
                                   |  Playwright tools available AND URL given?
                                   |     yes -> navigate/snapshot/screenshot/console/... on that origin
                                   |     no  -> browser check: unavailable (reason)
                                   v
caller <-- QA report: verdict, findings, tests written, not run (+commands), unavailable, not reviewed -- (stop)
   |
   |  caller runs the listed commands, fixes bugs
   v
caller -- updated change + test output --> qa (next independent invocation)
```

Install path (unchanged code): `catalog/agents/qa.md` -> `FolderCatalogSource` -> `parseAgent` -> flat copy to `./.claude/agents/qa.md` (project) or `~/.claude/agents/qa.md` (user).

## File Changes

| File                                                            | Action    | Description                                                                                                               |
| --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `catalog/agents/qa.md`                                          | Create    | Agent frontmatter and body (contract below)                                                                               |
| `catalog/catalog.json`                                          | Modify    | `"agents": ["pr-creator", "socratic-challenger"]` becomes `"agents": ["pr-creator", "qa", "socratic-challenger"]`         |
| `test/adapters/catalog/bundled-catalog.test.ts`                 | Modify    | Update the three agent arrays (lines 312, 317, 321); add the `qa` content-contract test after the socratic-challenger one |
| `test/adapters/cli/program.test.ts`                             | Modify    | One `toContainEqual` line for `qa` in `lists the bundled catalog with a header per kind` (after line 1587)                |
| `CONTRIBUTING.md`                                               | Modify    | Line 221: bundled-agents sentence (wording below)                                                                         |
| `README.md`                                                     | Generated | `pnpm run docs:catalog` adds the agents table row                                                                         |
| `website/src/content/docs/en/catalog/agents/qa.md`              | Generated | `pnpm run docs:website-catalog`                                                                                           |
| `website/src/content/docs/es/catalog/agents/qa.md`              | Generated | `pnpm run docs:website-catalog`                                                                                           |
| `src/`, `catalog/skills/`, `catalog/profiles/`, `catalog/mcps/` | Unchanged | No code, skill, profile or MCP change                                                                                     |

## Interfaces / Contracts

### Agent file contract

The frontmatter is exact. Apply may reword body sentences, but the pinned tokens listed after the block must stay verbatim. The body must not contain a line that is exactly `---` (the test splits frontmatter and body on it), must not name this repository or tool, and must not contain `Co-Authored-By`.

```md
---
name: qa
description: Reviews a change for missing tests, untested edge cases and likely regressions, writes a failing test for each confirmed bug, edits only test files and never claims a check it could not run.
tools: Read, Grep, Glob, Write, Edit, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_console_messages, mcp__playwright__browser_resize, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_wait_for, mcp__playwright__browser_close
---

You review a change for quality before it ships: missing tests, untested edge cases and likely behavioural regressions. You write a failing test for every bug you confirm. You cannot run commands, so you never claim a check you could not run.

## Requirements

- The change under review: changed file paths, a diff, or a description together with the paths. If nothing reviewable is given, stop and ask for it, and write nothing.
- Optional: test, build or lint output the caller already has, the URL of a running app with the pages or flow to check, and baseline snapshots or screenshots to compare against.
- Optional browser tools: the Playwright MCP server registered under the key `playwright`, so its tools are named `mcp__playwright__<tool>`. Without them the browser check is unavailable; the rest of the review still runs.

## How you work

Every invocation is independent; you remember nothing from an earlier one.

1. Read the changed files with Read, Grep and Glob. Note every changed behavior: new or modified functions, branches, error paths and public outputs.
2. Find the related tests: mirrored test paths (for example `src/a/b.ts` and `test/a/b.test.ts`, `__tests__/`, `.spec.` files), test files that import or reference the changed module, and tests that mention changed exported names. If you find none, say so; never claim coverage you could not locate.
3. For each changed behavior, check whether a test exercises it. Missing tests for changed behavior fail the gate.
4. Look for untested edge cases: empty and missing input, boundaries and off-by-one, invalid input and error paths, concurrency and ordering, and platform differences such as paths and line endings.
5. Look for likely regressions: callers of changed code, changed defaults, removed branches and changed output formats.
6. Classify each finding as `missing test`, `edge case`, `regression risk` or `confirmed bug`. A bug is confirmed only when you can show the input, the code path and the wrong result. Anything weaker is a `regression risk`.
7. Write a failing test for every confirmed bug (see Writing tests).
8. Run the browser check only when it is available (see Browser check).
9. Find the commands the caller should run in `package.json` scripts, a `Makefile`, `CONTRIBUTING.md` or CI workflow files. If you find none, write `command unknown`.
10. Return the QA report and stop.

## Writing tests

Use Write and Edit only for test files: files under a test directory such as `test/`, `tests/`, `__tests__/` or `spec/`, or files whose names contain `.test.` or `.spec.` or end in `_test`, following what the project already uses.

- Write a failing test that reproduces each confirmed bug, with the project's existing test framework, layout and naming. Name the test after the expected behavior.
- Create a new test file with Write. Add cases to an existing test file with Edit. Never use Write on an existing file, and never remove or weaken an existing test.
- If the right test location is unclear, write nothing and put the proposed test in the report.
- Add tests for missing coverage only when the caller asks; otherwise list them as missing tests.
- You cannot run the tests you write. List each one under Not run with the command to run it.

## Browser check

Use the Playwright tools only when they are available and the caller gave the URL of a running app. You cannot start the app.

- Stay on the origin the caller gave; do not navigate to other sites.
- Use only test data the caller supplied. Never enter real credentials or personal data.
- Use snapshots, screenshots and console messages as evidence; resize the viewport for layout checks; close the browser when you are done.
- Compare against a baseline only when the caller provided one. Never invent a baseline.
- If the tools are missing, no URL was given, no baseline was provided or the page does not load, report that check as `unavailable` with the reason.

## Output

Return a QA report with these sections, then stop:

- Verdict: `fail` when there is at least one missing test or confirmed bug; otherwise `static review passed`. Never write `pass` alone.
- Findings: one line each with kind, `file:line` and what is wrong or missing.
- Tests written: each path, the bug it reproduces and why it should fail now.
- Not run: every check you could not run (test suite, the tests you wrote, build, typecheck, lint), each with the command to run it or `command unknown`. Report a result only if the caller supplied that output, and name it as the caller's.
- Unavailable: browser and baseline checks you could not perform, with the reason.
- Not reviewed: files or areas you skipped and why.

## Never

- Never claim a check you could not run, and never state that a test passes or fails unless the caller supplied that output.
- Never invent test output, coverage, baselines or command results.
- Never edit source, configuration, specs, docs or any other non-test file.
- Never fix the bug; write the failing test and report it.
- Never use Write on an existing file.
```

Pinned body tokens (exact substrings asserted by the content test; the `Not run` section label carries the not-run reporting rule):

```ts
[
  'stop and ask for it, and write nothing',
  'Every invocation is independent',
  'Missing tests for changed behavior fail the gate',
  'never claim coverage you could not locate',
  'Write a failing test that reproduces each confirmed bug',
  'Use Write and Edit only for test files',
  'never remove or weaken an existing test',
  'Not run',
  'command unknown',
  '`unavailable`',
  'Never invent a baseline',
  '`static review passed`',
  'Never claim a check you could not run',
  'Never invent test output',
  'Never edit source, configuration, specs, docs or any other non-test file',
  'Never fix the bug',
  'mcp__playwright__<tool>',
];
```

Note on formatting: run `pnpm run format:check` after writing the file; Prettier may normalize list markers or blank lines, which does not affect the pinned tokens. The outer four-backtick fence above exists only in this design.

### qa content-contract test

Added as `keeps the qa agent content contract`, after `keeps the socratic-challenger agent content contract`, using the same split regex:

```ts
it('keeps the qa agent content contract', () => {
  const raw = readFileSync(join(catalogRoot, 'agents', 'qa.md'), 'utf8');
  const [, frontmatter = '', body = ''] = raw.split(/^---\r?\n|\r?\n---\r?\n/);
  const lines = frontmatter.split(/\r?\n/).filter((line) => line.length > 0);
  expect(lines).toHaveLength(3);
  expect(lines[0]).toBe('name: qa');
  const descriptionLine = lines.find((line) => line.startsWith('description:')) ?? '';
  const description = descriptionLine.slice('description:'.length).trim();
  expect(description.length).toBeGreaterThan(0);
  expect(description).not.toMatch(/: |['"|]/);
  expect(description).toContain('missing tests');
  expect(description).toContain('never claims a check it could not run');
  expect(lines.some((line) => line.startsWith('skills:'))).toBe(false);
  expect(lines.filter((line) => line.startsWith('tools:'))).toHaveLength(1);
  expect(frontmatter).not.toMatch(/[>|]\s*$/m);

  const toolsLine = lines.find((line) => line.startsWith('tools:')) ?? '';
  const tools = toolsLine
    .slice('tools:'.length)
    .split(',')
    .map((tool) => tool.trim());
  const playwrightTools = [
    'browser_navigate',
    'browser_snapshot',
    'browser_take_screenshot',
    'browser_console_messages',
    'browser_resize',
    'browser_click',
    'browser_type',
    'browser_wait_for',
    'browser_close',
  ].map((tool) => `mcp__playwright__${tool}`);
  expect([...tools].sort()).toEqual(['Edit', 'Glob', 'Grep', 'Read', 'Write', ...playwrightTools].sort());
  for (const tool of tools.filter((t) => t.startsWith('mcp__'))) {
    expect(tool).toMatch(/^mcp__playwright__[a-z_]+$/);
  }
  for (const forbidden of [
    'Bash',
    '*',
    'browser_evaluate',
    'browser_run_code',
    'browser_run_code_unsafe',
    'browser_file_upload',
    'browser_install',
  ]) {
    expect(toolsLine).not.toContain(forbidden);
  }

  for (const required of [/* pinned list above */]) {
    expect(body).toContain(required);
  }
  expect(raw).not.toMatch(/shitaku/i);
  expect(raw).not.toContain('Co-Authored-By');
});
```

The exact-set assertion already excludes every other tool; the regex and forbidden list make intent explicit and keep a readable failure if the allowlist drifts. Exact formatting is left to Prettier.

### CONTRIBUTING.md line 221

Replace "The bundled catalog ships two agents: `pr-creator`, a least-privilege example that combines the `pr-writing` skill with `github` MCP tools, and `socratic-challenger`, which applies the `socratic-method` skill and writes only a Q&A log; install behavior tests still use fixtures." with:

"The bundled catalog ships three agents: `pr-creator`, a least-privilege example that combines the `pr-writing` skill with `github` MCP tools; `qa`, which reviews changes for missing tests and regressions, writes only test files and can use optional `playwright` MCP tools; and `socratic-challenger`, which applies the `socratic-method` skill and writes only a Q&A log. Install behavior tests still use fixtures."

The tokens guarded by `test/agents-docs.test.ts` (`block scalar`, `not validated`, `tools or permissions`) are on other lines and are unaffected; the line must not contain `--kind agent`. The following sentence ("Regenerate the README and website tables ...") stays.

## Testing Strategy

Strict TDD with `pnpm test` (Vitest). All test edits come first and are observed RED before the agent file and the registry entry exist.

| Layer                   | What to Test                                                                                                                         | Approach                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Unit (catalog data)     | Registry, folder entries, loadability                                                                                                | Update `ships the bundled agents as registered loadable agents`                       |
| Unit (content contract) | Frontmatter (3 lines, no skills), exact tool set, Playwright allowlist regex, forbidden tools, pinned body tokens, forbidden strings | New test in `bundled-catalog.test.ts`                                                 |
| CLI integration         | `shitaku list` shows `qa`                                                                                                            | One line in `program.test.ts`                                                         |
| Smoke (manual)          | Dry-run install plans a create                                                                                                       | `pnpm run build`, then `node dist/main.js init --agents qa --scope project --dry-run` |

Order:

1. RED, registry test. In `ships the bundled agents as registered loadable agents`:
   - line 312: `index.items.agents` equals `['pr-creator', 'qa', 'socratic-challenger']`;
   - line 317: sorted entries equal `['pr-creator.md', 'qa.md', 'socratic-challenger.md']`;
   - line 321: loaded names equal `['pr-creator', 'qa', 'socratic-challenger']`.
   - RED reason: registry and folder do not contain `qa`.
2. RED, content contract: add `keeps the qa agent content contract` (above). RED reason: `readFileSync` throws `ENOENT`.
3. RED, CLI list: add `expect(out).toContainEqual(expect.stringMatching(/^ {2}qa\s+\S/));` after line 1587. RED reason: `qa` not in the bundled catalog.
4. GREEN: create `catalog/agents/qa.md` (contract above) and insert `qa` in `items.agents`. Run `pnpm test`.
5. CONTRIBUTING sentence (documentation; `test/agents-docs.test.ts` must stay green).
6. Guards and gates: `test/naming.test.ts`, `test/generators.test.ts`, `test/agents-docs.test.ts`, `test/architecture.test.ts`; then full `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`.
7. Docs (commit 2): `pnpm run docs:catalog` and `pnpm run docs:website-catalog`; verify with `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`.
8. Smoke: `pnpm run build`, then `node dist/main.js init --agents qa --scope project --dry-run` plans a `create` for `./.claude/agents/qa.md`.

Out of reach of automated tests: the agent's runtime behavior (whether the model honors the test-files-only rule and the not-run reporting) and whether the Playwright tool names resolve in a live session. Optional manual check in a scratch project with the `playwright` MCP installed: run `/agents` or invoke `qa` and confirm the nine Playwright tools are listed as granted.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in shipped code. The change ships a data file copied flat by existing code. The agent's file writes (`Write`, `Edit`) are bounded at the instruction level by Decision 5 and asserted by the content test. The Playwright tools act on a browser through an MCP server the user installs separately; code-execution, upload and browser-install tools are excluded (Decision 1) and asserted by the forbidden list.

## Commit Plan

One PR (`Refs #44`), two work-unit commits on the feature branch. Forecast: about 150 to 200 authored changed lines (agent file ~95-115, tests ~45-60, catalog 1, program test 1, CONTRIBUTING 1; generated pages excluded), under the 400-line budget.

1. `feat(catalog): add qa agent`: `catalog/agents/qa.md`, `catalog/catalog.json`, `test/adapters/catalog/bundled-catalog.test.ts`, `test/adapters/cli/program.test.ts`, `CONTRIBUTING.md`. RED observed before the agent file and the entry exist; GREEN at commit.
2. `docs: list qa agent in README and website`: generated `README.md` agents section and `website/src/content/docs/{en,es}/catalog/agents/qa.md`.

The `openspec/changes/add-qa-agent/` artifacts follow the repository's existing practice (separate `docs(openspec): ...` commits); that is an orchestrator delivery detail, not part of the two work-unit commits. The PR body lists the deferred follow-ups: test-map and impact-radius scripts, a `shitaku new` QA phase with the retry rule, router integration (#244), snapshot-baseline infrastructure, profile inclusion (#285).

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

## Migration / Rollout

No migration required. Rollback: revert the PR or its two commits (or rerun both docs scripts after the revert). No `src/`, manifest or schema impact. Users who installed the agent run `shitaku uninstall qa` or `shitaku undo`.

## Open Questions

- [ ] Playwright tool names were taken from the `@playwright/mcp` core tool set as known at design time; live documentation (context7/WebFetch) was not available to the design executor. Before writing the agent file, apply must verify the nine names against the current `microsoft/playwright-mcp` README (or `npx @playwright/mcp@latest --help` tool list if authorized). If a name differs, update the agent file and the test array together; this does not change the design.
- [x] Agent name, tools, no Bash, Playwright optional, write tests, `Refs #44`: settled by the user (Engram `sdd/add-qa-agent/product-decisions`).
- [x] Registry order: alphabetical; the loader preserves listed order (Decision 9).

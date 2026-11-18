# Tasks: Add socratic-challenger Catalog Agent (issue #183)

## Review Workload Forecast

| Field                   | Value                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | about 110 to 150 authored (agent file 60-75, bundled-catalog test 45-60, program test 1, catalog.json 1, CONTRIBUTING 1, spec alignment 15-25); generated README and website pages excluded |
| 400-line budget risk    | Low                                                                                                                                                                                         |
| Chained PRs recommended | No                                                                                                                                                                                          |
| Suggested split         | Single PR, two work-unit commits (plus the orchestrator-owned `docs(openspec)` commit for the change artifacts)                                                                             |
| Delivery strategy       | ask-on-risk                                                                                                                                                                                 |
| Chain strategy          | pending (not needed, under budget)                                                                                                                                                          |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                                                                             | Likely PR | Focused test command                                                                              | Runtime harness                                                                                                                                                                              | Rollback boundary                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | Tests, agent file, registry entry, CONTRIBUTING sentence (commit `feat(catalog): add socratic-challenger agent`) | PR 1      | `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts test/adapters/cli/program.test.ts` | `pnpm run build`, then `node dist/main.js init --agents socratic-challenger --scope project --dry-run` in a scratch directory plans a `create` for `./.claude/agents/socratic-challenger.md` | Revert the commit (agent file, one catalog.json line, test edits, one CONTRIBUTING line) |
| 2    | Generated docs (commit `docs: list socratic-challenger agent in README and website`)                             | PR 1      | `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`                           | N/A, generated markdown only, verified by the check scripts                                                                                                                                  | Revert the docs commit; independent at runtime, the check scripts fail until it lands    |

## Spec vs design reconciliation (flagged mismatches, resolved by tasks)

| #   | Mismatch                                                                                                                                                                                              | Resolution                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| M1  | Spec "No default log path" says "requested or needed"; design asks for a path on every invocation without one, unless the caller opts out.                                                            | Task 1.2 reword the requirement to "no path given and the caller has not said no log is wanted".    |
| M2  | Spec has no opt-out requirement or scenario; design Decision 4 and the `## Q&A log` section do.                                                                                                       | Task 1.3 add requirement "Log opt-out" with scenarios.                                              |
| M3  | Spec has no write-scope rules (create with Write only, append with Edit only when the first line starts with `# Q&A log`, never Write over an existing file, non-log file refused); design pins them. | Task 1.4 add requirement "Q&A log write scope" with scenarios.                                      |
| M4  | Spec says summary when "the dialogue converges"; design says "the answers have closed every open question".                                                                                           | Task 1.5 align spec wording to the design (testable condition).                                     |
| M5  | Design pins 14 body phrases; none covers the opt-out rule.                                                                                                                                            | Task 2.3 pins 2 more (16 total); task 1.6 updates the design list and the `## Requirements` bullet. |
| M6  | Design Requirements bullet says "ask for one and write nothing until you have it" with no opt-out exception.                                                                                          | Task 3.1 write the agent file with the exception ("unless the caller says no log is wanted").       |
| M7  | Design Open Question 1 (opt-out wording) is still unchecked.                                                                                                                                          | Task 1.6 mark it confirmed (user confirmed).                                                        |

## Phase 1: Spec and design alignment (documentation, before RED)

- [x] 1.1 Baseline: run `pnpm install --frozen-lockfile` if `node_modules` is absent, then `pnpm test`; the suite must be green before any change.
- [x] 1.2 In `openspec/changes/add-socratic-challenger-agent/specs/socratic-challenger-agent/spec.md`, requirement "No default log path": replace "When a log is requested or needed and the caller gave no path" with "When the caller gave no path and has not said no log is wanted" (M1). Keep the two existing scenarios.
- [x] 1.3 Same spec file, add requirement "Log opt-out": when the caller says no log is wanted, the agent MUST write nothing and MUST NOT ask for a path again in that invocation. Scenarios: "Caller declines a log" (GIVEN the caller says no log is wanted, WHEN the agent runs, THEN no file is written AND no path is requested; questions are still returned) and "Opt-out wins over missing path" (GIVEN no path and an explicit opt-out, THEN the agent asks no path question) (M2).
- [x] 1.4 Same spec file, add requirement "Q&A log write scope": a missing file is created with Write in the log format (first line `# Q&A log: <topic>`); an existing file whose first line starts with `# Q&A log` is appended to with Edit and earlier content is never changed or deleted; an existing file that is not a Q&A log is left untouched, reported, and another path is requested; Write is never used on an existing file. Scenarios: create, append, refuse non-log file (M3).
- [x] 1.5 Same spec file, requirement "Optional decision summary": change "or the dialogue converges" to "or the answers have closed every open question"; the scenario text follows (M4).
- [x] 1.6 In `openspec/changes/add-socratic-challenger-agent/design.md`: extend the "Pinned body tokens" list with `no log is wanted` and `do not ask for a path again` (16 total); change the `## Requirements` log bullet in the agent contract to end "...write nothing until you have it, unless the caller says no log is wanted."; tick Open Question 1 as confirmed (M5, M6, M7). Verify: `pnpm run format:check` passes on both edited files.

## Phase 2: RED (tests first, strict TDD, `pnpm test`)

- [x] 2.1 In `test/adapters/catalog/bundled-catalog.test.ts`, rename `ships pr-creator as a registered loadable bundled agent` to `ships the bundled agents as registered loadable agents` and update: `index.items.agents` equals `['pr-creator', 'socratic-challenger']`; filtered and sorted `catalog/agents/` entries equal `['pr-creator.md', 'socratic-challenger.md']`; `catalog.issues` equals `[]`; `catalog.agents.map((a) => a.name)` equals `['pr-creator', 'socratic-challenger']`; replace the `agents[0]` description check with a loop asserting every description length is greater than 0. Spec: Bundled registration and valid agent file.
- [x] 2.2 Same file, add test `keeps the socratic-challenger agent content contract`, frontmatter part (same split regex as the `pr-creator` test): exactly 5 non-empty frontmatter lines; `lines[0]` is `name: socratic-challenger`; `description` is one line, non-empty, does not match `/: |['"|]/`, contains `socratic-method` and `Q&A log`; `skills:` appears once and its indented items equal exactly `['  - socratic-method']`; no block scalar (`/[>|]\s*$/m`). Specs: Description is a plain single-line scalar, Skill declaration.
- [x] 2.3 Same test, tools and body part: one `tools:` line; split on `,`, trimmed and sorted equals `['Edit', 'Glob', 'Grep', 'Read', 'Write']`; the tools line contains neither `Bash`, `*` nor `mcp__`. Body contains each pinned token: `socratic-method`, `Follow its rules and tone`, `stop and report that it must be installed`, `Do not improvise`, `There is no default path`, `ask for one and write nothing`, `no log is wanted`, `do not ask for a path again`, `Every invocation is independent`, `Use Edit and Write only for the Q&A log`, `# Q&A log`, `Never change or delete earlier content`, `Never overwrite an existing file with Write`, `decision summary`, `Never implement features`, `Never invent answers or decisions`. Raw text does not match `/shitaku/i` and does not contain `Co-Authored-By`. Specs: Least-privilege tools, Log opt-out, Q&A log write scope, No feature implementation, Generic English content.
- [x] 2.4 In `test/adapters/cli/program.test.ts`, test `lists the bundled catalog with a header per kind` (around line 1586), add `expect(out).toContainEqual(expect.stringMatching(/^ {2}socratic-challenger\s+\S/));`. Spec: Bundled load succeeds.
- [x] 2.5 Run `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts test/adapters/cli/program.test.ts` and observe RED: registry test fails (still `['pr-creator']`), content test fails with `ENOENT`, list test fails (no `socratic-challenger` line). Record the observed failures.

## Phase 3: GREEN (implementation)

- [x] 3.1 Create `catalog/agents/socratic-challenger.md` from the design "Agent file contract" with the Phase 1.6 updates (opt-out exception in `## Requirements`, opt-out bullet in `## Q&A log`). Frontmatter exact: `name`, one-line `description`, `tools: Read, Grep, Glob, Edit, Write`, `skills:` list with `- socratic-method`. Generic English, no repository or tool name, no attribution. Spec: all agent-file requirements.
- [x] 3.2 In `catalog/catalog.json` change `"agents": ["pr-creator"]` to `"agents": ["pr-creator", "socratic-challenger"]`. Profiles stay unchanged.
- [x] 3.3 Run `pnpm vitest run test/adapters/catalog/bundled-catalog.test.ts test/adapters/cli/program.test.ts` and observe GREEN. If Prettier normalizes the agent file, confirm the pinned tokens still match.
- [x] 3.4 In `CONTRIBUTING.md` (line 221) replace the one-agent sentence with: "The bundled catalog ships two agents: `pr-creator`, a least-privilege example that combines the `pr-writing` skill with `github` MCP tools, and `socratic-challenger`, which applies the `socratic-method` skill and writes only a Q&A log; install behavior tests still use fixtures." Do not add `--kind agent`; keep tokens guarded by `test/agents-docs.test.ts` intact. Spec: CONTRIBUTING updated.
- [x] 3.5 Run guards `pnpm vitest run test/naming.test.ts test/generators.test.ts test/agents-docs.test.ts test/architecture.test.ts`; note any docs guard that fails until Phase 4.
- [x] 3.6 Commit 1 (Conventional Commit, no AI attribution, hooks not bypassed): `feat(catalog): add socratic-challenger agent` with the agent file, `catalog/catalog.json`, both test files and `CONTRIBUTING.md`. Record the commit identity.

## Phase 4: Generated docs (commit 2)

- [x] 4.1 Run `pnpm run docs:catalog` to add the `socratic-challenger` row to the `README.md` agents table.
- [x] 4.2 Run `pnpm run docs:website-catalog` to generate `website/src/content/docs/en/catalog/agents/socratic-challenger.md` and `website/src/content/docs/es/catalog/agents/socratic-challenger.md`.
- [x] 4.3 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass.
- [x] 4.4 Commit 2: `docs: list socratic-challenger agent in README and website` with the generated files. Record the commit identity.

## Phase 5: Verification

- [x] 5.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`; all must pass.
- [x] 5.2 Confirm no `src/`, `catalog/skills/socratic-method/` or `catalog/profiles/` change: `git diff --stat main...HEAD -- src catalog/skills/socratic-method catalog/profiles` is empty. Spec: Catalog-only surface.
- [x] 5.3 Run `pnpm run build`, then in a scratch directory under the session scratchpad (not the real home) run `node dist/main.js init --agents socratic-challenger --scope project --dry-run`. Expect a `create` plan for `./.claude/agents/socratic-challenger.md` and no file, backup or manifest written. Spec: Installable create when absent.
- [ ] 5.4 (SKIPPED, optional manual runtime check) Optional manual runtime check (not automated): in a scratch project invoke the installed agent without a log path (expect a path question and no file written), with a path (expect round 1 created), and with "no log wanted" (expect no file and no path question).

## Phase 6: PR notes

- [x] 6.1 Prepare PR description notes: the "respect the installed tone" interpretation (follow the skill's rules and tone), the residual risk that the Edit/Write path restriction is instruction-level only, the opt-out addition and spec alignment, and the follow-up for agent-to-skill dependency resolution (check whether #280 already covers it before opening a new issue).

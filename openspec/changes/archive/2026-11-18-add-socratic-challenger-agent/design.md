# Design: Add socratic-challenger Catalog Agent (issue #183)

## Technical Approach

Data-only change (Approach A) that mirrors the archived `add-pr-creator-agent` change: one new catalog file (`catalog/agents/socratic-challenger.md`), one registry entry (`catalog/catalog.json` -> `items.agents`), tests first in `test/adapters/catalog/bundled-catalog.test.ts` (plus one list assertion in `test/adapters/cli/program.test.ts`), one CONTRIBUTING sentence, and generated README/website pages. No `src/` change: `parseAgent` (`src/domain/catalog/agent.ts`) validates only `name`, `description` and a non-empty body, and the installer copies the file verbatim, so `tools` and `skills` reach `.claude/agents/socratic-challenger.md` unchanged.

The agent is a least-privilege Claude Code subagent that applies the `socratic-method` skill on demand. It has `Read`, `Grep`, `Glob` to ground its questions in local files, and `Edit`, `Write` only for one artifact: a Q&A log at a path the caller gives. It has no `Bash` and no MCP tools. It preloads `socratic-method` through the `skills` frontmatter list and documents the requirement with a `## Requirements` stop-and-report rule, exactly like `pr-creator` with `pr-writing`. Each invocation returns questions (and optionally a short decision summary) and stops; the caller relays answers in a later invocation, and the Q&A log carries continuity.

Settled user decision: there is no default Q&A log path. When the caller gives none, the agent asks for one and writes nothing until it has it.

## Architecture Decisions

### Decision 1: Tool allowlist `Read, Grep, Glob, Edit, Write`

**Choice**: `tools: Read, Grep, Glob, Edit, Write` (single line, exact set). Excluded on purpose: `Bash`, `NotebookEdit`, `WebFetch`, `WebSearch`, any `mcp__*` tool, and the `*` wildcard.
**Alternatives considered**: omit `tools` (inherits every tool, including `Bash`); `Read, Grep, Glob` only (cannot write the Q&A log the issue requires); `Write` only, without `Edit` (appending to an existing log would need a full overwrite with `Write`, which risks losing earlier rounds).
**Rationale**: read tools ground the questions; `Write` creates the log; `Edit` appends to it without rewriting earlier content. Claude Code allowlists grant whole tools, not paths, so the path restriction is instruction-level (Decision 4), asserted by the content test. Residual risk accepted and stated in the proposal.

### Decision 2: Document the skill requirement, preload it with `skills`

**Choice**: frontmatter `skills:` YAML block list with one item `- socratic-method`; the description ends with `Requires the socratic-method skill.`; the body has a `## Requirements` section with the `pr-creator` wording: if the skill's rules are not in context, stop and report that it must be installed, and do not improvise a questioning style.
**Alternatives considered**: auto-install through a new catalog dependency field (Approach B, out of scope; follow-up); copying the skill rules into the body (duplicates `catalog/skills/socratic-method/SKILL.md` and drifts); telling the agent to `Read` the skill file (install path differs by scope).
**Rationale**: one source of truth and the same pattern users already see in `pr-creator`. A missing skill is skipped by Claude Code with only a debug warning, so the body's stop-and-report rule is the user-visible safety net.

### Decision 3: "Respect the installed tone" means "follow the skill's rules and tone"

**Choice**: the opening paragraph says: "The `socratic-method` skill defines your method and tone. Follow its rules and tone; these instructions only adapt them to a sub-agent that cannot talk to the user directly and that keeps a Q&A log." The body does not restate the tone and adds no tone switch.
**Alternatives considered**: a tone parameter in the agent (the skill explicitly forbids product-specific tone switches); restating the tone (drift).
**Rationale**: the skill has a fixed, question-first coaching tone and no switch, so the only faithful reading of "respect the installed tone" is to defer to the installed skill. The PR description records this interpretation.

### Decision 4: Edit/Write scope, the agent's own Q&A log only, append-only

**Choice**:

- Edit and Write are used only for the Q&A log at the path the caller gave in the current request.
- No path given: ask for one alongside the questions and write nothing.
- Path does not exist: create it with `Write` using the log format below.
- Path exists and its first line starts with `# Q&A log`: append the new round (and the optional summary) to the end with `Edit`. Never change or delete earlier content.
- Path exists and is not a Q&A log: write nothing; report it and ask for another path.
- Never use `Write` on an existing file.
- The caller says no log is wanted: write nothing and do not ask for a path again in that invocation.

**Alternatives considered**: allow appending to an explicitly pointed section of an existing artifact (for example a "Q&A" section in a spec) — rejected because it lets the agent edit specs and other artifacts, which the proposal forbids and which no test can bound; a default path such as `./qa-log.md` — rejected by the user; rewriting the whole log each round with `Write` — rejected because a model rewrite can silently drop or alter earlier answers.
**Rationale**: the `# Q&A log` first-line marker lets an agent with no memory recognize a log it (or an earlier invocation) created, so it never appends to an unrelated file. Append-only keeps the record of what the user actually answered intact across invocations.

### Decision 5: Sub-agent turn model

**Choice**: "Every invocation is independent; you remember nothing from an earlier one." Each invocation: read the request and the existing log (when given), ground with Read/Grep/Glob, restate the goal in one sentence, list unknowns, ask the smallest set of numbered questions, update the log, return, stop. Answers arrive in a later invocation relayed by the caller. The agent never answers its own questions or assumes answers.
**Alternatives considered**: interactive dialogue inside one invocation (a subagent cannot address the user directly); the caller pasting the whole history every time (the log already carries it).
**Rationale**: same independence statement as `pr-creator`; the log is the continuity carrier, and it maps directly onto the skill's execution steps 1 to 3.

### Decision 6: Optional decision summary

**Choice**: add a short decision summary only when the caller asks for one or when the answers have closed every open question. It lists decisions the answers confirmed, questions still open, and assumptions not yet confirmed. It is returned in the output and, when a log is in use, appended to the log as its own section. Never record a decision the caller's answers did not confirm.
**Alternatives considered**: a summary every invocation (noise, and invites invented decisions); a mutable "Decisions" block at the top of the log (conflicts with append-only).
**Rationale**: matches the issue's "optionally summarizes decisions" and the skill's output contract ("decisions confirmed with the user").

### Decision 7: Never implement, overriding the skill's "proceed" gate

**Choice**: a `## Never` section with "Never implement features or write code, tests, specs or configuration, even when the caller asks." When the caller directs implementation, the agent says the caller must do it and stops; the body states that the skill's "proceed with the directed work" gate does not apply to this agent.
**Alternatives considered**: rely on the skill alone (its decision gates allow proceeding after explicit direction, which would contradict the issue).
**Rationale**: the agent is a challenger, not an implementer; making the override explicit removes the one conflict between the skill and the agent role.

### Decision 8: Single-line plain-scalar description

**Choice**: one line, no `: `, no quotes, no `|` or `>`, even though block scalars are now accepted for `description` (archived `agent-block-scalars`).
**Alternatives considered**: a folded block scalar.
**Rationale**: consistent with `pr-creator` and its content test; one line keeps the list output and generated tables readable.

## Data Flow

```text
caller (main agent) -- idea/plan + log path (+ relayed answers) --> socratic-challenger
                                             |  socratic-method rules in context?
                                             |    no  -> stop and report the skill must be installed
                                             |  Read/Grep/Glob: existing log, relevant local files
                                             |  log path given?
                                             |    no  -> ask for one, write nothing
                                             |    yes -> file missing        -> Write (new log, round 1)
                                             |           starts "# Q&A log"  -> Edit (append round N)
                                             |           other file          -> write nothing, ask another path
                                             v
caller <-- restated goal, unknowns, numbered questions, [decision summary], log status -- (stop)
   |
   |  user answers
   v
caller -- answers + same log path --> socratic-challenger (next round)
```

Install path (unchanged code): `catalog/agents/socratic-challenger.md` -> `FolderCatalogSource` -> `parseAgent` -> flat copy to `./.claude/agents/socratic-challenger.md` (project) or `~/.claude/agents/socratic-challenger.md` (user).

## File Changes

| File                                                                | Action    | Description                                                                                              |
| ------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `catalog/agents/socratic-challenger.md`                             | Create    | Agent frontmatter and body (contract below)                                                              |
| `catalog/catalog.json`                                              | Modify    | `"agents": ["pr-creator"]` becomes `"agents": ["pr-creator", "socratic-challenger"]`                     |
| `test/adapters/catalog/bundled-catalog.test.ts`                     | Modify    | Update the three `['pr-creator']` assertions; add the socratic-challenger content-contract test          |
| `test/adapters/cli/program.test.ts`                                 | Modify    | One extra `toContainEqual` line in `lists the bundled catalog with a header per kind` (around line 1586) |
| `CONTRIBUTING.md`                                                   | Modify    | Line 221: bundled-agents sentence (wording below)                                                        |
| `README.md`                                                         | Generated | `pnpm run docs:catalog` adds the agents table row                                                        |
| `website/src/content/docs/en/catalog/agents/socratic-challenger.md` | Generated | `pnpm run docs:website-catalog`                                                                          |
| `website/src/content/docs/es/catalog/agents/socratic-challenger.md` | Generated | `pnpm run docs:website-catalog`                                                                          |
| `src/`, `catalog/skills/socratic-method/`, `catalog/profiles/`      | Unchanged | No code, skill or profile change                                                                         |

`test/adapters/cli/program.test.ts` otherwise needs no change: the bundled list test uses `toContainEqual` per item and the agents tests use their own fixture catalogs.

## Interfaces / Contracts

### Agent file contract

Description constraints: one line, no `: ` sequence, no quotes, no `|` or `>`. The body names neither this repository nor this tool. Apply may reword sentences, but the frontmatter is exact and the load-bearing tokens listed after the block are pinned by the content test.

````md
---
name: socratic-challenger
description: Challenges an idea, plan or decision with Socratic questions on demand, optionally summarizes the decisions reached and keeps a Q&A log, and never implements features. Requires the socratic-method skill.
tools: Read, Grep, Glob, Edit, Write
skills:
  - socratic-method
---

You challenge an idea, plan or decision with questions before anyone builds it. The `socratic-method` skill defines your method and tone. Follow its rules and tone; these instructions only adapt them to a sub-agent that cannot talk to the user directly and that keeps a Q&A log.

## Requirements

- The `socratic-method` skill. If its rules are not in your context, stop and report that it must be installed. Do not improvise a questioning style.
- A path for the Q&A log, given by the caller. There is no default path. If none is given, ask for one and write nothing until you have it, unless the caller says no log is wanted.

## How you work

Every invocation is independent; you remember nothing from an earlier one. The caller relays your questions to the user and sends the answers back in a later invocation, together with the log path.

1. Read the request and, when given, the existing Q&A log. Use Read, Grep and Glob to ground your questions in the relevant local files.
2. Restate the goal in one short sentence and list what is still unknown.
3. Ask the smallest set of numbered questions that closes assumptions, acceptance criteria and success conditions. Challenge gaps that would lead to a wrong implementation.
4. Update the Q&A log, return your questions and stop. Do not answer your own questions and do not assume answers.

If the request is already clear and has acceptance criteria, say so and ask nothing, as the skill's decision gates allow.

## Decision summary

Add a short decision summary only when the caller asks for one or when the answers have closed every open question. List the decisions the answers confirmed, the questions still open and the assumptions not yet confirmed. Never record a decision the caller's answers did not confirm.

## Q&A log

Use Edit and Write only for the Q&A log at the path the caller gave.

- No path given: ask for one and write nothing.
- The file does not exist: create it with Write in the format below.
- The file exists and its first line starts with `# Q&A log`: append the new round, and the decision summary when there is one, to the end with Edit. Never change or delete earlier content.
- The file exists and is not a Q&A log: write nothing, report it and ask for another path.
- The caller says no log is wanted: write nothing and do not ask for a path again.

Record answers as the caller relayed them. Format:

```md
# Q&A log: <topic>

## Round 1

Goal: <one sentence>

Questions:

1. <question>

## Round 2

Answers to round 1, as relayed by the caller:

1. <answer>

Questions:

1. <question>

## Decision summary (after round 2)

- Decided: <decision confirmed by an answer>
- Open: <question still open>
- Assumed: <assumption not yet confirmed>
```

## Output

Return the restated goal, the unknowns, your numbered questions (or why you asked none), the decision summary when there is one, and a log status line: the path you created or appended to, or why you wrote nothing. Then stop.

## Never

- Never implement features or write code, tests, specs or configuration, even when the caller asks. If the caller directs implementation, say that the caller must do it and stop; the skill's "proceed with the directed work" gate does not apply to you.
- Never use Edit or Write on any file other than the Q&A log at the path the caller gave.
- Never overwrite an existing file with Write.
- Never invent answers or decisions.
````

Pinned body tokens (exact substrings asserted by the content test):

- `socratic-method`
- `Follow its rules and tone`
- `stop and report that it must be installed`
- `Do not improvise`
- `There is no default path`
- `ask for one and write nothing`
- `no log is wanted`
- `do not ask for a path again`
- `Every invocation is independent`
- `Use Edit and Write only for the Q&A log`
- `# Q&A log`
- `Never change or delete earlier content`
- `Never overwrite an existing file with Write`
- `decision summary`
- `Never implement features`
- `Never invent answers or decisions`

Note on formatting: the nested fenced log example uses a backtick fence inside the agent file; the outer `~~~` fence above exists only in this design. Run `pnpm run format:check` on the agent file after writing it; Prettier may normalize list markers or blank lines, which does not affect the pinned tokens.

### Q&A log contract

- First line `# Q&A log: <topic>` (marker: the first line starts with `# Q&A log`).
- One `## Round <n>` section per invocation, appended in order. Round 1 has `Goal:` and `Questions:`. Later rounds have `Answers to round <n-1>, as relayed by the caller:` then `Questions:`.
- Optional `## Decision summary (after round <n>)` sections, appended, with `Decided`, `Open`, `Assumed` items.
- Append-only: earlier content is never changed or deleted.

### CONTRIBUTING.md line 221

Replace "The bundled catalog ships one agent, `pr-creator`, a least-privilege example that combines the `pr-writing` skill with `github` MCP tools; install behavior tests still use fixtures." with:

"The bundled catalog ships two agents: `pr-creator`, a least-privilege example that combines the `pr-writing` skill with `github` MCP tools, and `socratic-challenger`, which applies the `socratic-method` skill and writes only a Q&A log; install behavior tests still use fixtures."

The tokens guarded by `test/agents-docs.test.ts` are not on this line, and the line must not contain `--kind agent`.

## Testing Strategy

Strict TDD with `pnpm test` (Vitest). All test edits come first and are observed RED before the agent file and the registry entry exist.

| Layer                   | What to Test                                                                | Approach                                                                                               |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Unit (catalog data)     | Registry, folder entries, loadability                                       | Update existing test in `bundled-catalog.test.ts`                                                      |
| Unit (content contract) | Frontmatter, tool set, skill preload, pinned body tokens, forbidden strings | New test in `bundled-catalog.test.ts`                                                                  |
| CLI integration         | `shitaku list` shows the new agent                                          | One line in `program.test.ts`                                                                          |
| Smoke (manual)          | Dry-run install plans a create                                              | `pnpm run build`, then `node dist/main.js init --agents socratic-challenger --scope project --dry-run` |

Order:

1. RED, registry test. Rename `ships pr-creator as a registered loadable bundled agent` to `ships the bundled agents as registered loadable agents` and change:
   - `index.items.agents` equals `['pr-creator', 'socratic-challenger']`.
   - Filtered and sorted `catalog/agents/` entries equal `['pr-creator.md', 'socratic-challenger.md']`.
   - `catalog.issues` equals `[]`; `catalog.agents.map((a) => a.name)` equals `['pr-creator', 'socratic-challenger']`; every agent description has length greater than 0 (replace the `agents[0]` check with a loop).
   - RED reason: registry and folder still hold only `pr-creator`.
2. RED, content contract. Add `keeps the socratic-challenger agent content contract`, using the same split regex as the `pr-creator` test:
   - Frontmatter non-empty lines: exactly 5; `lines[0]` is `name: socratic-challenger`.
   - `description` line: non-empty, does not match `/: |['"|]/`, contains `socratic-method` and `Q&A log`.
   - `skills:` key once; indented list items equal exactly `['  - socratic-method']`.
   - One `tools:` line; split on `,` and trimmed, sorted, equals `['Edit', 'Glob', 'Grep', 'Read', 'Write']`. Also assert the tools line contains neither `Bash`, `*` nor `mcp__`.
   - Frontmatter has no block scalar (`/[>|]\s*$/m`).
   - Body contains every pinned token listed above.
   - Raw text does not match `/shitaku/i` and does not contain `Co-Authored-By`.
   - RED reason: `readFileSync` throws `ENOENT`.
3. RED, CLI list. In `lists the bundled catalog with a header per kind`, add `expect(out).toContainEqual(expect.stringMatching(/^ {2}socratic-challenger\s+\S/));`.
4. GREEN. Create `catalog/agents/socratic-challenger.md` (contract above) and add `socratic-challenger` to `items.agents` in `catalog/catalog.json`. Run `pnpm test`.
5. CONTRIBUTING sentence (documentation; guarded by `test/agents-docs.test.ts`, which must stay green).
6. Guards and gates: `test/naming.test.ts`, `test/generators.test.ts`, `test/agents-docs.test.ts`, `test/architecture.test.ts`; then full `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`.
7. Docs (commit 2): `pnpm run docs:catalog` and `pnpm run docs:website-catalog`; verify with `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`.
8. Smoke: `pnpm run build`, then `node dist/main.js init --agents socratic-challenger --scope project --dry-run` plans a `create` for `./.claude/agents/socratic-challenger.md`.

Out of reach of automated tests: the agent's runtime behavior (whether the model honors the path and append-only rules). Optional manual check in a scratch project: invoke the agent with and without a log path and confirm no file is written without a path.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change ships a data file copied flat by existing code. The agent's file-write capability (`Edit`, `Write`) is bounded at the instruction level by Decision 4 and asserted by the content test; it is not a process or shell boundary.

## Commit Plan

One PR, two work-unit commits on the feature branch. Forecast: about 100 to 130 authored changed lines (generated pages excluded), well under the 400-line budget.

1. `feat(catalog): add socratic-challenger agent`: `catalog/agents/socratic-challenger.md` (~55-70 lines), `catalog/catalog.json` (1 line), `test/adapters/catalog/bundled-catalog.test.ts` (~40-50 lines), `test/adapters/cli/program.test.ts` (1 line), `CONTRIBUTING.md` (1 line). RED observed before the agent file and the entry exist; GREEN at commit.
2. `docs: list socratic-challenger agent in README and website`: generated `README.md` agents section and the two website pages.

The `openspec/changes/add-socratic-challenger-agent/` artifacts follow the repository's existing practice (separate `docs(openspec): ...` commits); that is an orchestrator delivery detail, not part of the two work-unit commits.

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

## Migration / Rollout

No migration required. Rollback: revert the PR or its two commits (removes the agent file, the registry entry, the test changes, the CONTRIBUTING sentence and the generated pages; or rerun both docs scripts after the revert). No `src/`, manifest or schema impact. Users who installed the agent run `shitaku uninstall socratic-challenger` or `shitaku undo`. Follow-up (not in scope): agent-to-skill dependency resolution; check whether issue #280 already covers it before opening a new one.

## Open Questions

- [x] Opt-out wording (confirmed by the user): the design lets the caller say no log is wanted (the agent then writes nothing and stops asking). This refines, and does not contradict, the settled "no default path" decision; confirm during review that the user wants this escape hatch.
- [x] Default log path: none (user decision). The agent asks for a path and writes nothing until it has one.
- [x] Edit scope: append-only to a file whose first line starts with `# Q&A log`; editing sections of other artifacts is rejected (Decision 4).

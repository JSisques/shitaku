# Proposal: Add socratic-challenger Catalog Agent (issue #183)

## Intent

The catalog ships the `socratic-method` skill (fixed, question-first tone) and one bundled agent (`pr-creator`), but no agent that applies the skill as an on-demand reviewer of ideas. Issue #183 asks for a `socratic-challenger` Claude Code sub-agent: a Socratic challenge specialist that asks questions, optionally summarizes decisions, and writes a Q&A log, without implementing features. It gives users a ready-made "challenge my plan" sub-agent and is the second bundled agent, showing a least-privilege agent that pairs with a catalog skill and writes only one artifact.

## Scope

### In Scope

- `catalog/agents/socratic-challenger.md`:
  - Single-line `name: socratic-challenger` and a single-line plain-scalar `description` (no `: ` and no quotes) that states it is used on demand, asks questions, optionally summarizes decisions, writes a Q&A log, does not implement features, and requires the `socratic-method` skill.
  - Frontmatter `tools: Read, Grep, Glob, Edit, Write` (no `Bash`) and `skills:` block list with `socratic-method`.
  - Generic English body (no repository-specific names, no project name, no attribution).
- Body behavior:
  - `## Requirements` section (the `pr-creator` pattern): if the `socratic-method` rules are not in context, stop and report that the skill must be installed; do not improvise a questioning style.
  - Follow the `socratic-method` skill's rules and tone. The issue's "respect the installed tone" is expressed as following the installed skill, because the skill has a fixed tone and no tone switch.
  - Question-first challenge of the caller's idea, plan or decision; read relevant local files with Read/Grep/Glob for grounding.
  - Sub-agent turn model: every invocation is independent; the agent returns its questions and stops; the caller relays answers in a later invocation (the Q&A log carries continuity).
  - Optional decision summary when the caller asks for it or the dialogue converges.
  - Edit/Write are used only for the Q&A log file at a path given by the caller; never to edit source, specs, tests, configuration or any other existing artifact; never to implement features.
- Register `socratic-challenger` in `catalog/catalog.json` -> `items.agents` (becomes `["pr-creator", "socratic-challenger"]`).
- Tests first (strict TDD, `pnpm test`) in `test/adapters/catalog/bundled-catalog.test.ts`:
  - Update the three hard-coded `['pr-creator']` assertions (registry, `catalog/agents/` entries, loaded agent names).
  - Add a content-contract test mirroring the `pr-creator` one: frontmatter name and single-line description, exact `tools` (`Read, Grep, Glob, Edit, Write`, no `Bash`), `skills` lists `socratic-method`, body contains the Requirements stop-and-report rule, the Q&A-log-only Edit/Write rule and the no-implementation rule, and contains neither `shitaku` nor `Co-Authored-By`.
  - Verify `test/adapters/cli/program.test.ts` (list output, interactive init prompts) still passes; update only if a hard-coded agent list breaks.
- Regenerate docs: `pnpm run docs:catalog` (README) and `pnpm run docs:website-catalog` (website en/es); verify with the `:check` variants.
- `CONTRIBUTING.md` agents section (~line 221): reword the sentence that says the bundled catalog ships one agent so it stays accurate with two.

### Out of Scope

- Approach B: a catalog dependency field (`requires`/`skills`) that makes `init` auto-install the skills an agent needs. It touches domain schema, plan, prompter, undo and uninstall semantics and deserves its own change. Possible follow-up issue; check first whether existing issue #280 already covers agent-to-skill dependency resolution (#300 covers MCP servers).
- Any change to `catalog/skills/socratic-method/SKILL.md` (including adding a tone switch).
- Any `src/` change (`parseAgent` already passes `tools` and `skills` through).
- Adding the agent to any profile.
- Hard enforcement of the Edit/Write restriction (Claude Code allowlists grant whole tools, not paths).

## Capabilities

### New Capabilities

- `socratic-challenger-agent`: catalog-bundled `socratic-challenger` agent content (frontmatter, least-privilege tools without Bash, `socratic-method` skill preload and documented requirement, question-first behavior, sub-agent turn model, optional decision summary, Edit/Write restricted to the Q&A log, no implementation) and installability acceptance.

### Modified Capabilities

None. Install, list and validation behavior stay under the existing `catalog` and `agents-install` specs; the CONTRIBUTING sentence is documentation only. `pr-creator-agent` and `socratic-method-skill` requirements are unchanged.

## Approach

Approach A (user decision): content only, mirroring the archived `add-pr-creator-agent` change. One agent file, one registry entry, tests first, regenerated docs, one CONTRIBUTING sentence, no code.

- The skill requirement is documented, not installed: description mention plus a `## Requirements` stop-and-report rule, exactly like `pr-creator` with `pr-writing`.
- Least privilege is instruction-level for Edit/Write: the body allows them only on the caller-provided Q&A log path and forbids any other write; the content-contract test asserts the wording so it cannot silently regress.
- Q&A log path: the caller provides it. When a log is requested without a path, the agent asks for one and does not write. The design phase pins the log format (append-only question/answer entries plus an optional decisions block) and whether Edit is limited to appending to a log the agent itself created.

Delivery: one PR, two Conventional Commits:

1. `feat(catalog): add socratic-challenger agent` (agent file, catalog.json, tests, CONTRIBUTING sentence).
2. `docs: list socratic-challenger agent in README and website` (generated pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and docs only.

| Area                                                                     | Impact    | Description                                              |
| ------------------------------------------------------------------------ | --------- | -------------------------------------------------------- |
| `catalog/agents/socratic-challenger.md`                                  | New       | Agent frontmatter and body                               |
| `catalog/catalog.json`                                                   | Modified  | `items.agents` gains `socratic-challenger`               |
| `test/adapters/catalog/bundled-catalog.test.ts`                          | Modified  | Updated agent list assertions; new content-contract test |
| `test/adapters/cli/program.test.ts`                                      | Verify    | Only if a hard-coded agent list breaks                   |
| `CONTRIBUTING.md`                                                        | Modified  | Agents section sentence (~line 221)                      |
| `README.md`                                                              | Generated | Agents catalog table                                     |
| `website/src/content/docs/{en,es}/catalog/agents/socratic-challenger.md` | Generated | Website agent pages                                      |
| `src/`, `catalog/skills/socratic-method/`, `catalog/profiles/`           | Unchanged | No code, skill or profile change                         |

## Risks

| Risk                                                                           | Likelihood      | Mitigation                                                                                                                                                      |
| ------------------------------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hard-coded `['pr-creator']` arrays in tests break                              | High (expected) | Update them first as the RED step                                                                                                                               |
| Stale generated README/website docs fail CI                                    | Low             | Run both docs scripts and their `:check` variants                                                                                                               |
| Edit/Write misused beyond the Q&A log (allowlist cannot restrict paths)        | Med             | Explicit body rule, caller-provided path only, never edit existing artifacts, asserted by the content test; residual risk accepted (instruction, not guarantee) |
| `socratic-method` not installed, so the `skills` preload silently does nothing | Med             | Description mention plus Requirements stop-and-report rule; follow-up dependency issue                                                                          |
| "Respect the installed tone" has no code counterpart                           | Low             | Phrase as following the installed skill's rules and tone; record the interpretation in the PR                                                                   |
| Sub-agent cannot converse directly with the user                               | Med             | Return questions and stop; continuity through caller relay and the Q&A log                                                                                      |
| Description breaks the plain YAML scalar (`: ` or quotes)                      | Low             | Content test asserts single-line description; avoid colons and quotes                                                                                           |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/agents/socratic-challenger.md`, the `catalog.json` entry, the test changes, the CONTRIBUTING sentence and the generated README/website pages (or rerun the docs scripts after the revert). No `src/`, manifest or migration impact. Users who installed the agent run `shitaku uninstall socratic-challenger` or `shitaku undo`.

## Dependencies

- Shipped agents capability (`catalog-add-agents`; specs `catalog` and `agents-install`).
- Existing `socratic-method` skill catalog item (runtime requirement for users, not a build dependency).

## Success Criteria

- [ ] Updated and new `bundled-catalog.test.ts` agent tests observed RED, then GREEN; catalog loads with no issues and `catalog.agents` equals `['pr-creator', 'socratic-challenger']`.
- [ ] `pnpm run build` then `node dist/main.js init --agents socratic-challenger --scope project --dry-run` plans a `create` for `./.claude/agents/socratic-challenger.md`.
- [ ] Frontmatter: `name: socratic-challenger`, single-line description mentioning the `socratic-method` requirement, `tools: Read, Grep, Glob, Edit, Write` (no `Bash`), `skills` lists `socratic-method`.
- [ ] Body: Requirements stop-and-report rule, follows the skill's rules and tone, question-first, optional decision summary, Edit/Write only for the caller-provided Q&A log, never implements features; no `shitaku` and no `Co-Authored-By`.
- [ ] CONTRIBUTING agents section is accurate with two bundled agents.
- [ ] `docs:catalog:check` and the website catalog check pass.
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass; no `src/` changes.
- [ ] Follow-up for agent-to-skill dependency resolution is proposed, or confirmed as already covered by #280.

## Review Workload Forecast

Authored lines: agent file ~50-80, catalog entry ~1, tests ~35-55 (including the three updated assertions), CONTRIBUTING ~2; total ~90-140 (generated README/website pages excluded). Single PR, two commits.

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

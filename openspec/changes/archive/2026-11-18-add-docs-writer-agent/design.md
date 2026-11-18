# Design: Add docs-writer Catalog Agent (issue #126)

## Technical Approach

Content-only change (approach A) plus a repository test guard (approach D), mirroring the archived `add-socratic-challenger-agent` change. One new agent file, one `catalog.json` entry, test updates written first, one CONTRIBUTING sentence and regenerated README/website pages. No `src/` change: `parseAgent` (`src/domain/catalog/agent.ts`) validates only `name`/`description` and keeps `bytes` verbatim, so `tools` and `skills` reach the target untouched.

The two known gaps are handled at the instruction level and locked by tests:

- Missing skill: the description names the `docs-writing` requirement and the body has a `## Requirements` stop-and-report rule.
- No `Bash`: the body states which skill steps the agent cannot run and tells it to ask the caller (or report "not run") and never claim generated docs are in sync.

The approach D guard parses each loaded agent's `skills:` block list in the test file and checks it against `catalog.json` `items.skills`, covering all bundled agents.

## Architecture Decisions

### Decision: Agent frontmatter

**Choice**: Exactly five non-empty frontmatter lines, same shape as `socratic-challenger`:

```yaml
---
name: docs-writer
description: Writes and updates documentation, README sections, guides, code comments and JSDoc without changing code behavior, and asks the caller to run docs generators it cannot run. Requires the docs-writing skill.
tools: Read, Grep, Glob, Edit, Write
skills:
  - docs-writing
---
```

**Alternatives considered**: a block-scalar description (allowed by `parseAgent`, but rejected by the existing contract-test style `not.toMatch(/[>|]\s*$/m)` and harder to keep plain); adding `model:` (no other bundled agent pins a model; the caller's default is fine); mentioning "PR" or "commit" exclusions in the description (lengthens it and invites the wrong trigger; exclusions live in the body).
**Rationale**: Plain single-line scalar with no `: `, quotes or `|` keeps every YAML parser and the README/website generators reading it identically. The description says what it does, the no-shell caveat and the skill requirement, and does not claim PR text, commit messages or agent instruction files.

### Decision: Agent body outline and wording

**Choice**: Generic English body with these sections, in order:

1. Intro paragraph: the agent writes and updates documentation, README sections, guides, code comments and JSDoc. "The `docs-writing` skill defines how to write them. Follow its rules; these instructions only adapt them to a sub-agent that has no shell and writes only documentation and comments."
2. `## Requirements`: "The `docs-writing` skill. If its rules are not in your context, stop and report that it must be installed. Do not improvise a documentation style." Also states that installing this agent does not install the skill.
3. `## How you work`: numbered steps mapped onto the skill's Execution Steps:
   1. Read the request. If it depends on what changed in the repository and no diff was given, ask the caller to provide the diff; do not guess the change.
   2. Use Read, Grep and Glob to inspect the existing docs, conventions, style guides, docs generators and their check scripts.
   3. Edit the affected docs and comments following the skill.
   4. Return the output below and stop.
4. `## Write scope`: "Use Edit and Write only on documentation files and on comments or JSDoc inside source files."
   - In a source file, change only comments and JSDoc/TSDoc; leave every line of code as it was.
   - If the caller asks for a change to code logic, configuration or tests, do not edit it; say that you only write documentation and comments, and stop.
   - Do not edit agent instruction files and do not write pull request text or commit messages; the skill excludes them. When the skill says a commit message must carry a change (a release-generated CHANGELOG), report that to the caller instead.
   - Never hand-edit generated output.
5. `## Without a shell`: "You have no shell, so you cannot run docs generators, check scripts or `git diff`."
   - When the skill says to run a generator or check script, name the command you found and ask the caller to run it, or report it as not run.
   - When you need to know what changed, ask the caller to provide the diff.
   - Never claim that generated documentation is in sync or that a check passed unless the caller reports the result.
6. `## Output`: files changed; each generator or check with the command and either the caller-reported result or "not run"; anything skipped with the reason; documentation gaps that remain. Mirrors the skill's Output Contract, adapted to "not run".
7. `## Never`: Never change code logic, configuration or tests. Never edit agent instruction files or write pull request text or commit messages. Never hand-edit generated output. Never claim that generated documentation is in sync.

Target length about 45-60 lines. No repository-specific file, script or tool names (the skill requires staying generic), no project name, no attribution.

**Alternatives considered**: restating the skill's README/CHANGELOG/JSDoc rules in the body (duplicates the skill and risks drift; the spec forbids an alternative style); a path allowlist of doc extensions (`*.md`, `docs/**`) in the body (repositories differ; "documentation files and comments or JSDoc inside source files" is the generic, testable rule).
**Rationale**: Same layered pattern as `socratic-challenger`: the skill owns the method, the agent body only adapts it to sub-agent constraints (no shell, restricted writes, skill may be missing). Each constraint gets a dedicated section so the contract test can pin one exact sentence per rule.

### Decision: How the D guard reads each agent's `skills:`

**Choice**: Iterate the agents returned by `new FolderCatalogSource(catalogRoot, 'bundled').load()` (so only registered, valid agents are checked, from the exact bytes that get installed), decode `agent.bytes`, and extract skills with a small test-local helper `agentSkills(text: string): string[]` in `bundled-catalog.test.ts`:

- Take the frontmatter block (the same `split(/^---\r?\n|\r?\n---\r?\n/)` used by the existing contract tests).
- No top-level `skills:` line: return `[]`.
- `skills:` with an inline value (flow list `[a, b]` or a scalar): throw `unsupported skills form in frontmatter`, so the guard cannot pass vacuously on a shape it does not read.
- Otherwise collect the following indented lines; each must match `^\s+- ([a-z0-9-]+)\s*$` (else throw), stopping at the first non-indented line.

A second helper `danglingSkills(agents: { name: string; text: string }[], registered: readonly string[]): string[]` returns `"<agent>: <skill>"` for each missing entry. The real guard asserts `toEqual([])` and also asserts at least one skill entry was checked (non-vacuous). A synthetic test feeds an in-memory agent with `skills:\n  - missing-skill` and asserts `['broken: missing-skill']`, which proves the failure path and the message naming agent and skill without mutating the catalog.

`registered` comes from the parsed `catalog.json` `items.skills` (the proposal and spec name `items.skills`), not from `catalog.skills`.

**Alternatives considered**:

- Reuse `parseAgent` output: `AgentItem` has only `name`, `description`, `bytes`; `skills` is not exposed. Adding it is a `src/` change, out of scope.
- `readFrontmatter(text, file, { allowNested: true, mappings: ['skills'] })`: `readBlockMapping` reads one level of `key: value` mapping, but `skills:` is a top-level block sequence (`- item`), so it returns an issue ("has a line that is not 'key: value'"). With `allowNested` only, `skills` lands in `opaque`, unparsed.
- A full YAML parser dependency for tests: new dependency for a five-line need.
- Reading files from `catalog/agents/` directly: would also check unregistered files, which the loader already reports as issues; the loaded set is the shipped set.

**Rationale**: Zero `src/` change, strict and explicit about the only form bundled agents use, fails loudly on any other form, and the synthetic case gives a deterministic proof that the guard can fail.

### Decision: Content-contract test phrases

**Choice**: A new `it('keeps the docs-writer agent content contract')` mirroring the `socratic-challenger` test:

- Frontmatter: 5 non-empty lines; `lines[0] === 'name: docs-writer'`; description non-empty, `not.toMatch(/: |['"|]/)`, contains `docs-writing`, `documentation` and `code comments`, and does not match `/pull request|commit message|instruction file/i`; `skills:` line equals `['skills:']`; list items equal `['  - docs-writing']`; one `tools:` line; no block-scalar header.
- Tools: sorted set equals `['Edit', 'Glob', 'Grep', 'Read', 'Write']`; tools line contains none of `Bash`, `*`, `mcp__`.
- Body contains `## Requirements` and each of these exact substrings:
  - `Follow its rules`
  - `stop and report that it must be installed`
  - `Do not improvise a documentation style`
  - `Use Edit and Write only on documentation files and on comments or JSDoc inside source files`
  - `only write documentation and comments`
  - `Never change code logic, configuration or tests`
  - `agent instruction files`
  - `pull request text or commit messages`
  - ``cannot run docs generators, check scripts or `git diff` ``
  - `ask the caller to run it`
  - `report it as not run`
  - `ask the caller to provide the diff`
  - `Never claim that generated documentation is in sync`
  - `Never hand-edit generated output`
- Raw file does not match `/shitaku/i` and does not contain `Co-Authored-By`.

**Alternatives considered**: extracting a shared `expectAgentContract` helper for all three agents (refactors passing tests outside scope; `pr-creator` has a different tools/MCP shape); asserting whole paragraphs (brittle against harmless rewording).
**Rationale**: One short, exact phrase per spec requirement makes regressions visible while leaving the surrounding prose editable. The apply phase must write the body so these substrings appear verbatim.

### Decision: Strict TDD ordering and commits

**Choice**:

1. RED: in `bundled-catalog.test.ts` update the three agent arrays (`items.agents` to `['pr-creator', 'socratic-challenger', 'docs-writer']`; directory entries to `['docs-writer.md', 'pr-creator.md', 'socratic-challenger.md']`; loaded names to `['pr-creator', 'socratic-challenger', 'docs-writer']`, the loader iterates `items.agents` order), add the docs-writer contract test, and add the D guard synthetic test before the helpers exist; add the `docs-writer` row to `program.test.ts` list output. Run `pnpm test` and record the failures (array mismatches, ENOENT on the agent file, missing list row, missing helper).
2. Add `agentSkills`/`danglingSkills` and the real guard; the guard passes for the two existing agents and the synthetic case passes.
3. GREEN: create `catalog/agents/docs-writer.md` and register it in `catalog.json` together (registering first would make the loader report a missing file). Run `pnpm test` to green.
4. Update the CONTRIBUTING sentence. Run `pnpm run typecheck`, `lint`, `format:check`. Commit `feat(catalog): add docs-writer agent`.
5. Run `pnpm run docs:catalog` and `pnpm run docs:website-catalog`, then both `:check` variants. Commit `docs: list docs-writer agent in README and website`.
6. `pnpm run build`, then `node dist/main.js init --agents docs-writer --scope project --dry-run` and confirm a `create` for `./.claude/agents/docs-writer.md`.

**Alternatives considered**: one commit (mixes authored and generated diff, harder to review); generating docs before tests are green (generators read the catalog; a broken agent would produce wrong pages).
**Rationale**: Matches `strict_tdd: true` in `openspec/config.yaml` and the proposal's two-commit delivery.

### Decision: CONTRIBUTING wording

**Choice**: Replace "The bundled catalog ships two agents: ..." with a count-free list: "The bundled catalog ships these agents: `pr-creator`, ...; `socratic-challenger`, ...; and `docs-writer`, which applies the `docs-writing` skill without a shell and writes only documentation and code comments; install behavior tests still use fixtures."
**Alternatives considered**: "ships three agents" (goes stale on the next agent, which is exactly the current bug).
**Rationale**: Accurate with three agents and does not need editing when a fourth is added.

## Data Flow

    catalog/catalog.json (items.agents, items.skills)
              │
              ▼
    FolderCatalogSource.load() ──→ parseAgent(stem, bytes) ──→ AgentItem{name, description, bytes}
              │                                                       │
              │ (install: bytes copied verbatim)                      │ (test only)
              ▼                                                       ▼
    ./.claude/agents/docs-writer.md                 agentSkills(decode(bytes)) ──→ danglingSkills(..., items.skills)
                                                                                   └─→ expect([])

    scripts/generate-catalog-table.mjs     ──→ README.md agents table
    scripts/generate-website-catalog.mjs   ──→ website/src/content/docs/{en,es}/catalog/agents/docs-writer.md

## File Changes

| File                                                        | Action    | Description                                                                                                           |
| ----------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `catalog/agents/docs-writer.md`                             | Create    | Agent frontmatter and body per the decisions above                                                                    |
| `catalog/catalog.json`                                      | Modify    | `items.agents` becomes `["pr-creator", "socratic-challenger", "docs-writer"]`                                         |
| `test/adapters/catalog/bundled-catalog.test.ts`             | Modify    | Three agent arrays, docs-writer contract test, `agentSkills`/`danglingSkills` helpers, real and synthetic guard tests |
| `test/adapters/cli/program.test.ts`                         | Modify    | Add `/^ {2}docs-writer\s+\S/` row assertion next to line 1587                                                         |
| `CONTRIBUTING.md`                                           | Modify    | Agents sentence at line 221, count-free list of three agents                                                          |
| `README.md`                                                 | Generated | `pnpm run docs:catalog` adds the agents table row                                                                     |
| `website/src/content/docs/en/catalog/agents/docs-writer.md` | Generated | `pnpm run docs:website-catalog`                                                                                       |
| `website/src/content/docs/es/catalog/agents/docs-writer.md` | Generated | `pnpm run docs:website-catalog` (plus any generated index pages it updates)                                           |

No `src/`, `catalog/skills/`, `catalog/profiles/` changes.

## Interfaces / Contracts

Test-local only (not exported, not in `src/`):

```ts
/** Skill names from a top-level `skills:` block sequence; [] when absent; throws on any other form. */
function agentSkills(text: string): string[];

/** "<agent>: <skill>" for every agent skill missing from `registered`. */
function danglingSkills(agents: readonly { name: string; text: string }[], registered: readonly string[]): string[];
```

## Testing Strategy

| Layer                         | What to Test                                                                         | Approach                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Unit (repo guard)             | `agentSkills` and `danglingSkills` detect a dangling preload                         | Synthetic in-memory agent text, expect `['broken: missing-skill']`                  |
| Integration (bundled catalog) | Registration, directory entries, load order, no issues                               | Updated arrays in `ships the bundled agents...` test                                |
| Integration (content)         | Frontmatter shape, exact tools, skills, body phrases, no project name or attribution | New `keeps the docs-writer agent content contract` test                             |
| Integration (repo guard)      | Every bundled agent's skills exist in `items.skills`, non-vacuous                    | Loaded agents + `catalog.json`                                                      |
| CLI                           | `list` shows the new agent                                                           | `program.test.ts` row regex                                                         |
| Docs                          | Generated pages in sync                                                              | `docs:catalog:check`, `docs:website-catalog:check`                                  |
| Smoke                         | Dry-run plans `create`                                                               | `node dist/main.js init --agents docs-writer --scope project --dry-run` after build |

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The agent itself deliberately has no `Bash`; its Edit/Write scope is a prompt-level restriction (accepted residual risk, asserted by the contract test).

## Migration / Rollout

No migration required. Existing installs are unaffected; users opt in with `init --agents docs-writer`.

## Open Questions

- [ ] Confirm whether issue #280 already covers agent-to-skill dependency resolution (approaches B/C) before filing a follow-up. Non-blocking.

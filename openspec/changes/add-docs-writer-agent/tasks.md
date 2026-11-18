# Tasks: Add docs-writer Catalog Agent (issue #126)

Strict TDD (`strict_tdd: true`, runner `pnpm test`). Order follows the design. Tasks are sequential unless marked otherwise.

## Review Workload Forecast

- Delivery strategy: ask-on-risk. Review policy: 400 changed lines.
- Estimated authored lines: about 105-170 (tests ~70-90, agent file ~50, CONTRIBUTING ~3, catalog.json 1, program.test 1-2). Generated README/website pages are excluded from the authored count.
- Risk: low. Single PR, no chaining needed, under the 400-line budget.
- Commits: two (1) `feat(catalog): add docs-writer agent`, (2) `docs: list docs-writer agent in README and website`.

## Phase 1: RED (tests first)

- [x] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, update the three agent arrays: `items.agents` to `['pr-creator', 'socratic-challenger', 'docs-writer']`; directory entries to `['docs-writer.md', 'pr-creator.md', 'socratic-challenger.md']`; loaded names to `['pr-creator', 'socratic-challenger', 'docs-writer']`. (Spec: Bundled registration and valid agent file)
- [x] 1.2 In the same file add `it('keeps the docs-writer agent content contract')` mirroring the `socratic-challenger` test: 5 non-empty frontmatter lines, `name: docs-writer`, plain description (no `: `, quotes, `|`, contains `docs-writing`, `documentation`, `code comments`, no `pull request|commit message|instruction file`), `skills:` block with `  - docs-writing`, tools set equals `Read, Grep, Glob, Edit, Write` with no `Bash`, `*`, `mcp__`, all 14 exact body substrings from the design, no `/shitaku/i`, no `Co-Authored-By`. (Spec: description, tools, skills, stop-and-report, write scope, no-Bash, generic content)
- [x] 1.3 In the same file add the synthetic guard test calling `danglingSkills` with an in-memory agent `skills:\n  - missing-skill` and expecting `['broken: missing-skill']` (helper not yet defined). (Spec: Dangling preload detected)
- [x] 1.4 In `test/adapters/cli/program.test.ts` add the `/^ {2}docs-writer\s+\S/` list-row assertion next to the existing agent rows (near line 1587). (Spec: Bundled load succeeds)
- [x] 1.5 Run `pnpm test`; record the expected failures (array mismatches, ENOENT on the agent file, missing list row, missing helper).

## Phase 2: Guard helpers (D)

- [x] 2.1 In `bundled-catalog.test.ts` add test-local `agentSkills(text)` (no `skills:` returns `[]`; inline value throws `unsupported skills form in frontmatter`; list items must match `^\s+- ([a-z0-9-]+)\s*$` else throw) and `danglingSkills(agents, registered)`. (Spec: Bundled agent skills reference catalog skills)
- [x] 2.2 Add the real guard test: iterate `new FolderCatalogSource(catalogRoot, 'bundled').load()` agents, compare against `catalog.json` `items.skills`, assert `toEqual([])` and that at least one skill entry was checked (non-vacuous).
- [x] 2.3 Run `pnpm test`; the synthetic and real guard pass for the existing agents, and the other RED failures remain.

## Phase 3: GREEN

- [x] 3.1 Create `catalog/agents/docs-writer.md`: the five-line frontmatter from the design and the body sections (intro, `## Requirements`, `## How you work`, `## Write scope`, `## Without a shell`, `## Output`, `## Never`), 45-60 lines, generic, with every contract substring verbatim, no project name, no attribution. (Spec: all agent content requirements)
- [x] 3.2 Register `docs-writer` in `catalog/catalog.json` `items.agents` after `socratic-challenger`, in the same step as 3.1 (registering first makes the loader report a missing file).
- [x] 3.3 Run `pnpm test` until green.

## Phase 4: CONTRIBUTING and first commit

- [x] 4.1 In `CONTRIBUTING.md` (around line 221) replace "The bundled catalog ships two agents: ..." with the count-free sentence from the design listing `pr-creator`, `socratic-challenger` and `docs-writer`. (Spec: CONTRIBUTING updated)
- [x] 4.2 Run `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm test`.
- [x] 4.3 Confirm `src/`, `catalog/skills/docs-writing/SKILL.md` and `catalog/profiles/` are unchanged (`git diff --stat`). (Spec: No src changes)
- [x] 4.4 Commit: `feat(catalog): add docs-writer agent` (do not bypass hooks).

## Phase 5: Generated docs and second commit

- [x] 5.1 Run `pnpm run docs:catalog` and `pnpm run docs:website-catalog`.
- [x] 5.2 Review the generator diff: README agents table row plus `website/src/content/docs/{en,es}/catalog/agents/docs-writer.md` (and any index pages); nothing unrelated changed.
- [x] 5.3 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass. (Spec: Generated docs in sync)
- [x] 5.4 Commit: `docs: list docs-writer agent in README and website`.

## Phase 6: Smoke and follow-up

- [x] 6.1 Run `pnpm run build`, then `node dist/main.js init --agents docs-writer --scope project --dry-run` in a scratch directory and confirm a `create` for `./.claude/agents/docs-writer.md` with no files written. (Spec: Installable create when absent)
- [x] 6.2 Check whether issue #280 already covers agent-to-skill dependency resolution (approaches B/C), for example with `gh issue view 280`. Only if it does not, propose a follow-up issue to the user; do not file it without approval. (Design open question, non-blocking; can run in parallel with any task.)

## Parallelism

- Sequential: Phase 1 -> 2 -> 3 -> 4 -> 5 -> 6.1 (each depends on the previous; 5 reads the catalog that 3 completes).
- Parallel-safe: 6.2 is independent of everything else. Within Phase 1, tasks 1.1-1.4 touch two files and can be authored in any order before the single RED run in 1.5.

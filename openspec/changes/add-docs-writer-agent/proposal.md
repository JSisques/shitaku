# Proposal: Add docs-writer Catalog Agent (issue #126)

## Intent

The catalog ships the `docs-writing` skill (merged in #125) but no agent that applies it. Issue #126 asks for a `docs-writer` Claude Code sub-agent that writes and updates documentation (README sections, guides, code comments and JSDoc) following the `docs-writing` skill. It gives users a ready-made documentation sub-agent and becomes the third bundled agent, next to `pr-creator` and `socratic-challenger`.

Two known gaps shape the change:

- The installer has no agent-to-skill dependency resolution. If `docs-writing` is not installed, the `skills:` preload is silently ignored by Claude Code.
- The `docs-writing` skill assumes `git diff` and running docs generators or check scripts, which need `Bash`; the agent is least-privilege and does not get `Bash`.

## Scope

### In Scope

- `catalog/agents/docs-writer.md`:
  - Single-line `name: docs-writer` and a single-line plain-scalar `description` (no `: `, no quotes, no `|`) that states what the agent does and that it requires the `docs-writing` skill. It must not overpromise: the skill excludes PR text, commit messages and agent instruction files.
  - Frontmatter `tools: Read, Grep, Glob, Edit, Write` (no `Bash`, no `mcp__*`) and a `skills:` block list with `docs-writing`.
  - Generic English body (no repository-specific names, no project name, no attribution).
- Body behavior:
  - `## Requirements` section: if the `docs-writing` rules are not in context, stop and report that the skill must be installed; do not improvise a documentation style.
  - Follow the `docs-writing` skill's rules.
  - Prompt-level write restriction: Edit/Write only on documentation files and on comments/JSDoc inside source files; never change behavior (code logic, configuration, tests), never edit agent instruction files, PR text or commit messages.
  - No-Bash limitation: the agent cannot run docs generators, check scripts or `git diff`. It asks the caller to run them (or to provide the diff), or reports them as not run. It never claims generated docs are in sync.
- Register `docs-writer` in `catalog/catalog.json` -> `items.agents`.
- Tests first (strict TDD, `pnpm test`) in `test/adapters/catalog/bundled-catalog.test.ts`:
  - Update the three hard-coded agent arrays (registry, `catalog/agents/` entries, loaded agent names) to include `docs-writer`.
  - Add a content-contract test mirroring the `socratic-challenger` one: frontmatter name and single-line description, exact `tools` (`Edit, Glob, Grep, Read, Write` as a set, no `Bash` or `mcp__`), `skills` lists `docs-writing`, body contains the Requirements stop-and-report rule, the docs/comments-only write rule and the no-Bash "ask the caller / never claim in sync" rule, and contains neither `shitaku` nor `Co-Authored-By`.
  - Approach D guard: a test asserting that every `skills:` entry of every bundled agent exists in `catalog.json` `items.skills`. It covers the existing agents too, preventing dangling preloads.
- `test/adapters/cli/program.test.ts`: update the agents rows of the list-output assertion (~line 1586).
- `CONTRIBUTING.md` agents section (~line 221): reword "ships two agents" so it stays accurate with three.
- Regenerate docs: `pnpm run docs:catalog` (README agents table) and `pnpm run docs:website-catalog` (website en/es pages); verify with the `:check` variants. Never hand-edit generated output.

### Out of Scope

- Approaches B and C: agent-to-skill dependency resolution in `init` (auto-install or install-time warning). Cross-cutting (schema, plan, init, undo/uninstall, prompts). To be proposed as a follow-up issue; check first whether existing issue #280 already covers it.
- Any change to `catalog/skills/docs-writing/SKILL.md`.
- Any `src/` change (`parseAgent` already passes `tools` and `skills` through unvalidated).
- Adding the agent to any profile.
- Hard enforcement of the Edit/Write path restriction (Claude Code allowlists grant whole tools, not paths).

## Capabilities

### New Capabilities

- `docs-writer-agent`: catalog-bundled `docs-writer` agent content (frontmatter, least-privilege tools without Bash, `docs-writing` skill preload and documented requirement, docs/comments/JSDoc-only write scope, no-Bash handling of generators and diffs, never claiming docs in sync) and installability acceptance.

### Modified Capabilities

- `catalog`: new requirement that every bundled agent's `skills:` entries reference skills registered in the catalog `items.skills` (approach D guard). If the spec phase finds this belongs better as a repository test-guard requirement than a catalog behavior requirement, it may fold it into `docs-writer-agent`; record the choice.

`agents-install`, `pr-creator-agent` and `socratic-challenger-agent` requirements are unchanged.

## Approach

Approach A + D (user decision).

- **A, content only**: mirror the archived `add-socratic-challenger-agent` change. One agent file, one registry entry, tests first, regenerated docs, one CONTRIBUTING sentence, no code. The skill requirement is documented, not installed: description mention plus `## Requirements` stop-and-report rule. Least privilege for Edit/Write and the no-Bash limitation are instruction-level, and the content-contract test asserts the wording so it cannot silently regress.
- **D, test guard**: a repository test cross-checking every bundled agent's frontmatter `skills:` against `items.skills`. Zero runtime code; catches typos or removed skills at CI time. It does not solve user-side missing installs (that is B/C).

Delivery: one PR, two Conventional Commits:

1. `feat(catalog): add docs-writer agent` (agent file, catalog.json, tests including the D guard, program.test update, CONTRIBUTING sentence).
2. `docs: list docs-writer agent in README and website` (generated pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and docs only.

| Area                                                             | Impact    | Description                                                       |
| ---------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `catalog/agents/docs-writer.md`                                  | New       | Agent frontmatter and body                                        |
| `catalog/catalog.json`                                           | Modified  | `items.agents` gains `docs-writer`                                |
| `test/adapters/catalog/bundled-catalog.test.ts`                  | Modified  | Three agent arrays, new content-contract test, agent-skills guard |
| `test/adapters/cli/program.test.ts`                              | Modified  | List-output agent rows                                            |
| `CONTRIBUTING.md`                                                | Modified  | Agents section sentence (~line 221)                               |
| `README.md`                                                      | Generated | Agents catalog table                                              |
| `website/src/content/docs/{en,es}/catalog/agents/docs-writer.md` | Generated | Website agent pages                                               |
| `src/`, `catalog/skills/docs-writing/`, `catalog/profiles/`      | Unchanged | No code, skill or profile change                                  |

## Risks

| Risk                                                                          | Likelihood      | Mitigation                                                                                             |
| ----------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| Hard-coded agent arrays in tests break                                        | High (expected) | Update them first as the RED step                                                                      |
| Stale generated README/website docs fail CI                                   | Low             | Run both docs scripts and their `:check` variants                                                      |
| Edit/Write misused beyond docs and comments (allowlist cannot restrict paths) | Med             | Explicit body rule asserted by the content test; residual risk accepted (instruction, not guarantee)   |
| Skill steps need Bash (generators, `git diff`) the agent lacks                | Med             | Body tells the agent to ask the caller to run them or report them as not run; never claim docs in sync |
| `docs-writing` not installed, so the preload silently does nothing            | Med             | Description mention plus Requirements stop-and-report; follow-up issue for B/C                         |
| Description overpromises (PR text, commit messages, agent instruction files)  | Low             | Keep description to documentation and code comments; body excludes the skill's out-of-scope artifacts  |
| Description breaks the plain YAML scalar                                      | Low             | Content test asserts a single-line description; avoid `: `, quotes and `                               | `   |
| D guard parses agent frontmatter differently from `parseAgent`                | Low             | Design phase decides whether the guard reuses the loaded catalog agents or reads frontmatter directly  |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/agents/docs-writer.md`, the `catalog.json` entry, the test changes (arrays, content test, D guard), the `program.test.ts` rows, the CONTRIBUTING sentence and the generated README/website pages (or rerun the docs scripts after the revert). The D guard can be reverted independently if it proves noisy; it has no runtime effect. No `src/`, manifest or migration impact. Users who installed the agent run `shitaku uninstall docs-writer` or `shitaku undo`.

## Dependencies

- Shipped agents capability (specs `catalog` and `agents-install`).
- Existing `docs-writing` skill catalog item (#125; runtime requirement for users, not a build dependency).

## Success Criteria

- [ ] Updated and new `bundled-catalog.test.ts` tests observed RED, then GREEN; catalog loads with no issues and `catalog.agents` includes `docs-writer` alongside `pr-creator` and `socratic-challenger`.
- [ ] The agent-skills guard passes for all bundled agents and fails when an agent lists a skill absent from `items.skills`.
- [ ] `pnpm run build` then `node dist/main.js init --agents docs-writer --scope project --dry-run` plans a `create` for `./.claude/agents/docs-writer.md`.
- [ ] Frontmatter: `name: docs-writer`, single-line description mentioning the `docs-writing` requirement, `tools: Read, Grep, Glob, Edit, Write` (no `Bash`), `skills` lists `docs-writing`.
- [ ] Body: Requirements stop-and-report rule, follows the skill, docs/comments/JSDoc-only writes, asks the caller to run generators and diffs and never claims docs in sync; no `shitaku` and no `Co-Authored-By`.
- [ ] CONTRIBUTING agents section is accurate with three bundled agents.
- [ ] `docs:catalog:check` and `docs:website-catalog:check` pass.
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run build` pass; no `src/` changes.
- [ ] Follow-up issue for agent-to-skill dependency resolution (B/C) is proposed, or confirmed as already covered by #280.

## Review Workload Forecast

Authored lines: agent file ~50-80, catalog entry ~1, tests ~50-80 (arrays, content test, D guard), program.test ~2-4, CONTRIBUTING ~2; total ~105-170 (generated README/website pages excluded). Single PR, two commits.

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

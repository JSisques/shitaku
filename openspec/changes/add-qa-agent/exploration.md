# Exploration: add-qa-agent (issue #44)

Full copy also in Engram `sdd/add-qa-agent/explore`.

## Current state

- Agents are single `.md` files validated by `src/domain/catalog/agent.ts` (`name` and `description` required, `name` equals file stem, other frontmatter passes through).
- Bundled agents: `pr-creator`, `socratic-challenger` (`catalog/catalog.json` `items.agents`).
- House pattern pinned by tests: 5 frontmatter lines, plain one-line description, `tools:` with no Bash / `*` / stray `mcp__`, `skills:` list, body sections `## Requirements`, an output section, `## Never`; no `/shitaku/i`, no `Co-Authored-By`.
- `catalog/mcps/playwright.json` exists. No test-map / impact-radius scripts, no router, no `shitaku new` in the repo.
- Closest precedent: `openspec/changes/archive/2026-11-18-add-socratic-challenger-agent/`.

## Scope classification

| Item in #44                                                 | Realistic in a single `.md` change                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| Agent file + catalog registration + schema validation       | Yes                                                                    |
| `init` install / `undo` revert                              | Yes (already generic)                                                  |
| README listing                                              | Yes (generated via `pnpm run docs:catalog`)                            |
| Test per bug, missing tests = failed gate, edge-case review | Yes, as prompt instructions                                            |
| Playwright behavioural regression                           | Partial: optional, report unavailable if MCP absent; verify tool names |
| Snapshot baselines                                          | Instruction-level only                                                 |
| Test-map / impact-radius                                    | Not buildable; heuristic (mirrored paths, importers)                   |
| `shitaku new` phase, 3-retry rule, router #244              | Out of scope (no infra)                                                |

## Affected areas

- `catalog/agents/<name>.md` (new), `catalog/catalog.json`
- `test/adapters/catalog/bundled-catalog.test.ts` (3 hard-coded arrays + contract test)
- `test/adapters/cli/program.test.ts` (list output assertion)
- `CONTRIBUTING.md` (agents sentence, guarded by `test/agents-docs.test.ts`)
- `README.md`, `website/src/content/docs/{en,es}/catalog/agents/<name>.md` (generated)

## Approaches

1. Content-only agent (recommended): ~110-160 lines, no `src/` change, two commits like the precedent.
2. Agent + new QA skill: more surface, exceeds "single .md".
3. Agent + test-map/impact-radius scripts: likely busts the 400-line budget.

## Risks

- Aspirational acceptance criteria: the agent must never claim a gate it could not run.
- Tools allowlist: Bash (to run tests) conflicts with the precedent's "no Bash" pin.
- Playwright `mcp__playwright__*` names unverified; server uses `@playwright/mcp@latest`.
- MCP is not auto-installed with the agent (documented only).
- Do not add the agent to any profile (#285).

## Decision gaps

1. Agent name (`qa`, `qa-reviewer`, `qa-agent`).
2. Tools (Bash, Write/Edit, Playwright).
3. Approach 1 vs 2.
4. Deferred acceptance items: follow-up issues vs comment on #44; PR `Refs` vs `Closes`.
5. Review-only vs may write test files.

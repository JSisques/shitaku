# Exploration: pr-creator agent (issue #235)

Source: Engram `sdd/add-pr-creator-agent/explore` (obs 1648) and `sdd/add-pr-creator-agent/decisions` (obs 1651).

## Findings

- Agent infrastructure already exists (archived change `catalog-add-agents`). `parseAgent` validates only `name`, `description` and a non-empty body; other frontmatter keys (including `tools` and `skills`) pass through verbatim.
- There is no cross-item dependency handling: installing an agent does NOT install the `pr-writing` skill or the `github` MCP.
- `items.agents` in `catalog/catalog.json` is empty; `catalog/agents/` only holds `.gitkeep`.
- Adding an agent requires a `catalog.json` entry and regenerated docs: `pnpm run docs:catalog` (README table) and `pnpm run docs:website-catalog` (website en/es pages under `website/src/content/docs/{en,es}/catalog/agents/`).
- CONTRIBUTING.md (agents section, ~line 220) says "The bundled catalog ships no agent yet, so tests use fixtures"; this becomes stale.
- The `github` MCP catalog item is a remote HTTP server (`https://api.githubcopilot.com/mcp/`). Claude Code exposes its tools as `mcp__github__<tool>` (for example `mcp__github__create_pull_request`) when the server is registered under the key `github`.
- `test/adapters/catalog/bundled-catalog.test.ts` asserts profiles resolve `agents: []`; adding the agent to a profile would change that test.

## Tension

The issue frontmatter proposes `tools: Read, Grep, Glob`, but opening a PR needs the GitHub MCP. Options considered:

1. Add `mcp__github__*` tools to the allowlist (recommended).
2. Omit `tools` (inherit all tools, including Bash).
3. Use `mcpServers` frontmatter.

## Decisions (user-approved, obs 1651)

1. `tools` = Read, Grep, Glob + GitHub MCP tools (`mcp__github__*`); no Bash. Tool names are inferred and must be verified against the live server or its docs before pinning.
2. The `pr-writing` skill and `github` MCP requirement is documented only (agent body/description and docs); dependency resolution is a follow-up issue.
3. Wiring into `shitaku new` (#226) is out of scope.
4. The agent asks for explicit confirmation before opening the PR, per the `pr-writing` skill.

## Affected areas

`catalog/agents/pr-creator.md` (new), `catalog/catalog.json`, `README.md`, `website/src/content/docs/{en,es}/catalog/agents/`, `CONTRIBUTING.md`, `test/adapters/catalog/bundled-catalog.test.ts`.

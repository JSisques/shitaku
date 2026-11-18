# Proposal: Add pr-creator Catalog Agent (issue #235)

## Intent

The catalog supports agents (archived change `catalog-add-agents`) but ships none, so the feature has no real example and users get no ready-made sub-agent. Issue #235 asks for a `pr-creator` Claude Code sub-agent that drafts a pull request with the `pr-writing` skill conventions and opens or edits it through the `github` MCP. It is the first bundled agent and shows how a least-privilege agent combines a catalog skill with a catalog MCP.

## Scope

### In Scope

- `catalog/agents/pr-creator.md`: single-line `name: pr-creator`, single-line `description`, non-empty English body, generic (no repository-specific names).
- Frontmatter `tools`: `Read, Grep, Glob` plus an explicit list of GitHub MCP tools (`mcp__github__<tool>`). No `Bash`. The design phase pins the exact tool names (see Tool names below).
- Body behavior: follow the `pr-writing` skill rules (Conventional Commits title, PR template first, no invented labels, reviewers, milestones or issues); collect context through Read/Grep/Glob and GitHub MCP read tools; present the draft and ask for explicit confirmation before calling the PR creation tool. Edit mode: when an open PR already exists for the head (or the caller names a PR number), read it with `pull_request_read`, draft the proposed changes as a diff against the current values, and call `update_pull_request` only after explicit confirmation. Create opens ready for review (`draft: false`) unless the caller asks for a draft; edit changes `draft` only when explicitly asked. The agent never sets `state` (no closing or reopening) nor `maintainer_can_modify`.
- State the requirements in the description/body: the `pr-writing` skill and the `github` MCP must be installed, and the head branch must already be pushed.
- Register `pr-creator` in `catalog/catalog.json` -> `items.agents`.
- Tests first (strict TDD, `pnpm test`): extend `test/adapters/catalog/bundled-catalog.test.ts` with a registered-agent test (`items.agents` equals `['pr-creator']`, `catalog/agents/` entries, loads without issues) and a small content-contract test (frontmatter name, `tools` without `Bash`, presence of a few load-bearing tokens such as `pr-writing`, `mcp__github__` and a confirmation rule).
- Regenerate docs: `pnpm run docs:catalog` (README), then `pnpm run docs:website-catalog` (website en/es); verify with the `:check` scripts.
- CONTRIBUTING.md agents section (~line 220): replace "The bundled catalog ships no agent yet, so tests use fixtures" with a sentence that names `pr-creator` as the bundled example.
- Record in the PR description the divergence from the issue frontmatter (`tools: Read, Grep, Glob` in the issue vs. Read, Grep, Glob plus GitHub MCP tools here) and why.

### Out of Scope

- Dependency resolution between catalog items (installing the agent does not install `pr-writing` or `github`). Propose a follow-up issue.
- Wiring into `shitaku new` (#226); that command does not exist yet.
- Adding the agent to any profile (would change the profile assertions in `bundled-catalog.test.ts`).
- Any change to `catalog/skills/pr-writing/SKILL.md` or `catalog/mcps/github.json`.
- Any `src/` change.
- Pushing branches or running `git`/`gh` from the agent.
- Closing, reopening or merging a PR, and applying labels, reviewers or milestones not supported by `update_pull_request` (labels and milestones stay suggested metadata only).

### Tool names

The tool names were verified on 2026-11-18 against the `github/github-mcp-server` README (design records the sources). The set is `create_pull_request`, `update_pull_request` (params: owner, repo, pullNumber; optional title, body, state, base, draft, reviewers, maintainer_can_modify; no label or milestone), `pull_request_read` (owner, repo, pullNumber, method `get`, `get_diff`, `get_files`, `get_commits`, ...), `list_commits`, `get_commit`, `get_file_contents`, `list_branches`, `search_pull_requests`, `list_issues` / `issue_read` and `list_label` (labels toolset). Claude Code prefixes them with the server key: `mcp__github__<tool>`. The list stays explicit (no wildcard) for least privilege.

### Getting the diff without Bash

For an already open PR, the agent prefers `pull_request_read` (`get_diff`, `get_files`). The GitHub MCP has no "compare base...head" tool for an unopened PR, so there the agent gets the change from: (1) `list_commits` on the pushed head branch plus `get_commit` (which returns per-file patches), (2) `get_file_contents` and local Read/Grep/Glob for templates, `CODEOWNERS` and commitlint config, and (3) a summary or diff passed by the caller. Unpushed local changes are invisible to the agent; the body tells the caller to push first or pass the diff.

## Capabilities

### New Capabilities

- `pr-creator-agent`: catalog-bundled `pr-creator` agent content (frontmatter, least-privilege tools without Bash, pr-writing conventions, confirmation before creating or editing the PR, no state changes, documented requirements) and installability acceptance.

### Modified Capabilities

None. Install, list and validation behavior stay under the existing `catalog` and `agents-install` specs; the CONTRIBUTING sentence is documentation only.

## Approach

Mirror the archived `add-docs-writing-skill` change: one catalog data file, one registry entry, tests first, generated docs, no code. The agent body maps the `pr-writing` execution steps (which use `git`/`gh`) to the allowed tools: Read/Grep/Glob for local files, GitHub MCP read tools for base branch, commits, labels and issues, and `create_pull_request` or `update_pull_request` only after the caller relays explicit user confirmation. Because a sub-agent cannot talk to the user directly, the agent returns the draft (or the proposed edit as a diff) and stops; it writes only when invoked again with the literal confirmation line (`CONFIRMED: create pull request` or `CONFIRMED: update pull request #<number>`) and the approved values.

Delivery: one PR, two Conventional Commits:

1. `feat(catalog): add pr-creator agent` (agent file, catalog.json, tests, CONTRIBUTING sentence).
2. `docs: list pr-creator agent in README and website` (generated pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and docs only.

- New: `catalog/agents/pr-creator.md` (agent frontmatter and body).
- Modified: `catalog/catalog.json` (`items.agents: ["pr-creator"]`).
- Modified: `test/adapters/catalog/bundled-catalog.test.ts` (registered agent and content-contract tests).
- Modified: `CONTRIBUTING.md` (agents section sentence, ~line 220).
- Generated: `README.md` agents table and `website/src/content/docs/{en,es}/catalog/agents/pr-creator.md`.
- Unchanged: `src/`, `catalog/skills/pr-writing/`, `catalog/mcps/github.json`.

## Risks

- **Wrong or renamed GitHub MCP tool names** (Med): the agent cannot act. Mitigation: verify names in design against current server docs and record the source.
- **MCP registered under a key other than `github`** (Low): tool prefixes differ. Mitigation: document that names assume the shitaku `github` item key.
- **Unpushed changes are invisible without Bash** (Med). Mitigation: the body requires a pushed head branch or a caller-provided diff.
- **`pr-writing` steps reference `git`/`gh`** (Med), which the agent cannot run. Mitigation: the body maps each step to MCP or file tools; the existing "gh unavailable" gate covers labels and milestone.
- **A sub-agent cannot ask the user directly** (Med), so confirmation could be skipped. Mitigation: two-step contract; return the draft and stop, and create or edit only on an explicitly confirmed re-invocation.
- **`update_pull_request` could close or reopen a PR or change `maintainer_can_modify`** (Med): the allowlist cannot restrict parameters. Mitigation: instruction-level rule that the agent never sets `state` nor `maintainer_can_modify`, asserted by the content test; residual risk accepted (an instruction, not a hard guarantee). Edit also needs the exact confirmation line and only the approved fields.
- **`pr-writing` or `github` missing after install** (Med). Mitigation: documented requirement and a follow-up issue for dependency resolution.
- **Docs CI drift** (Low). Mitigation: run both docs scripts and their `:check` variants.

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/agents/pr-creator.md`, the `catalog.json` entry, the test additions, the CONTRIBUTING sentence and the generated README/website pages (or rerun the docs scripts after revert). No `src/`, manifest or migration impact. Users who installed the agent run `shitaku uninstall pr-creator` or `shitaku undo`.

## Dependencies

- Shipped agents capability (`catalog-add-agents`, specs `catalog` and `agents-install`).
- Existing `pr-writing` skill and `github` MCP catalog items (runtime requirements for users, not build dependencies).

## Success Criteria

- [ ] `bundled-catalog.test.ts` agent tests observed RED, then GREEN; catalog loads with no issues and `catalog.agents` contains `pr-creator`.
- [ ] `pnpm run build` then `node dist/main.js init --agents pr-creator --scope project --dry-run` plans a `create` for `./.claude/agents/pr-creator.md`.
- [ ] Frontmatter: `name: pr-creator`, single-line description, `tools` lists Read, Grep, Glob and the verified `mcp__github__*` names (10 MCP tools, including `update_pull_request` and `pull_request_read`), no `Bash`.
- [ ] Body requires pr-writing conventions, a pushed branch or provided diff, and explicit confirmation before creating or editing the PR, never sets `state` or `maintainer_can_modify`, supports edit mode for an existing PR; mentions the `pr-writing` and `github` requirements.
- [ ] CONTRIBUTING no longer says the bundled catalog ships no agent.
- [ ] `docs:catalog:check` and the website catalog check pass.
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass; no `src/` changes.
- [ ] Follow-up issue for catalog dependency resolution is proposed; PR records the tools divergence from issue #235.

## Review Workload Forecast

Authored lines: agent file ~75-105, catalog entry ~1, tests ~35-50, CONTRIBUTING ~2; total ~115-160 (generated README/website pages excluded). Single PR, two commits.

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

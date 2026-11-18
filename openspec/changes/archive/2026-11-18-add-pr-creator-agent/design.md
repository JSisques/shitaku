# Design: Add pr-creator Catalog Agent (issue #235)

## Technical Approach

Data-only change that mirrors the archived `add-docs-writing-skill` change: one new catalog file (`catalog/agents/pr-creator.md`), one registry entry (`catalog/catalog.json` -> `items.agents`), tests first in `test/adapters/catalog/bundled-catalog.test.ts`, one CONTRIBUTING sentence, and generated README/website pages. No `src/` change: `parseAgent` (`src/domain/catalog/agent.ts`) validates only `name`, `description` and a non-empty body, and copies the file bytes verbatim, so `tools` and `skills` reach `.claude/agents/pr-creator.md` unchanged.

The agent is a least-privilege Claude Code subagent. It has `Read`, `Grep`, `Glob` and an explicit allowlist of GitHub MCP tools; it has no `Bash`, no file-writing tool and exactly two GitHub write tools (`create_pull_request`, `update_pull_request`). It preloads the `pr-writing` skill and only adapts that skill's `git`/`gh` steps to the tools it has. It works in three modes: draft mode returns a draft and stops; create mode opens the PR only when the caller re-invokes it with an explicit confirmation line and the approved values; edit mode reads an existing PR, proposes changes as a diff and updates it only on a matching confirmation line.

## Verification Status Of External Names

The design executor had no web access, so the orchestrator verified the external names on 2026-11-18 against primary sources.

- Verified in the `github/github-mcp-server` README (https://github.com/github/github-mcp-server/blob/main/README.md): `create_pull_request`, `list_pull_requests` (toolset `pull_requests`), `issue_read` (toolset `issues`), `list_branches`, `list_commits`, `get_commit`, `get_file_contents` (Repositories section). `get_commit` accepts a `detail` parameter; use `full_patch` to get per-file unified diffs.
- `list_label` exists in the `labels` toolset, which is NOT default-enabled; the agent falls back to "Not discovered" for labels when it is unavailable.
- Verified in the same README: `update_pull_request` takes owner, repo, pullNumber (required) and optional title, body, state, base, draft, reviewers, maintainer_can_modify (no labels or milestone); `pull_request_read` takes owner, repo, pullNumber and method (`get`, `get_diff`, `get_files`, `get_commits`, ...).
- No base...head compare tool exists. `pull_request_read` (`get_diff`, `get_files`) only serves an already open PR, so it is used for edit mode; an unopened PR keeps `list_commits` and `get_commit`.
- Verified in the Claude Code sub-agents docs (https://code.claude.com/docs/en/sub-agents): `tools` accepts a comma-separated string or a YAML list, and `mcp__github__*` is a documented wildcard. `skills` is documented as a YAML list; the full skill content is injected at startup, and a missing skill is skipped with a debug-log warning only.
- The explicit list stays (Decision 2) for least privilege, not because the wildcard is unsupported.

## Architecture Decisions

### Decision 1: Explicit least-privilege tool allowlist

**Choice**: `tools: Read, Grep, Glob, mcp__github__list_branches, mcp__github__list_commits, mcp__github__get_commit, mcp__github__get_file_contents, mcp__github__list_pull_requests, mcp__github__issue_read, mcp__github__list_label, mcp__github__pull_request_read, mcp__github__create_pull_request, mcp__github__update_pull_request`

- Read side: `list_branches` (head is pushed), `list_commits` and `get_commit` (the change), `get_file_contents` (template, commitlint config, `CODEOWNERS` on the base branch when not in the working tree), `list_pull_requests` (an open PR for the head already exists), `issue_read` (linked issue, its labels and milestone), `list_label` (repository labels).
- Edit side: `pull_request_read` (current title, body, base, draft state, diff and files of an existing PR).
- Write side: only `create_pull_request` and `update_pull_request`. The allowlist cannot restrict parameters, so `update_pull_request` could also set `state` or `maintainer_can_modify`; the agent body forbids that (see Decision 5, residual risk).
- Excluded on purpose: `Bash`, `Write`, `Edit`, `merge_pull_request`, `create_branch`, `push_files`, `create_or_update_file`, `issue_write`, `label_write`.

**Alternatives considered**: omit `tools` (inherits every tool, including `Bash` and every GitHub write tool); `tools: Read, Grep, Glob` as in issue #235 (cannot open a PR); `mcpServers` frontmatter (adds a second server definition and still grants the whole server).
**Rationale**: the agent can read context, create a PR and edit an existing one, nothing else. The divergence from the issue frontmatter is recorded in the PR description, as the proposal requires.

### Decision 2: No `mcp__github__*` wildcard

**Choice**: list every MCP tool by name.
**Alternatives considered**: `mcp__github__*` or the server-level `mcp__github` form.
**Rationale**: `mcp__github__*` is a documented wildcard, but it would grant every write tool of the server (merge, push, file edits), which defeats least privilege. An explicit list is reviewable and testable as an exact set.

### Decision 3: Preload the skill with a `skills` YAML list

**Choice**: add a `skills:` YAML list with one `- pr-writing` item to the frontmatter (the documented form; the issue uses the same); the body references the skill and repeats only the safety-critical rules (no invented metadata, confirmation before creation).
**Alternatives considered**: copy the skill rules into the body (duplication that drifts from `catalog/skills/pr-writing/SKILL.md`); tell the agent to `Read` the skill file (its install path differs between user and project scope).
**Rationale**: one source of truth for conventions. The key is a single-line value, so `parseAgent` passes it through; if the running Claude Code version ignores the key, the body's requirement check still stops the agent instead of improvising conventions.

### Decision 4: Diff source without Bash

**Choice**: for an existing PR, prefer `pull_request_read` `get_diff` / `get_files`. For an unopened PR, in order of preference, (1) a diff or summary passed by the caller, (2) `list_commits` on the head branch and on the base branch, keeping head commits that are not on the base, then `get_commit` for each kept commit (files and patches), (3) local `Read`/`Grep`/`Glob` for files referenced by those commits. Head existence is checked with `list_branches`; if the head is not on the remote, the agent stops and asks the caller to push it or pass the diff.
**Alternatives considered**: a compare tool (the GitHub MCP has none for an unopened PR); `Bash` with `git diff` (rejected by Decision 1).
**Rationale**: works with read-only MCP tools and states the one blind spot (unpushed commits) explicitly. Commit reading is bounded: for long branches the agent reads the most recent commits and reports which ones it skipped, so the draft never claims full coverage it does not have.

### Decision 5: Two-step confirmation contract

**Choice**: draft mode is the default and never calls a write tool. Create mode requires the literal line `CONFIRMED: create pull request` plus the approved owner, repository, base, head, title, body and draft flag in the same request; the PR opens ready for review (`draft: false`) unless the caller asks for a draft. Edit mode applies when an open PR exists for the head or the caller names a PR number: the agent reads it with `pull_request_read`, shows the proposed title, body, base, draft and reviewers as a diff against current values, and stops. It calls `update_pull_request` once, with only the approved fields, only when the request has the literal line `CONFIRMED: update pull request #<number>` plus owner, repository and pullNumber; `draft` changes only when the caller explicitly asks. The agent never sets `state` nor `maintainer_can_modify`. Any missing or different value falls back to draft behavior and names what is missing.
**Alternatives considered**: the agent asks the user directly (a subagent cannot); a single invocation that creates or edits after drafting (skips the `pr-writing` hard rule "never create or edit the PR without explicit confirmation"); a hard server-side block on `state` (not possible: the allowlist is per tool, not per parameter).
**Rationale**: each subagent invocation starts without memory of the previous one, so the confirmed request must carry the full approved values; a fixed literal token makes the gate testable and hard to trigger by a vague "open a PR". Tradeoff and residual risk: the `state` / `maintainer_can_modify` ban is an instruction, not an enforced restriction; the content test asserts the rule is in the body, but a misbehaving model could still send those parameters.

### Decision 6: Repository, base and head resolution without git

**Choice**: owner and repository from the caller, else the `remote "origin"` URL in `.git/config`; base from the caller, else `.git/refs/remotes/origin/HEAD`, else ask; head from the caller, else `.git/HEAD`. When `.git` is a file (worktree), follow its `gitdir:` pointer with `Read`, or ask.
**Alternatives considered**: a repository metadata MCP tool for the default branch (not part of the verified-candidate list); always asking.
**Rationale**: plain file reads cover the common case with the granted tools; asking is the safe fallback, and the confirmation block shows all four values to the user before anything is created.

## pr-writing Step Mapping

Each step of `catalog/skills/pr-writing/SKILL.md` "Execution Steps", from `git`/`gh` to the agent's tools:

- Step 1, base branch and change (`gh repo view`, `git symbolic-ref`, `git log`, `git diff --stat`): Decision 6 for the base; Decision 4 (`list_commits`, `get_commit`, or a caller diff) for commits and changed files.
- Step 2, PR template and commit convention (local files, recent `git log`): `Glob`/`Read` for `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/`, root and `docs/`, and commitlint config files; `get_file_contents` on the base branch when they are not in the working tree; commit messages from `list_commits` replace `git log`.
- Step 3, breaking change and linked issue: commit messages and patches from Decision 4; branch name from the head; caller statement. Read a linked issue with `issue_read`.
- Step 4 and step 5, title and body: unchanged (pure drafting).
- Step 6, metadata: labels from `list_label` when the labels toolset is enabled, else from the linked issue via `issue_read`, else "Not discovered" (same as the skill's "`gh` unavailable" gate); reviewers from `CODEOWNERS` only (git history is not readable, so the "offer git-history candidates" branch becomes "ask"); milestone from the linked issue only, else "Not discovered".
- Step 7, present and wait: draft mode output plus the confirmation block; `gh pr create` becomes `create_pull_request` in create mode, and `gh pr edit` becomes `update_pull_request` in edit mode (title, body, base, draft, reviewers only). If `list_pull_requests` finds an open PR for the head, the agent switches to edit mode.
- Metadata: labels and milestone are never applied (neither write tool supports them). Reviewers are applied only through an approved `reviewers` field in edit mode.

## Data Flow

```text
caller (main agent) ── request ──> pr-creator (draft mode)
                                     │  Read/Grep/Glob: template, commitlint, CODEOWNERS, .git/config
                                     │  github MCP reads: list_branches, list_commits, get_commit,
                                     │                    get_file_contents, list_pull_requests,
                                     │                    issue_read, list_label, pull_request_read
                                     v
caller <── draft (or edit diff) + "Confirmation required" block ── (stop)
   │
   │  user approves or edits the values
   v
caller ── "CONFIRMED: create|update pull request ..." + approved values ──> pr-creator
                                     │  values complete and identical?
                                     │    no  -> draft behavior, report what is missing
                                     │    yes -> create_pull_request or update_pull_request (once)
                                     v
caller <── PR URL + metadata suggestions to apply manually
```

Install path (unchanged code): `catalog/agents/pr-creator.md` -> `FolderCatalogSource` -> `parseAgent` -> flat copy to `./.claude/agents/pr-creator.md` (project) or `~/.claude/agents/pr-creator.md` (user).

## File Changes

- `catalog/agents/pr-creator.md`: Create. Agent frontmatter and body (contract below).
- `catalog/catalog.json`: Modify. `"agents": []` becomes `"agents": ["pr-creator"]`.
- `test/adapters/catalog/bundled-catalog.test.ts`: Modify. Two new tests (registration, content contract). The profile assertions (`agents: []`) stay unchanged because the agent joins no profile.
- `CONTRIBUTING.md`: Modify. Line 220: replace "The bundled catalog ships no agent yet, so tests use fixtures." with "The bundled catalog ships one agent, `pr-creator`, a least-privilege example that combines the `pr-writing` skill with `github` MCP tools; install behavior tests still use fixtures." The tokens guarded by `test/agents-docs.test.ts` (block scalar, issue 238 link, "not validated", "tools or permissions") are on other lines and stay.
- `README.md`: Generated by `pnpm run docs:catalog`; the agents section replaces `_No agents in the bundled catalog yet._` with a table row.
- `website/src/content/docs/en/catalog/agents/pr-creator.md` and `website/src/content/docs/es/catalog/agents/pr-creator.md`: Generated by `pnpm run docs:website-catalog`.
- Unchanged: `src/`, `catalog/skills/pr-writing/`, `catalog/mcps/github.json`, `catalog/profiles/`.

## Interfaces / Contracts

Agent file contract. Description constraints: one line, no `: ` sequence (Claude Code parses frontmatter as YAML), no quotes and no `|`. The body never names this repository or tool (generic).

```md
---
name: pr-creator
description: Drafts a pull request with the pr-writing skill and opens it through the GitHub MCP only after explicit user confirmation. Requires the pr-writing skill, the github MCP server and a pushed head branch.
tools: Read, Grep, Glob, mcp__github__list_branches, mcp__github__list_commits, mcp__github__get_commit, mcp__github__get_file_contents, mcp__github__list_pull_requests, mcp__github__issue_read, mcp__github__list_label, mcp__github__pull_request_read, mcp__github__create_pull_request, mcp__github__update_pull_request
skills:
  - pr-writing
---

You draft GitHub pull requests and open them only after explicit confirmation. The `pr-writing` skill defines every convention (title, body, PR template, breaking changes, linked issues, metadata). These instructions only adapt its steps to your tools.

## Requirements

- The `pr-writing` skill. If its rules are not in your context, stop and report that it must be installed. Do not improvise conventions.
- The GitHub MCP server registered under the key `github`, so its tools are named `mcp__github__<tool>`. If they are unavailable, stop and report it.
- A pushed head branch. You cannot run `git`, `gh` or any shell command, so unpushed commits are invisible to you. If the head branch is not on the remote, stop and ask the caller to push it or to pass the diff.

## Modes

Every invocation is independent; you remember nothing from an earlier one.

- Draft mode (default): collect context, return the draft, then stop. Never call `mcp__github__create_pull_request` in draft mode.
- Create mode: only when the request contains the line `CONFIRMED: create pull request` together with the approved owner, repository, base branch, head branch, title, body and draft flag. Call `mcp__github__create_pull_request` once with exactly those values; open it ready for review (`draft: false`) unless the caller asked for a draft. If the line or any value is missing, switch to draft mode and say what is missing. A request to "open a PR" is not a confirmation.
- Edit mode: when an open PR exists for the head or the caller names a PR number, read it with `mcp__github__pull_request_read` (`get`, then `get_diff` or `get_files`) and return the proposed changes as a diff against the current values, then stop. Only when the request contains the line `CONFIRMED: update pull request #<number>` with owner, repository, pullNumber and the approved fields, call `mcp__github__update_pull_request` once with only those fields. Change `draft` only if the caller explicitly asks. Missing or different values fall back to draft behavior.

## Draft mode steps

1. Repository and branches: ... (Decision 6), then confirm the head with `mcp__github__list_branches`.
2. Existing PR: `mcp__github__list_pull_requests` for the head, or the PR number given by the caller; if one is open, follow edit mode and use `mcp__github__pull_request_read` for its diff and files.
3. Change: for an existing PR use `mcp__github__pull_request_read`; otherwise use the caller's diff or summary when given; else `mcp__github__list_commits` (head and base) and `mcp__github__get_commit` per head-only commit. On long branches read the most recent commits and list the skipped ones.
4. Conventions: PR template, commitlint config and `CODEOWNERS` with Read, Glob and Grep; `mcp__github__get_file_contents` on the base branch when they are not local.
5. Breaking change and linked issue as the skill says; read the issue with `mcp__github__issue_read`.
6. Metadata: labels from `mcp__github__list_label` or the linked issue; reviewers from `CODEOWNERS` only, else ask; milestone from the linked issue only. Anything else goes under "Not discovered".

## Output

Draft mode: the pr-writing output contract (title in a code block, body, "Suggested metadata" with sources, "Not discovered", open questions), then a "Confirmation required" block listing owner, repository, base, head and draft flag, and the exact line the caller must send back with the approved values: `CONFIRMED: create pull request`. Then stop. In edit mode the block shows owner, repository, pullNumber and a current-versus-proposed diff of the fields, and the line to send back: `CONFIRMED: update pull request #<number>`.

Create and edit mode: the PR URL and the suggested metadata for the user to apply; you never apply labels, reviewers or milestones.

## Never

- Never push, create branches, edit files, or merge pull requests.
- Never set `state` (no closing or reopening) nor `maintainer_can_modify`.
- Never invent labels, reviewers, milestones or issue numbers.
- Never create or update a pull request without its confirmation line and the full approved values.
```

The `...` in step 1 stands for the Decision 6 resolution order written out in full. Apply may reword sentences, but these load-bearing tokens are pinned by the content test: `pr-writing`, `mcp__github__create_pull_request`, `mcp__github__update_pull_request`, `CONFIRMED: create pull request`, `CONFIRMED: update pull request #`, `state`, `maintainer_can_modify`, `pushed`, `Not discovered`.

Confirmation tokens: `CONFIRMED: create pull request` and `CONFIRMED: update pull request #<number>` (exact, case-sensitive, on their own line).

## Testing Strategy

Strict TDD with `pnpm test` (Vitest). Write both tests first and observe RED before creating the agent file or the registry entry.

- Test 1, `ships pr-creator as a registered loadable bundled agent` (RED: `items.agents` is `[]`):
  - `index.items.agents` equals `['pr-creator']`.
  - `readdirSync(join(catalogRoot, 'agents'))`, filtered of dotfiles (`.gitkeep`) and sorted, equals `['pr-creator.md']`.
  - `new FolderCatalogSource(catalogRoot, 'bundled').load()`: `issues` equals `[]`, `agents.map((a) => a.name)` equals `['pr-creator']`, description length greater than 0.
- Test 2, `keeps the pr-creator agent content contract` (RED: file missing, `readFileSync` throws `ENOENT`):
  - Split frontmatter and body with the same regex as the existing skill contract tests.
  - Frontmatter lines: `name: pr-creator`; one `description:` line with no `: ` after the key, no quotes and no `|`; a `skills:` key followed by one `  - pr-writing` list item; one `tools:` line.
  - `tools` split on `,` and trimmed equals, as a sorted set, the exact allowlist of Decision 1. This also proves no `Bash`, `Write`, `Edit` or extra GitHub write tool (the exact set has 10 MCP tools; `create_pull_request` and `update_pull_request` are the two write tools), and that every MCP entry matches `^mcp__github__[a-z_]+$`.
  - No line of the frontmatter is indented or a block scalar (single-line only).
  - Body contains `pr-writing`, `mcp__github__create_pull_request`, `mcp__github__update_pull_request`, `CONFIRMED: create pull request`, `CONFIRMED: update pull request #`, `pushed`, `Not discovered`, and the never-set rule for `state` and `maintainer_can_modify`.
  - Raw text does not match `/shitaku/i` (generic) and does not contain `Co-Authored-By`.
- Unchanged existing test: `loads without issues and resolves profiles` keeps `agents: []` for `web` and `backend`.
- Guards to run after GREEN: `test/naming.test.ts`, `test/generators.test.ts`, `test/agents-docs.test.ts` (CONTRIBUTING tokens), `test/architecture.test.ts` (no `src/` change); then the full `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`.
- Docs: `pnpm run docs:catalog` then `pnpm run docs:website-catalog`; verify with `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`.
- Install smoke check: `pnpm run build`, then `node dist/main.js init --agents pr-creator --scope project --dry-run` plans a `create` for `./.claude/agents/pr-creator.md`.
- Out of reach of automated tests: the runtime behavior of the agent (tool calls against a live GitHub MCP). It is a manual check, optional, and must not create a real PR without the user's confirmation.

## Threat Matrix

The change adds no shell, subprocess or routing code, but it ships an agent that automates PR creation, so the PR rows apply to the agent contract. Tests are content assertions on the agent file.

- Documentation-like paths: N/A. The agent file is data copied flat by existing code; no execution or classification boundary changes.
- Git repository selection: Applicable (target repository of the PR). Safe behavior: owner and repository come from the caller or `.git/config` and are shown in the confirmation block; create mode uses only the approved values. Failure behavior: missing or mismatched values fall back to draft mode. RED test: Test 2 asserts the `CONFIRMED: create pull request` token and the exact tool set.
- Commit state: N/A. The agent creates no commits and has no tool that can.
- Push state: Applicable. Safe behavior: the agent never pushes (no `Bash`, no `push_files`, no `create_branch`) and requires a pushed head, checked with `list_branches`. Failure behavior: stop and ask the caller to push or pass the diff. RED test: Test 2 exact tool set excludes push and branch tools; body contains `pushed`.
- PR commands: Applicable. Safe behavior: `create_pull_request` and `update_pull_request` are the only write tools, each called once and only with its confirmation line and the approved values; no merge tool; `state` and `maintainer_can_modify` are never set (instruction-level rule, residual risk: the allowlist cannot restrict parameters). Failure behavior: no confirmation line means draft behavior. RED test: Test 2 exact tool set (two write tools), both confirmation tokens and the `state` / `maintainer_can_modify` rule in the body.

## Commit Plan

Two work-unit commits on the feature branch, one PR, about 145 to 175 authored changed lines (generated pages excluded), under the 400-line budget.

1. `feat(catalog): add pr-creator agent`: `catalog/agents/pr-creator.md` (~85-110 lines), `catalog/catalog.json` (1 line), `test/adapters/catalog/bundled-catalog.test.ts` (~50-60 lines), `CONTRIBUTING.md` (1 line). RED observed before the agent file and the entry exist; GREEN at commit.
2. `docs: list pr-creator agent in README and website`: generated `README.md` agents section and the two website pages.

The `openspec/changes/add-pr-creator-agent/` artifacts follow the repository's existing practice (separate `docs(openspec): ...` commits, as in recent history); that is a delivery detail for the orchestrator, not part of the two work-unit commits.

## Migration / Rollout

No migration required. Rollback: revert the commits; users who installed the agent run `shitaku uninstall pr-creator` or `shitaku undo`. Follow-up issue (proposed, not in scope): dependency resolution so installing an agent can pull its required skill and MCP.

## Open Questions

- [ ] Verify the tool names and the `skills` frontmatter key against the sources listed in "Verification Status Of External Names" before commit 1 (blocking for the agent file, not for writing the tests).
- [x] Draft flag default (decided by the user): the PR opens ready for review (`draft: false`) by default; it opens as a draft only when the caller explicitly asks for it. The confirmation block shows `draft: false` unless the caller requested a draft, and the content test asserts this default wording in the agent body.
- [x] Editing an existing PR (decided by the user): in scope through edit mode (`pull_request_read` + `update_pull_request`, confirmation line `CONFIRMED: update pull request #<number>`); the agent never sets `state` or `maintainer_can_modify`, and `draft` changes only on explicit request.
- [ ] Include `mcp__github__list_label` even though the labels toolset may be off by default on the remote server: this design includes it and falls back to "Not discovered" when it is unavailable.

# pr-creator-agent Specification

## Purpose

Catalog-bundled **pr-creator** agent: a generic English Claude Code sub-agent that drafts a pull request following the `pr-writing` skill conventions and opens or edits it through the `github` MCP. It is the first bundled agent and uses least-privilege tools (no `Bash`). Installable via existing agents-install.

## ADDED Requirements

### Requirement: Bundled registration and valid agent file

The bundled catalog MUST list `pr-creator` in `items.agents` and MUST ship `catalog/agents/pr-creator.md`. The file MUST have YAML frontmatter with a single-line `name` equal to `pr-creator`, a single-line `description`, a `tools` field and a `skills` field, followed by a non-empty body. The agent MUST pass `parseAgent` and the catalog MUST load without issues.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN agent `pr-creator` is available and valid
- AND `items.agents` equals `['pr-creator']`
- AND the catalog reports no issues

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `pr-creator`
- WHEN the agent is parsed or the catalog is loaded
- THEN the agent MUST NOT be selectable
- AND the error MUST name the offending path and reason

### Requirement: Least-privilege tools

Frontmatter `tools` MUST include `Read`, `Grep` and `Glob` plus an explicit list of GitHub MCP tools (`mcp__github__<tool>`), covering pull request creation, pull request update (`mcp__github__update_pull_request`), pull request reading (`mcp__github__pull_request_read`) and the read operations needed to collect context. `create_pull_request` and `update_pull_request` MUST be the only GitHub write tools. `tools` MUST NOT include `Bash`, `Write`, `Edit` or any merge, branch, file-write, issue-write or label-write tool. The exact MCP tool names MUST be those verified in the design phase; the list MUST stay explicit (no wildcard).

#### Scenario: No shell access

- GIVEN `catalog/agents/pr-creator.md`
- WHEN its `tools` frontmatter is inspected
- THEN it lists `Read`, `Grep` and `Glob`
- AND it contains at least one `mcp__github__` tool
- AND it does not contain `Bash`

#### Scenario: PR creation, update and read tools present

- GIVEN the `tools` list
- WHEN it is inspected
- THEN it includes the GitHub MCP pull request creation, update and read tools
- AND the MCP write tools are exactly `create_pull_request` and `update_pull_request`

### Requirement: Skill declaration

Frontmatter `skills` MUST be `[pr-writing]`.

#### Scenario: Skills field

- GIVEN `catalog/agents/pr-creator.md`
- WHEN its `skills` frontmatter is inspected
- THEN it equals `[pr-writing]`

### Requirement: Context collection without Bash

The agent body MUST instruct the agent to gather the change context using only Read, Grep, Glob and GitHub MCP read tools: the diff or summary passed by the caller, commits on the pushed head branch (or, for an existing PR, its diff and files through `pull_request_read`), spec and tasks artifacts when present, and repository templates and conventions. The body MUST NOT instruct running `git` or `gh`.

#### Scenario: Context from allowed tools

- GIVEN the head branch is pushed
- WHEN the agent collects context
- THEN it reads commits and changes through GitHub MCP read tools
- AND reads the diff, spec, tasks and PR template through Read, Grep and Glob

#### Scenario: Caller-provided diff

- GIVEN the caller passes a diff or summary
- WHEN the agent collects context
- THEN it uses the provided diff in addition to the tools above

### Requirement: Gates check before drafting

The body MUST instruct the agent to check that the project quality gates (tests, lint, typecheck, build as documented) have passed, using evidence provided by the caller or found in available artifacts. When passing cannot be confirmed, the agent MUST report this in the draft and MUST NOT claim the gates passed.

#### Scenario: Gates confirmed

- GIVEN the caller or artifacts show the gates passed
- WHEN the agent drafts the PR
- THEN the draft states the verification performed

#### Scenario: Gates unconfirmed

- GIVEN no evidence that the gates passed
- WHEN the agent drafts the PR
- THEN the draft flags the gates as unverified
- AND the agent MUST NOT state they passed

### Requirement: Draft follows pr-writing conventions

The body MUST instruct the agent to draft the PR title and description following the `pr-writing` skill: Conventional Commits title, the repository PR template used first when present, and no invented labels, reviewers, milestones or issue references.

#### Scenario: Conventional title and template

- GIVEN the repository has a PR template
- WHEN the agent drafts the PR
- THEN the title follows Conventional Commits
- AND the description follows the template

#### Scenario: No invented metadata

- GIVEN labels, reviewers, milestones or issues are not provided or verified
- WHEN the agent drafts the PR
- THEN it MUST NOT invent them

### Requirement: Two-step confirmation before opening the PR

The body MUST define a two-step contract: first the agent returns the draft and stops without writing; it MUST call the PR creation tool only when invoked again with the literal line `CONFIRMED: create pull request` plus owner, repository, base, head, title, body and draft flag, relayed by the caller. A create MUST open the PR ready for review (`draft: false`) unless the caller explicitly asks for a draft. Absent explicit confirmation, the agent MUST NOT create the PR.

#### Scenario: First invocation returns the draft

- GIVEN the agent is invoked to open a PR
- WHEN it has produced the draft
- THEN it returns the draft and asks for confirmation
- AND it MUST NOT call the PR creation tool

#### Scenario: Confirmed re-invocation creates the PR

- GIVEN the agent is invoked again with explicit confirmation of the draft
- WHEN the head branch is pushed
- THEN the agent calls the GitHub MCP pull request creation tool
- AND returns the PR URL

#### Scenario: No explicit confirmation

- GIVEN an invocation without explicit confirmation
- WHEN the agent runs
- THEN the PR is not created

### Requirement: Edit mode for an existing pull request

When an open PR already exists for the head branch (found with `list_pull_requests`) or the caller names a PR number, the agent MUST read it with `pull_request_read` (`get`, and `get_diff` or `get_files`), draft the proposed changes (title, body, base, draft flag, reviewers) as a diff against the current values, and stop with a "Confirmation required" block without writing. It MUST call `update_pull_request` only when the request contains the literal line `CONFIRMED: update pull request #<number>` together with owner, repository, pullNumber and exactly the approved fields, and it MUST call it once with only those fields. A missing line or missing or different value MUST fall back to draft behavior. In edit mode `draft` MUST change only when the caller explicitly asks.

#### Scenario: Existing PR returns an edit draft

- GIVEN an open PR exists for the head branch
- WHEN the agent is invoked without the edit confirmation line
- THEN it reads the PR with `pull_request_read`
- AND returns the proposed changes as a diff against the current values with a "Confirmation required" block
- AND it MUST NOT call `update_pull_request`

#### Scenario: Confirmed edit updates the PR

- GIVEN a request with `CONFIRMED: update pull request #<number>`, owner, repository, pullNumber and the approved fields
- WHEN the agent runs
- THEN it calls `update_pull_request` once with only the approved fields
- AND returns the PR URL

#### Scenario: Incomplete edit confirmation

- GIVEN the confirmation line is missing, or a value is missing or differs from the approved draft
- WHEN the agent runs
- THEN it does not call `update_pull_request`
- AND it falls back to draft behavior and names what is missing

#### Scenario: Draft flag unchanged in edit

- GIVEN an edit request that does not explicitly ask to change the draft state
- WHEN the agent updates the PR
- THEN it does not send `draft`

### Requirement: No state or maintainer change

The agent MUST NEVER set `state` (closing or reopening a PR) nor `maintainer_can_modify` when calling `update_pull_request`, because the tool allowlist cannot restrict parameters. The body MUST state this rule explicitly.

#### Scenario: Close request refused

- GIVEN a caller asks the agent to close or reopen a PR
- WHEN the agent runs
- THEN it does not set `state`
- AND tells the caller that closing or reopening is not supported

### Requirement: Pushed branch required

The body MUST state that the head branch must already be pushed to the remote. When the agent cannot confirm the branch exists on the remote, it MUST NOT create the PR and MUST tell the caller to push the branch or pass the diff. The agent MUST NOT push branches.

#### Scenario: Branch not pushed

- GIVEN the head branch is not found on the remote
- WHEN the agent is asked to open the PR
- THEN it does not call the PR creation tool
- AND tells the caller to push the branch first

### Requirement: Requirements documented, not resolved

The description or body MUST document that the `pr-writing` skill and the `github` MCP must be installed for the agent to work. Installing the agent MUST NOT install them; dependency resolution is out of scope.

#### Scenario: Requirements stated

- GIVEN `catalog/agents/pr-creator.md`
- WHEN its description and body are inspected
- THEN they mention the `pr-writing` skill and the `github` MCP as requirements

#### Scenario: No dependency installation

- GIVEN `init --agents pr-creator` applies on a target without `pr-writing` or `github`
- WHEN the install completes
- THEN only the agent is installed

### Requirement: Generic and concise English

The agent MUST be written in concise English and MUST be generic (usable in any repository): no shitaku-specific file, tool or convention names are hardcoded.

#### Scenario: Generic content

- GIVEN `catalog/agents/pr-creator.md`
- WHEN its body is inspected
- THEN it is non-empty English
- AND hardcodes no repository-specific names

### Requirement: Installable create when absent

When the target is absent, `init --agents pr-creator --dry-run` MUST classify `create` for `./.claude/agents/pr-creator.md` (project scope) and MUST NOT write files, backups or manifest. Applied install MUST be byte-identical under existing agents-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target file for `pr-creator`
- WHEN `init --agents pr-creator --scope project --dry-run` runs
- THEN the plan classifies `pr-creator` as `create`
- AND no file, backup or manifest changes occur

#### Scenario: Byte-identical install

- GIVEN the bundled agent and an absent target
- WHEN `init --agents pr-creator` applies successfully
- THEN the target file is byte-identical to the catalog file
- AND behavior follows existing agents-install requirements without modification

### Requirement: Catalog-only surface with synced docs

Delivery MUST be catalog data, tests, CONTRIBUTING text and regenerated docs only. `src/` hexagonal layers MUST NOT change, and `catalog/skills/pr-writing/SKILL.md` and `catalog/mcps/github.json` MUST remain unchanged. The README agents table and website catalog pages (en, es) MUST be regenerated so the docs check scripts pass. CONTRIBUTING MUST name `pr-creator` as the bundled agent example instead of stating that no agent ships.

#### Scenario: No src changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/`, `catalog/skills/pr-writing/SKILL.md` and `catalog/mcps/github.json` are unchanged

#### Scenario: Generated docs in sync

- GIVEN `pr-creator` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `pr-creator`

#### Scenario: CONTRIBUTING updated

- GIVEN the agents section of CONTRIBUTING
- WHEN it is read after this change
- THEN it names `pr-creator` as the bundled example
- AND no longer says the bundled catalog ships no agent

# pr-writing-skill Specification

## Purpose

Catalog-bundled **pr-writing** skill: single generic English skill that drafts a pull request title and body (Conventional Commits title, concise structured body) and suggests metadata discovered from the target repository. Model-invocable, installable via existing skills-install. Scope is PR title and body only.

## Requirements

### Requirement: Bundled registration and valid frontmatter

The bundled catalog MUST list `pr-writing` in `items.skills` and MUST ship `catalog/skills/pr-writing/SKILL.md` with YAML frontmatter: single-line `name` equal to `pr-writing` and single-line `description` of at most 250 characters, starting with `Trigger:`. The skill MUST load and validate under existing catalog rules.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN skill `pr-writing` is available and valid
- AND frontmatter `name` equals the skill directory name
- AND the bundled skill list is `example-skill`, `pr-writing`, `socratic-method`

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `pr-writing`
- WHEN the catalog is loaded
- THEN the skill MUST NOT be selectable
- AND the error MUST name the offending path and reason

### Requirement: Conventional Commits title

The skill MUST instruct the agent to write the PR title as `type(scope)?: subject` using the commitlint `config-conventional` types (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert), so the squash-merge title can drive semantic-release. For a breaking change the title MUST carry `!` before the colon and the body MUST include a `BREAKING CHANGE:` footer.

#### Scenario: Title follows Conventional Commits

- GIVEN an agent follows `pr-writing` on a non-breaking change
- WHEN it drafts the PR title
- THEN the title matches `type(scope)?: subject` with an allowed type

#### Scenario: Breaking change is marked

- GIVEN the change is breaking
- WHEN the agent drafts the PR
- THEN the title has `!` before the colon
- AND the body contains a `BREAKING CHANGE:` footer

### Requirement: Concise structured body

The skill MUST instruct the agent to write a concise body with summary, changes, and how-to-test sections, and `Closes #<n>` when an issue is known. It MUST NOT add `Closes` for an unknown issue.

#### Scenario: Body has required sections

- GIVEN an agent follows `pr-writing` with a known issue number
- WHEN it drafts the body
- THEN the body contains summary, changes, and how-to-test content
- AND contains `Closes #<n>` for that issue

#### Scenario: Issue unknown

- GIVEN no related issue is known
- WHEN the agent drafts the body
- THEN the body MUST NOT contain an invented `Closes #<n>`

### Requirement: Existing PR template is followed

When the repository provides a PR template, the skill MUST instruct the agent to follow its structure instead of the default body layout.

#### Scenario: Template present

- GIVEN the target repository has a PR template
- WHEN the agent drafts the body
- THEN the body follows the template structure

### Requirement: Metadata discovered, never invented

The skill MUST instruct the agent to discover labels from the repository (for example `gh label list` when available), reviewers from `CODEOWNERS` or git history, and milestone from existing milestones. It MUST forbid inventing any label, reviewer, or milestone. When a value is not discoverable, the agent MUST omit it or ask the user. All metadata MUST be presented as a suggestion for the user to confirm. The skill MUST NOT hardcode repository-specific label, reviewer, or milestone names.

#### Scenario: Metadata discovered from the repository

- GIVEN labels, `CODEOWNERS` entries, or milestones exist in the target repository
- WHEN the agent proposes metadata
- THEN every suggested value comes from those sources
- AND the metadata is marked as a suggestion for confirmation

#### Scenario: No CODEOWNERS and no discoverable values

- GIVEN the repository has no `CODEOWNERS`, or `gh` is unavailable or unauthenticated
- WHEN the agent proposes metadata
- THEN it MUST NOT invent reviewers, labels, or milestone
- AND it omits the item or asks the user

### Requirement: Draft only, scope limited to title and body

The skill MUST produce a drafted title, body, and a clearly marked suggested-metadata block. It MUST NOT create or edit a PR (for example `gh pr create`) without explicit user confirmation. It MUST NOT cover topics, commit messages, or squash-merge subjects other than the PR title.

#### Scenario: No automatic PR creation

- GIVEN an agent follows `pr-writing`
- WHEN the draft is ready
- THEN the agent presents it for confirmation
- AND MUST NOT run a PR creation command without explicit user confirmation

#### Scenario: Out-of-scope content absent

- GIVEN `catalog/skills/pr-writing/SKILL.md` after the change
- WHEN its content is inspected
- THEN it does not instruct handling PR topics or commit message authoring

### Requirement: Generic and model-invocable

The skill MUST be generic (usable in any repository) and written in concise English. Frontmatter MUST NOT set `disable-model-invocation: true` (the key SHOULD be omitted).

#### Scenario: Invocable and generic

- GIVEN `catalog/skills/pr-writing/SKILL.md` after the change
- WHEN frontmatter and body are inspected
- THEN `disable-model-invocation` is absent or not `true`
- AND no shitaku-specific label, reviewer, or milestone names appear

### Requirement: Installable create when absent

When the target is absent, `init --skills pr-writing --dry-run` MUST classify `create` and MUST NOT write files, backups, or manifest. Applied install MUST be byte-identical under existing skills-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target directory for `pr-writing`
- WHEN `init --skills pr-writing --dry-run` runs
- THEN the plan classifies `pr-writing` as `create`
- AND no file, backup, or manifest changes occur

#### Scenario: Byte-identical install under existing skills-install

- GIVEN the bundled `pr-writing` skill and an absent target
- WHEN `init --skills pr-writing` applies successfully
- THEN the target skill tree is byte-identical to the catalog skill
- AND behavior follows existing skills-install requirements without modification

### Requirement: Catalog-only surface with synced docs

Delivery MUST be catalog data, tests, and regenerated docs only. `src/` hexagonal layers MUST NOT change. The README skills table and website catalog pages (en, es) MUST be regenerated so the docs check scripts pass.

#### Scenario: No src changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/` is unchanged
- AND no install-time templating is introduced

#### Scenario: Generated docs in sync

- GIVEN `pr-writing` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `pr-writing`

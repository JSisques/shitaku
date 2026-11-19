# commit-writing-skill Specification

## Purpose

Catalog-bundled **commit-writing** skill: single generic, tool-agnostic English skill that guides an agent to draft clear commit messages and propose atomic commit splits (draft-only by default, repository conventions first, Conventional Commits format, why-focused body, breaking-change footer, atomic split proposals, no attribution trailers). Model-invocable, installable via existing skills-install. Pull request text, changelog or release notes, and code or test changes belong elsewhere.

## ADDED Requirements

### Requirement: Bundled registration and valid frontmatter

The bundled catalog MUST list `commit-writing` in `items.skills`, in alphabetical order (first entry, before `docs-writing`), and MUST ship `catalog/skills/commit-writing/SKILL.md` with YAML frontmatter containing exactly two keys: single-line `name` equal to `commit-writing` and single-line, single-quoted `description` of at most 250 characters, starting with `Trigger:`, containing no apostrophes, double quotes or pipes. The skill MUST load and validate under existing catalog rules.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN skill `commit-writing` is available and valid
- AND frontmatter `name` equals the skill directory name
- AND the bundled skill list is `commit-writing`, `docs-writing`, `example-skill`, `pr-writing`, `product-owner`, `refactoring`, `socratic-method`, `test-writing`
- AND the bundled skill count is 8
- AND the `commit-writing` entry has `files: ['SKILL.md']`

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `commit-writing`
- WHEN the catalog is loaded
- THEN the skill MUST NOT be selectable
- AND the error MUST name the offending path and reason

#### Scenario: Description contract

- GIVEN `catalog/skills/commit-writing/SKILL.md`
- WHEN its frontmatter is inspected
- THEN `description` is one line, single-quoted, at most 250 characters and starts with `Trigger:`
- AND it contains no apostrophes, double quotes or pipes

### Requirement: Model-invocable and generic

Frontmatter MUST NOT set `disable-model-invocation: true` (the key SHOULD be omitted). The skill MUST be generic and tool-agnostic (usable in any repository, no dependency on a specific commit tool, hook or linter) and written in concise English. It MUST NOT hardcode shitaku-specific names, files, tools or conventions, and MUST NOT contain the literal `Co-Authored-By` token (the attribution rule is worded as "co-author or AI attribution trailers").

#### Scenario: Invocable and generic

- GIVEN `catalog/skills/commit-writing/SKILL.md` after the change
- WHEN frontmatter and body are inspected
- THEN `disable-model-invocation` is absent or not `true`
- AND the text does not match `/shitaku/i`
- AND the text does not contain `Co-Authored-By`

### Requirement: Required sections

The skill body MUST contain five sections in this order: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract. Decision Gates MUST be a Condition | Action table and Execution Steps MUST be numbered. The skill SHOULD stay concise (about 60-90 lines).

#### Scenario: Section layout

- GIVEN `catalog/skills/commit-writing/SKILL.md`
- WHEN its headings are inspected
- THEN Activation Contract, Hard Rules, Decision Gates, Execution Steps and Output Contract are present in that order
- AND Decision Gates is a table with Condition and Action columns
- AND Execution Steps is a numbered list

### Requirement: Draft-only by default

The skill MUST instruct the agent to draft commit messages and propose an atomic split, and MUST forbid running `git commit` (or amending, rebasing or otherwise rewriting history) unless the user explicitly asks for it. Staging changes automatically MUST NOT be done without that explicit request. The Output Contract MUST report the drafted message(s) for the user to review.

#### Scenario: Default draft-only behavior

- GIVEN the user asks for a commit message and gives no instruction to commit
- WHEN the agent follows `commit-writing`
- THEN it returns the drafted message(s) (and split proposal if needed)
- AND it does not run `git commit`, stage files or rewrite history

#### Scenario: Explicit commit request

- GIVEN the user explicitly asks the agent to commit
- WHEN the agent follows `commit-writing`
- THEN it MAY run `git commit` with the drafted message(s), one per agreed atomic commit
- AND it still follows every other hard rule

### Requirement: Repository conventions first

The skill MUST instruct the agent to inspect the repository before drafting: recent commit history, commit message lint or similar configuration, and allowed types and scopes. Repository conventions MUST take precedence over the skill defaults.

#### Scenario: Existing conventions found

- GIVEN the repository has commit history and a commit lint configuration with allowed types and scopes
- WHEN the agent follows `commit-writing`
- THEN it uses those types, scopes and style
- AND those conventions override conflicting skill defaults

#### Scenario: No conventions detectable

- GIVEN the repository has no history or lint configuration to infer from
- WHEN the agent follows `commit-writing`
- THEN it falls back to the Conventional Commits defaults of the skill

### Requirement: Conventional Commits format

The skill MUST instruct the agent to write messages in the Conventional Commits format: a type, an optional scope, and a subject in the imperative mood, lowercase, without a trailing period and kept concise. It MUST instruct the agent to choose the type that matches the intent of the change (for example feature, fix, docs, refactor, test, chore) rather than the files touched.

#### Scenario: Well-formed subject

- GIVEN a change that fixes a bug in a specific area
- WHEN the agent drafts the message
- THEN the subject has the form `type(scope): imperative lowercase summary`
- AND it has no trailing period and stays concise

#### Scenario: Type follows intent

- GIVEN a change that only edits documentation files
- WHEN the agent selects the type
- THEN it uses the documentation type, not a feature or fix type

### Requirement: Body explains why

The skill MUST instruct the agent to use the body to explain motivation and context (why the change was made) rather than restate the diff, to wrap body lines, and to reference related issues in the footer. A body SHOULD be omitted when the subject is self-explanatory.

#### Scenario: Non-obvious change

- GIVEN a change whose reason is not evident from the diff
- WHEN the agent drafts the message
- THEN the body states why the change was made
- AND it does not enumerate the diff line by line

#### Scenario: Linked issue

- GIVEN the change resolves a tracked issue
- WHEN the agent drafts the message
- THEN the issue is referenced in the footer

### Requirement: Breaking changes

The skill MUST instruct the agent to mark breaking changes with the `!` marker after the type or scope and a `BREAKING CHANGE:` footer that describes what breaks and how to migrate.

#### Scenario: Breaking change present

- GIVEN a change that removes or alters a public behavior consumers rely on
- WHEN the agent drafts the message
- THEN the subject carries the `!` marker
- AND the footer contains `BREAKING CHANGE:` with the impact and migration

#### Scenario: Non-breaking change

- GIVEN a change that keeps public behavior intact
- WHEN the agent drafts the message
- THEN no `!` marker and no `BREAKING CHANGE:` footer are added

### Requirement: Atomic commits and split proposals

The skill MUST instruct the agent to keep one logical change per commit. When the staged or working changes mix concerns, the agent MUST propose a split that groups files or hunks per commit and gives their order. Tests and docs MUST travel with the behavior they cover. The Decision Gates MUST map mixed or single-concern changes to an action.

#### Scenario: Mixed concerns

- GIVEN pending changes contain a bug fix and an unrelated refactor
- WHEN the agent follows `commit-writing`
- THEN it proposes separate commits with the file or hunk grouping and order for each
- AND it drafts one message per proposed commit

#### Scenario: Single concern

- GIVEN pending changes form one logical change including its tests and docs
- WHEN the agent follows `commit-writing`
- THEN it drafts a single message covering the change
- AND tests and docs stay in that same commit

### Requirement: No attribution trailers

The skill MUST forbid adding co-author or AI attribution trailers to commit messages, and MUST word this rule without the literal `Co-Authored-By` token.

#### Scenario: Message without attribution

- GIVEN the agent drafts or creates a commit message
- WHEN the message is finalized
- THEN it contains no co-author or AI attribution trailer

### Requirement: Scope limited to commit messages (Not for)

The skill MUST state in its Activation Contract (ending with a "Not for ..." sentence) that it is not for pull request titles or descriptions (owned by `pr-writing`), changelog or release notes, or writing or changing code or tests. Existing skills, rules (including `catalog/rules/conventional-commits.md`) and agents MUST remain unchanged, and no `commit-writer` agent or profile entry is added.

#### Scenario: Out-of-scope content absent

- GIVEN `catalog/skills/commit-writing/SKILL.md`
- WHEN the Activation Contract is inspected
- THEN a `Not for pull request` statement excludes pull request titles or descriptions
- AND it also excludes changelog or release notes and writing or changing code or tests

#### Scenario: Existing items unchanged

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN no existing skill, rule, agent or profile file is modified
- AND `catalog/catalog.json` only gains the `commit-writing` skill entry

### Requirement: Content contract guard

`test/adapters/catalog/bundled-catalog.test.ts` MUST assert the exact skill lists and count 8, the `commit-writing` entry with `files: ['SKILL.md']`, and a content-contract test via `expectSkillContract` that checks a few load-bearing tokens (`Conventional Commits`, `BREAKING CHANGE:`, `atomic`, `why`, `Not for pull request`) plus the forbidden `/shitaku/i` and `Co-Authored-By`.

#### Scenario: Guard fails before the skill exists

- GIVEN the test changes are applied without the skill or catalog entry
- WHEN `pnpm test` runs
- THEN the bundled-catalog tests fail (RED)

#### Scenario: Guard passes after the skill is added

- GIVEN the skill and catalog entry are added
- WHEN `pnpm test` runs
- THEN the bundled-catalog and content-contract tests pass (GREEN)

### Requirement: Installable create when absent

When the target is absent, `init --skills commit-writing --dry-run` MUST classify `create` and MUST NOT write files, backups, or manifest. Applied install MUST be byte-identical under existing skills-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target directory for `commit-writing`
- WHEN `init --skills commit-writing --dry-run` runs
- THEN the plan classifies `commit-writing` as `create`
- AND no file, backup, or manifest changes occur

#### Scenario: Byte-identical install under existing skills-install

- GIVEN the bundled `commit-writing` skill and an absent target
- WHEN `init --skills commit-writing` applies successfully
- THEN the target skill tree is byte-identical to the catalog skill
- AND behavior follows existing skills-install requirements without modification

### Requirement: Catalog-only surface with synced docs

Delivery MUST be catalog data, tests, and regenerated docs only. `src/` hexagonal layers MUST NOT change, no install-time templating MUST be introduced, and `CHANGELOG.md` MUST NOT be edited. The README skills table and website catalog pages (en, es) MUST be regenerated, not hand-edited, so the docs check scripts pass.

#### Scenario: No src changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/` and `CHANGELOG.md` are unchanged
- AND no install-time templating is introduced

#### Scenario: Generated docs in sync

- GIVEN `commit-writing` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `commit-writing`

# test-writing-skill Specification

## Purpose

Catalog-bundled **test-writing** skill: single generic, runner-agnostic English skill that guides an agent to write reliable, maintainable tests (repository conventions first, right test level, mocks only at boundaries, behavior-named Arrange-Act-Assert cases, edge-case and regression checklists, no flakiness). Model-invocable, installable via existing skills-install. Refactoring safety nets, production code changes, commit messages and PR text belong elsewhere.

## ADDED Requirements

### Requirement: Bundled registration and valid frontmatter

The bundled catalog MUST list `test-writing` in `items.skills`, in alphabetical order (after `socratic-method`), and MUST ship `catalog/skills/test-writing/SKILL.md` with YAML frontmatter containing exactly two keys: single-line `name` equal to `test-writing` and single-line, single-quoted `description` of at most 250 characters, starting with `Trigger:`, containing no apostrophes, double quotes or pipes. The skill MUST load and validate under existing catalog rules.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN skill `test-writing` is available and valid
- AND frontmatter `name` equals the skill directory name
- AND the bundled skill list is `docs-writing`, `example-skill`, `pr-writing`, `product-owner`, `refactoring`, `socratic-method`, `test-writing`
- AND the bundled skill count is 7
- AND the `test-writing` entry has `files: ['SKILL.md']`

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `test-writing`
- WHEN the catalog is loaded
- THEN the skill MUST NOT be selectable
- AND the error MUST name the offending path and reason

#### Scenario: Description contract

- GIVEN `catalog/skills/test-writing/SKILL.md`
- WHEN its frontmatter is inspected
- THEN `description` is one line, single-quoted, at most 250 characters and starts with `Trigger:`
- AND it contains no apostrophes, double quotes or pipes

### Requirement: Model-invocable and generic

Frontmatter MUST NOT set `disable-model-invocation: true` (the key SHOULD be omitted). The skill MUST be generic and runner-agnostic (usable in any repository, no Vitest, Jest or pytest specific syntax) and written in concise English. It MUST NOT hardcode shitaku-specific names, files, tools or conventions, and MUST NOT contain `Co-Authored-By`.

#### Scenario: Invocable and generic

- GIVEN `catalog/skills/test-writing/SKILL.md` after the change
- WHEN frontmatter and body are inspected
- THEN `disable-model-invocation` is absent or not `true`
- AND the text does not match `/shitaku/i`
- AND the text does not contain `Co-Authored-By`

### Requirement: Required sections

The skill body MUST contain five sections in this order: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract. Decision Gates MUST be a Condition | Action table and Execution Steps MUST be numbered. The skill SHOULD stay concise (about 45-65 lines).

#### Scenario: Section layout

- GIVEN `catalog/skills/test-writing/SKILL.md`
- WHEN its headings are inspected
- THEN Activation Contract, Hard Rules, Decision Gates, Execution Steps and Output Contract are present in that order
- AND Decision Gates is a table with Condition and Action columns
- AND Execution Steps is a numbered list

### Requirement: Repository conventions first

The skill MUST instruct the agent to inspect the repository before writing tests: existing test runner, file layout and location, naming scheme, helpers and fixtures. Repository conventions MUST take precedence over the skill defaults. The agent MUST run the new tests with the repository runner before reporting.

#### Scenario: Existing conventions found

- GIVEN the repository has a test runner, layout and helpers
- WHEN the agent follows `test-writing`
- THEN it reuses that runner, file placement, naming and helpers
- AND those conventions override conflicting skill defaults

#### Scenario: No tests exist yet

- GIVEN the repository has no recognizable test setup
- WHEN the agent follows `test-writing`
- THEN it stops and asks (or proposes the smallest conventional setup) before adding a new runner

### Requirement: Right test level

The skill MUST instruct the agent to choose unit, integration or end-to-end level following the test pyramid, preferring the cheapest level that proves the behavior. The Decision Gates MUST map situations to levels.

#### Scenario: Pure logic

- GIVEN the behavior is pure logic with no I/O
- WHEN the agent selects a level
- THEN it writes a unit test

#### Scenario: Cross-component behavior

- GIVEN the behavior depends on collaboration across components or a real boundary
- WHEN the agent selects a level
- THEN it writes an integration test, and uses end-to-end only when a unit or integration test cannot prove the behavior

### Requirement: Mock only at boundaries

The skill MUST instruct the agent to fake only system boundaries (I/O, network, clock, randomness) and MUST forbid mocking the unit under test or its internal collaborators. Assertions MUST target observable outcomes rather than implementation details.

#### Scenario: External dependency

- GIVEN the unit calls the network, file system, clock or a random source
- WHEN the agent writes the test
- THEN it replaces only that boundary with a fake or stub

#### Scenario: Internal collaborator

- GIVEN the unit calls an internal collaborator
- WHEN the agent writes the test
- THEN it MUST NOT mock that collaborator
- AND it asserts observable outcomes, not internal calls

### Requirement: Behavior-named cases with Arrange-Act-Assert

The skill MUST instruct the agent to name each test by the behavior it proves, keep one behavior per test, and structure each test as Arrange-Act-Assert.

#### Scenario: Naming and structure

- GIVEN the agent writes a new test case
- WHEN it names and structures the case
- THEN the name states the behavior (not the method name or implementation)
- AND the case verifies one behavior in Arrange-Act-Assert order

### Requirement: Edge-case and regression checklists

The skill MUST include a compact edge-case checklist covering at least empty, boundary, invalid input and error paths. For bug fixes it MUST instruct the agent to write a regression test that reproduces the bug and fails before the fix.

#### Scenario: Edge cases considered

- GIVEN the agent writes tests for a unit
- WHEN it applies the checklist
- THEN it covers empty, boundary, invalid and error-path inputs where relevant

#### Scenario: Regression test

- GIVEN a bug report
- WHEN the agent writes a regression test
- THEN the test reproduces the bug and is observed failing before the fix
- AND passes after the fix

### Requirement: No flakiness

The skill MUST instruct the agent to avoid flaky tests: deterministic time and randomness, no sleeps or arbitrary waits, isolated state per test, and no order dependence between tests. A flaky test MUST be root-caused, not retried or skipped.

#### Scenario: Time-dependent behavior

- GIVEN behavior depends on time or randomness
- WHEN the agent writes the test
- THEN it controls the clock or seed instead of using real time or sleeps

#### Scenario: Shared state

- GIVEN tests would share mutable state
- WHEN the agent writes them
- THEN each test sets up and cleans up its own state
- AND results do not depend on execution order

### Requirement: Scope limited to test authoring (Not for)

The skill MUST state in its Activation Contract (ending with a "Not for ..." sentence) that it is not for refactoring safety nets (owned by `refactoring`), production code changes, commit messages or pull request text. Existing skills (including `refactoring`), rules and agents MUST remain unchanged, and no `test-writer` agent or profile entry is added.

#### Scenario: Out-of-scope content absent

- GIVEN `catalog/skills/test-writing/SKILL.md`
- WHEN the Activation Contract is inspected
- THEN a `Not for` statement excludes refactoring safety nets, production code changes, commit messages and PR text

#### Scenario: Existing items unchanged

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN no existing skill, rule, agent or profile file is modified

### Requirement: Content contract guard

`test/adapters/catalog/bundled-catalog.test.ts` MUST assert the exact skill lists and count 7, the `test-writing` entry with `files: ['SKILL.md']`, and a content-contract test via `expectSkillContract` that checks a few load-bearing tokens (for example boundaries, Arrange, regression, flaky, Not for) plus the forbidden `/shitaku/i` and `Co-Authored-By`.

#### Scenario: Guard fails before the skill exists

- GIVEN the test changes are applied without the skill or catalog entry
- WHEN `pnpm test` runs
- THEN the bundled-catalog tests fail (RED)

#### Scenario: Guard passes after the skill is added

- GIVEN the skill and catalog entry are added
- WHEN `pnpm test` runs
- THEN the bundled-catalog and content-contract tests pass (GREEN)

### Requirement: Installable create when absent

When the target is absent, `init --skills test-writing --dry-run` MUST classify `create` and MUST NOT write files, backups, or manifest. Applied install MUST be byte-identical under existing skills-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target directory for `test-writing`
- WHEN `init --skills test-writing --dry-run` runs
- THEN the plan classifies `test-writing` as `create`
- AND no file, backup, or manifest changes occur

#### Scenario: Byte-identical install under existing skills-install

- GIVEN the bundled `test-writing` skill and an absent target
- WHEN `init --skills test-writing` applies successfully
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

- GIVEN `test-writing` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `test-writing`

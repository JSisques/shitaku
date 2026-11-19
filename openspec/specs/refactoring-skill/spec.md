# refactoring-skill Specification

## Purpose

Catalog-bundled **refactoring** skill: single generic English skill that guides an agent to restructure code safely (test safety net first, behavior unchanged, one small named refactoring step at a time, tests after every step, atomic `refactor:` commits). Model-invocable, installable via existing skills-install. Scope is refactoring only; new features, bug fixes, commit-message authoring and PR text belong elsewhere.

## ADDED Requirements

### Requirement: Bundled registration and valid frontmatter

The bundled catalog MUST list `refactoring` in `items.skills`, in alphabetical order, and MUST ship `catalog/skills/refactoring/SKILL.md` with YAML frontmatter containing exactly two keys: single-line `name` equal to `refactoring` and single-line, single-quoted `description` of at most 250 characters, starting with `Trigger:`, containing no apostrophes, double quotes or pipes. The skill MUST load and validate under existing catalog rules.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN skill `refactoring` is available and valid
- AND frontmatter `name` equals the skill directory name
- AND the bundled skill list is `docs-writing`, `example-skill`, `pr-writing`, `product-owner`, `refactoring`, `socratic-method`
- AND the bundled skill count is 6
- AND the `refactoring` entry has `files: ['SKILL.md']`

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `refactoring`
- WHEN the catalog is loaded
- THEN the skill MUST NOT be selectable
- AND the error MUST name the offending path and reason

#### Scenario: Description contract

- GIVEN `catalog/skills/refactoring/SKILL.md`
- WHEN its frontmatter is inspected
- THEN `description` is one line, single-quoted, at most 250 characters and starts with `Trigger:`
- AND it contains no apostrophes, double quotes or pipes

### Requirement: Model-invocable and generic

Frontmatter MUST NOT set `disable-model-invocation: true` (the key SHOULD be omitted). The skill MUST be generic (usable in any repository) and written in concise English. It MUST NOT hardcode shitaku-specific names, files, tools or conventions, and MUST NOT contain `Co-Authored-By`.

#### Scenario: Invocable and generic

- GIVEN `catalog/skills/refactoring/SKILL.md` after the change
- WHEN frontmatter and body are inspected
- THEN `disable-model-invocation` is absent or not `true`
- AND the text does not match `/shitaku/i`
- AND the text does not contain `Co-Authored-By`

### Requirement: Required sections

The skill body MUST contain five sections in this order: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract. Decision Gates MUST be a Condition | Action table. The skill SHOULD stay concise (about 45-65 lines).

#### Scenario: Section layout

- GIVEN `catalog/skills/refactoring/SKILL.md`
- WHEN its headings are inspected
- THEN Activation Contract, Hard Rules, Decision Gates, Execution Steps and Output Contract are present in that order
- AND Decision Gates is a table with Condition and Action columns

### Requirement: Safety net first

The skill MUST instruct the agent to inspect the repository (test runner, coverage of the target code) and run the existing tests before changing code. When coverage of the target code is missing, the skill MUST instruct the agent to write characterization tests first, or to stop and ask. The agent MUST NOT start a refactoring step without a passing safety net.

#### Scenario: Tests exist and pass

- GIVEN the target code is covered by passing tests
- WHEN the agent follows `refactoring`
- THEN it runs the tests before the first change
- AND proceeds only if they pass

#### Scenario: Coverage missing

- GIVEN the target code has no test coverage
- WHEN the agent follows `refactoring`
- THEN it writes characterization tests that pin current behavior first
- OR stops and asks the user before changing code

#### Scenario: Failing baseline

- GIVEN the existing tests fail before any change
- WHEN the agent follows `refactoring`
- THEN it MUST NOT start refactoring
- AND it reports the failing baseline

### Requirement: Behavior unchanged

The skill MUST state that a refactoring step preserves observable behavior. It MUST forbid adding features, fixing bugs, or changing public contracts inside a refactoring step. When a bug or needed behavior change is discovered, the agent MUST report it and handle it outside the refactoring.

#### Scenario: Bug found mid-refactor

- GIVEN the agent notices a bug while refactoring
- WHEN it continues the work
- THEN it MUST NOT fix the bug inside the refactoring step
- AND it reports the bug for separate handling

#### Scenario: Public contract change requested

- GIVEN a step would change a public signature or output
- WHEN the agent evaluates it
- THEN it MUST NOT treat the step as a refactoring
- AND it stops and asks

### Requirement: Small named steps with a compact catalog

The skill MUST instruct the agent to apply one named refactoring at a time. It MUST include a compact catalog of named refactorings, each with one-line when-to-apply guidance, covering at least: Extract Function, Inline Function, Rename, Extract Variable, Move Function or Field, Replace Conditional with Guard Clauses or Polymorphism, Introduce Parameter Object, Remove Dead Code, Replace Magic Number with Constant, Decompose Conditional. The catalog MUST NOT require a `references/` folder.

#### Scenario: One step at a time

- GIVEN a refactoring needs several transformations
- WHEN the agent follows `refactoring`
- THEN it applies one named refactoring per step
- AND does not batch unrelated transformations

#### Scenario: Catalog with when-to-apply

- GIVEN `catalog/skills/refactoring/SKILL.md`
- WHEN the refactoring catalog is inspected
- THEN each listed refactoring has a name and a one-line when-to-apply hint
- AND it includes Extract Function, Inline Function and Rename

### Requirement: Verify each step and revert on failure

The skill MUST instruct the agent to run the tests after every step. When tests fail, the agent MUST revert that step instead of patching forward, and MUST NOT edit existing tests to make them pass unless the change is a pure rename of the symbol under test.

#### Scenario: Tests stay green

- GIVEN a refactoring step is applied
- WHEN the agent runs the tests and they pass
- THEN it proceeds to the next step

#### Scenario: Tests fail after a step

- GIVEN a refactoring step is applied
- WHEN the tests fail
- THEN the agent reverts that step
- AND MUST NOT patch forward or loosen the tests

### Requirement: Atomic refactor commits and no scope creep

The skill MUST instruct the agent to make one `refactor:` commit per coherent step, never mixing refactoring with behavior changes, and to keep changes within the requested scope. The skill MUST follow the repository commit convention when one exists, and MUST NOT define commit-message authoring rules beyond the `refactor:` type and separation from behavior changes.

#### Scenario: Atomic commit

- GIVEN a green refactoring step
- WHEN the agent commits (when asked to commit)
- THEN the commit contains only that refactoring step
- AND uses the `refactor:` type or the repository equivalent

#### Scenario: Scope creep

- GIVEN unrelated code is tempting to clean up
- WHEN the agent follows `refactoring`
- THEN it MUST NOT include it in the current refactoring
- AND mentions it as a follow-up

### Requirement: Scope limited to refactoring (Not for)

The skill MUST state in its Activation Contract that it is not for new features, bug fixes, commit-message authoring or pull request titles and descriptions. Existing skills, rules and agents (including `pr-writing`) MUST remain unchanged.

#### Scenario: Out-of-scope content absent

- GIVEN `catalog/skills/refactoring/SKILL.md`
- WHEN the Activation Contract is inspected
- THEN a `Not for` statement excludes new features, bug fixes, commit-message authoring and PR text

#### Scenario: Existing items unchanged

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN no existing skill, rule or agent file is modified

### Requirement: Installable create when absent

When the target is absent, `init --skills refactoring --dry-run` MUST classify `create` and MUST NOT write files, backups, or manifest. Applied install MUST be byte-identical under existing skills-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target directory for `refactoring`
- WHEN `init --skills refactoring --dry-run` runs
- THEN the plan classifies `refactoring` as `create`
- AND no file, backup, or manifest changes occur

#### Scenario: Byte-identical install under existing skills-install

- GIVEN the bundled `refactoring` skill and an absent target
- WHEN `init --skills refactoring` applies successfully
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

- GIVEN `refactoring` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `refactoring`

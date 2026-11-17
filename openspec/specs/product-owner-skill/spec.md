# product-owner-skill Specification

## Purpose

Catalog-bundled **product-owner** skill: single generic English skill that guides an agent through product ownership work (vision and goals, backlog of epics and user stories, Given/When/Then acceptance criteria, prioritization, MVP and success metrics, roadmap and release planning, and a generic handoff to a tech lead). Model-invocable, installable via existing skills-install. The skill is not a member of any profile.

## ADDED Requirements

### Requirement: Bundled registration and valid frontmatter

The bundled catalog MUST list `product-owner` in `items.skills` and MUST ship `catalog/skills/product-owner/SKILL.md` with YAML frontmatter containing exactly `name` and `description`: single-line `name` equal to `product-owner` and single-line, single-quoted `description` of at most 250 characters, starting with `Trigger:`, containing no quotes or pipes. The skill MUST load and validate under existing catalog rules.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN skill `product-owner` is available and valid
- AND frontmatter `name` equals the skill directory name
- AND the bundled skill list is `docs-writing`, `example-skill`, `pr-writing`, `product-owner`, `socratic-method`
- AND the bundled skill count is 5
- AND the `product-owner` entry has `files: ['SKILL.md']`

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `product-owner`
- WHEN the catalog is loaded
- THEN the skill MUST NOT be selectable
- AND the error MUST name the offending path and reason

### Requirement: Standard skill structure

The skill body MUST contain the five standard sections: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract.

#### Scenario: Five sections present

- GIVEN `catalog/skills/product-owner/SKILL.md` after the change
- WHEN its body is inspected
- THEN it contains the sections Activation Contract, Hard Rules, Decision Gates, Execution Steps, and Output Contract

### Requirement: Vision, goals and backlog guidance

The skill MUST instruct the agent to define product vision and goals first, then shape a backlog organized into epics and user stories. Each user story MUST follow the "As a <role>, I want <capability>, so that <benefit>" form.

#### Scenario: Vision before backlog

- GIVEN a product idea without a defined vision
- WHEN an agent follows `product-owner`
- THEN the agent states vision and goals before creating backlog items

#### Scenario: Epics and stories

- GIVEN a defined vision and goals
- WHEN the agent shapes the backlog
- THEN work is grouped into epics
- AND each epic is broken into user stories in role, capability, benefit form

### Requirement: Acceptance criteria in Given/When/Then

The skill MUST instruct the agent to write testable acceptance criteria for every user story using Given/When/Then, and MUST forbid vague or untestable criteria.

#### Scenario: Story has testable criteria

- GIVEN a user story
- WHEN the agent finalizes it
- THEN it has at least one acceptance criterion in Given/When/Then form
- AND each criterion is verifiable

#### Scenario: Vague criterion

- GIVEN a draft criterion that cannot be verified (for example "works well")
- WHEN the agent reviews the story
- THEN it MUST rewrite the criterion into a testable Given/When/Then form

### Requirement: Prioritization

The skill MUST instruct the agent to prioritize backlog items using value versus effort and MoSCoW (Must, Should, Could, Won't), and to state the rationale for each priority.

#### Scenario: Items prioritized with rationale

- GIVEN a backlog of stories
- WHEN the agent prioritizes it
- THEN each item gets a MoSCoW category and a value versus effort assessment
- AND the rationale is stated

### Requirement: MVP and success metrics

The skill MUST instruct the agent to define the MVP as the smallest set of stories that delivers the vision's core value, and to define measurable success metrics for it.

#### Scenario: MVP scoped

- GIVEN a prioritized backlog
- WHEN the agent defines the MVP
- THEN the MVP contains only the smallest set needed for core value
- AND measurable success metrics are listed

### Requirement: Roadmap and release planning

The skill MUST instruct the agent to organize the backlog into a roadmap of releases ordered by priority and dependencies, each with a goal.

#### Scenario: Release plan

- GIVEN a prioritized backlog with an MVP
- WHEN the agent plans releases
- THEN releases are ordered by priority and dependencies
- AND each release states its goal

### Requirement: Generic tech-lead handoff

The skill MUST instruct the agent to hand off to a tech lead (or equivalent engineering role) for feasibility and estimates, without depending on any specific skill. It MUST NOT reference another catalog skill by name as a prerequisite.

#### Scenario: Feasibility handoff

- GIVEN stories needing feasibility or estimates
- WHEN the agent reaches that step
- THEN it requests review from a tech lead or equivalent role
- AND does not require any other skill to be installed

### Requirement: Generic and model-invocable

The skill MUST be generic (usable in any repository) and written in concise English. Frontmatter MUST NOT set `disable-model-invocation: true` (the key MUST be omitted, as frontmatter holds only `name` and `description`). The skill MUST NOT mention "shitaku". Its decision gates SHOULD cover: missing vision or goals (define them first), stories without acceptance criteria (add them), scope exceeding MVP (defer via priority).

#### Scenario: Invocable and generic

- GIVEN `catalog/skills/product-owner/SKILL.md` after the change
- WHEN frontmatter and body are inspected
- THEN `disable-model-invocation` is absent
- AND the text does not contain "shitaku"

### Requirement: Installable create when absent

When the target is absent, `init --skills product-owner --dry-run` MUST classify `create` and MUST NOT write files, backups, or manifest. Applied install MUST be byte-identical under existing skills-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target directory for `product-owner`
- WHEN `init --skills product-owner --dry-run` runs
- THEN the plan classifies `product-owner` as `create`
- AND no file, backup, or manifest changes occur

#### Scenario: Byte-identical install under existing skills-install

- GIVEN the bundled `product-owner` skill and an absent target
- WHEN `init --skills product-owner` applies successfully
- THEN the target skill tree is byte-identical to the catalog skill
- AND behavior follows existing skills-install requirements without modification

### Requirement: No profile membership

The skill MUST NOT be added to any existing profile and no new profile MUST be created. Files under `catalog/profiles/` MUST remain unchanged. This is a deliberate deviation from issue #17, which asked to include the skill in a profile.

#### Scenario: Profiles untouched

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN no file under `catalog/profiles/` is changed or added
- AND no profile lists `product-owner`

### Requirement: Catalog-only surface with synced docs

Delivery MUST be catalog data, tests, and regenerated docs only. `src/` hexagonal layers MUST NOT change. The README skills table and website catalog pages (en, es) MUST be regenerated with the generators, not hand-edited, so the docs check scripts pass.

#### Scenario: No src changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/` is unchanged
- AND no install-time templating is introduced

#### Scenario: Generated docs in sync

- GIVEN `product-owner` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `product-owner`

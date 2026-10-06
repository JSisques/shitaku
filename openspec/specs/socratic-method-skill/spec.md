# socratic-method-skill Specification

## Purpose

Catalog-bundled **socratic-method** skill: single English LLM-first skill, fixed coaching tone, model-invocable, installable via existing skills-install. No product tone personalization.

## Requirements

### Requirement: Bundled registration and valid frontmatter

The bundled catalog MUST list `socratic-method` in `items.skills` and MUST ship `catalog/skills/socratic-method/SKILL.md` with YAML frontmatter: non-empty `name` equal to `socratic-method`, non-empty single-line `description`. The skill MUST load and validate under existing catalog rules.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN skill `socratic-method` is available and valid
- AND frontmatter `name` equals the skill directory name

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `socratic-method`
- WHEN the catalog is loaded
- THEN the skill MUST NOT be selectable
- AND the error MUST name the offending path and reason

### Requirement: Generic Socratic method content

The skill body MUST teach a generic Socratic method (question assumptions, surface gaps, decide before acting). It MUST NOT instruct silent implement/rewrite of user artifacts; it MUST challenge gaps and wait for explicit direction before coding or rewriting.

#### Scenario: Question-first before implementation

- GIVEN an agent follows `socratic-method` on a request to implement or rewrite work
- WHEN assumptions or acceptance gaps remain unclear
- THEN the agent MUST ask clarifying questions before changing artifacts
- AND MUST NOT silently implement or rewrite those artifacts

#### Scenario: Explicit go-ahead allows action

- GIVEN gaps were challenged and the user explicitly directs implementation or rewrite
- WHEN the agent continues under this skill
- THEN the agent MAY proceed with the directed work

### Requirement: Fixed coaching tone without install-time personalization

The skill MUST encode a fixed question-first coaching tone in `SKILL.md`. Install MUST NOT offer tone choice, dual variants, skill templating, or `${VAR}` substitution on this skill. Install-time tone personalization remains out of scope.

#### Scenario: Fixed tone in shipped content

- GIVEN `catalog/skills/socratic-method/SKILL.md` after the change
- WHEN frontmatter and body are inspected
- THEN the body encodes a fixed question-first coaching tone
- AND no install-time tone selector or dual-variant packaging is present

#### Scenario: No tone personalization at install

- GIVEN `init` installs `socratic-method`
- WHEN install options and written files are inspected
- THEN no tone personalization flag, prompt, or template substitution applies
- AND installed bytes match the catalog skill under existing skills-install rules

### Requirement: Model-invocable skill

The skill MUST remain model-invocable. Frontmatter MUST NOT set `disable-model-invocation: true` (the key SHOULD be omitted).

#### Scenario: Invocable for later preload consumers

- GIVEN `catalog/skills/socratic-method/SKILL.md` after the change
- WHEN frontmatter is inspected
- THEN `disable-model-invocation` is absent or not `true`

### Requirement: Installable create when absent

When the target is absent, `init --skills socratic-method --dry-run` MUST classify `create` and MUST NOT write files, backups, or manifest. Applied install MUST be byte-identical under existing skills-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target directory for `socratic-method`
- WHEN `init --skills socratic-method --dry-run` runs
- THEN the plan classifies `socratic-method` as `create`
- AND no file, backup, or manifest changes occur

#### Scenario: Byte-identical install under existing skills-install

- GIVEN the bundled `socratic-method` skill and an absent target
- WHEN `init --skills socratic-method` applies successfully
- THEN the target skill tree is byte-identical to the catalog skill
- AND behavior follows existing skills-install requirements without modification

### Requirement: Catalog-only surface

Delivery MUST be catalog data plus related docs/tests only. MUST NOT add product tone features, skill templating, or `src/` behavior for tone/install personalization.

#### Scenario: No src product tone features

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/` hexagonal layers are unchanged for tone or skill-templating features
- AND no install-time tone UX is introduced

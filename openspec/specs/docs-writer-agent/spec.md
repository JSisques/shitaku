# docs-writer-agent Specification

## Purpose

Catalog-bundled **docs-writer** agent: a generic English Claude Code sub-agent that writes and updates documentation (README sections, guides, code comments and JSDoc) following the `docs-writing` skill. It is the third bundled agent and uses least-privilege tools (no `Bash`). Installable via existing agents-install. Also defines the repository guard that every bundled agent's `skills:` entries exist in the catalog.

## ADDED Requirements

### Requirement: Bundled registration and valid agent file

The bundled catalog MUST list `docs-writer` in `items.agents` (after `socratic-challenger`) and MUST ship `catalog/agents/docs-writer.md`. The file MUST have YAML frontmatter with a single-line `name` equal to `docs-writer`, a single-line plain-scalar `description`, a `tools` field and a `skills` field, followed by a non-empty body. The agent MUST pass `parseAgent` and the catalog MUST load without issues.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN agent `docs-writer` is available and valid
- AND `items.agents` equals `['pr-creator', 'socratic-challenger', 'docs-writer']`
- AND the catalog reports no issues

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `docs-writer`
- WHEN the agent is parsed or the catalog is loaded
- THEN the agent MUST NOT be selectable
- AND the error MUST name the offending path and reason

### Requirement: Description is a plain single-line scalar

The `description` MUST be a single line, MUST NOT contain a colon followed by a space, a quote character or `|`, MUST state that the agent writes and updates documentation and code comments, and MUST state that it requires the `docs-writing` skill. It MUST NOT claim to handle PR text, commit messages or agent instruction files.

#### Scenario: Description shape

- GIVEN `catalog/agents/docs-writer.md`
- WHEN its `description` is inspected
- THEN it is on one line
- AND it contains neither `: `, quote characters nor `|`
- AND it mentions the `docs-writing` skill requirement

### Requirement: Least-privilege tools

Frontmatter `tools` MUST be exactly `Read, Grep, Glob, Edit, Write`. It MUST NOT include `Bash` or any MCP tool.

#### Scenario: Exact tools

- GIVEN `catalog/agents/docs-writer.md`
- WHEN its `tools` frontmatter is inspected
- THEN it equals `Read, Grep, Glob, Edit, Write` as a set
- AND it contains neither `Bash` nor `mcp__`

### Requirement: Skill declaration

Frontmatter `skills` MUST be a block list containing `docs-writing`.

#### Scenario: Skills field

- GIVEN `catalog/agents/docs-writer.md`
- WHEN its `skills` frontmatter is inspected
- THEN it lists `docs-writing`

### Requirement: Skill requirement stop-and-report

The body MUST contain a `## Requirements` section stating that, when the `docs-writing` rules are not in context, the agent MUST stop and report that the skill must be installed, and MUST NOT improvise a documentation style. Installing the agent MUST NOT install the skill; dependency resolution is out of scope.

#### Scenario: Skill missing

- GIVEN the `docs-writing` rules are not in the agent context
- WHEN the agent is invoked
- THEN it stops and reports that the `docs-writing` skill must be installed
- AND writes no documentation

#### Scenario: No dependency installation

- GIVEN `init --agents docs-writer` applies on a target without `docs-writing`
- WHEN the install completes
- THEN only the agent is installed

### Requirement: Follows the docs-writing skill

The body MUST instruct the agent to follow the `docs-writing` skill rules when writing or updating documentation, README sections, guides, code comments and JSDoc. The body MUST NOT define an alternative documentation style.

#### Scenario: Documentation task

- GIVEN the skill rules are in context and a caller asks to update a README section
- WHEN the agent runs
- THEN it reads the relevant files with Read, Grep and Glob
- AND edits the documentation following the `docs-writing` rules

### Requirement: Write scope limited to documentation and comments

The body MUST state that Edit and Write are used only on documentation files and on comments or JSDoc inside source files. The agent MUST NOT change behavior (code logic, configuration, tests), MUST NOT edit agent instruction files, and MUST NOT write PR text or commit messages. This is a prompt-level restriction; tool allowlists cannot restrict paths and hard enforcement is out of scope.

#### Scenario: Comment-only change in source

- GIVEN a caller asks to add JSDoc to an exported function
- WHEN the agent edits the source file
- THEN only comments or JSDoc change
- AND code logic is unchanged

#### Scenario: Behavior change refused

- GIVEN a caller asks the agent to change code logic, configuration or tests
- WHEN the agent runs
- THEN it does not edit those files
- AND tells the caller it only writes documentation and comments

#### Scenario: Out-of-scope artifacts refused

- GIVEN a caller asks for PR text, a commit message or an edit to an agent instruction file
- WHEN the agent runs
- THEN it does not produce or edit them

### Requirement: No-Bash limitation handling

The body MUST state that the agent cannot run docs generators, check scripts or `git diff`. When the skill needs them, the agent MUST ask the caller to run them or to provide the diff, or report them as not run. It MUST NOT claim that generated documentation is in sync.

#### Scenario: Generator required

- GIVEN the documentation change affects generated docs
- WHEN the agent finishes
- THEN it asks the caller to run the generator or reports it as not run
- AND does not claim the generated docs are in sync

#### Scenario: Diff needed

- GIVEN the task depends on what changed in the repository
- WHEN the agent runs
- THEN it asks the caller to provide the diff
- AND does not attempt to run `git diff`

### Requirement: Generic English content without project name or attribution

The agent MUST be written in concise English and be generic (usable in any repository). The file MUST NOT contain the project name `shitaku` nor `Co-Authored-By` or any AI attribution.

#### Scenario: Generic content

- GIVEN `catalog/agents/docs-writer.md`
- WHEN its content is inspected
- THEN it is non-empty English
- AND contains neither `shitaku` nor `Co-Authored-By`

### Requirement: Bundled agent skills reference catalog skills

Every `skills:` entry of every bundled agent (existing and new) MUST exist in the catalog `items.skills`. A repository test MUST enforce this and MUST fail when an agent lists a skill absent from `items.skills`. This is a CI guard only; it adds no runtime behavior and does not resolve user-side missing installs. (Placed here instead of the `catalog` capability because it is a repository test guard, not loader behavior; the `catalog` spec is unchanged.)

#### Scenario: All preloads resolve

- GIVEN the bundled catalog and all bundled agents
- WHEN the guard test runs
- THEN every agent `skills:` entry is present in `items.skills`

#### Scenario: Dangling preload detected

- GIVEN a bundled agent whose `skills:` lists a skill not in `items.skills`
- WHEN the guard test runs
- THEN it fails and names the agent and the missing skill

### Requirement: Installable create when absent

When the target is absent, `init --agents docs-writer --dry-run` MUST classify `create` for `./.claude/agents/docs-writer.md` (project scope) and MUST NOT write files, backups or manifest. A user-scope install MUST target `~/.claude/agents/docs-writer.md`. Applied install MUST be byte-identical under existing agents-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target file for `docs-writer`
- WHEN `init --agents docs-writer --scope project --dry-run` runs
- THEN the plan classifies `docs-writer` as `create` for `./.claude/agents/docs-writer.md`
- AND no file, backup or manifest changes occur

#### Scenario: User-scope target path

- GIVEN a user-scope install of `docs-writer`
- WHEN the plan is computed
- THEN the target is `~/.claude/agents/docs-writer.md`

#### Scenario: Byte-identical install

- GIVEN the bundled agent and an absent target
- WHEN `init --agents docs-writer` applies successfully
- THEN the target file is byte-identical to the catalog file

### Requirement: Catalog-only surface with synced docs

Delivery MUST be catalog data, tests, CONTRIBUTING text and regenerated docs only. `src/` hexagonal layers, `catalog/skills/docs-writing/SKILL.md` and `catalog/profiles/` MUST remain unchanged, and the agent MUST NOT be added to any profile. The README agents table and website catalog pages (en, es) MUST be regenerated so the docs check scripts pass. CONTRIBUTING MUST stay accurate with three bundled agents instead of stating that the catalog ships two.

#### Scenario: No src changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/`, `catalog/skills/docs-writing/SKILL.md` and `catalog/profiles/` are unchanged

#### Scenario: Generated docs in sync

- GIVEN `docs-writer` is registered in the catalog
- WHEN `docs:catalog:check` and `docs:website-catalog:check` run
- THEN both pass
- AND README and website en/es list `docs-writer`

#### Scenario: CONTRIBUTING updated

- GIVEN the agents section of CONTRIBUTING
- WHEN it is read after this change
- THEN it is accurate with three bundled agents
- AND no longer says the bundled catalog ships two agents

# socratic-challenger-agent Specification

## Purpose

Catalog-bundled **socratic-challenger** agent: a generic English Claude Code sub-agent that challenges a caller's idea, plan or decision with questions following the `socratic-method` skill, optionally summarizes decisions, and records a Q&A log. It never implements features. It is the second bundled agent and uses least-privilege tools (no `Bash`). Installable via existing agents-install.

## ADDED Requirements

### Requirement: Bundled registration and valid agent file

The bundled catalog MUST list `socratic-challenger` in `items.agents` (after `pr-creator`) and MUST ship `catalog/agents/socratic-challenger.md`. The file MUST have YAML frontmatter with a single-line `name` equal to `socratic-challenger`, a single-line plain-scalar `description`, a `tools` field and a `skills` field, followed by a non-empty body. The agent MUST pass `parseAgent` and the catalog MUST load without issues.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN agent `socratic-challenger` is available and valid
- AND `items.agents` equals `['pr-creator', 'socratic-challenger']`
- AND the catalog reports no issues

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `socratic-challenger`
- WHEN the agent is parsed or the catalog is loaded
- THEN the agent MUST NOT be selectable
- AND the error MUST name the offending path and reason

### Requirement: Description is a plain single-line scalar

The `description` MUST be a single line, MUST NOT contain a colon followed by a space or any quote character, and MUST state that the agent is used on demand, asks questions, optionally summarizes decisions, writes a Q&A log, does not implement features, and requires the `socratic-method` skill.

#### Scenario: Description shape

- GIVEN `catalog/agents/socratic-challenger.md`
- WHEN its `description` is inspected
- THEN it is on one line
- AND it contains neither `: ` nor quote characters
- AND it mentions the `socratic-method` skill requirement

### Requirement: Least-privilege tools

Frontmatter `tools` MUST be exactly `Read, Grep, Glob, Edit, Write`. It MUST NOT include `Bash` or any MCP tool.

#### Scenario: Exact tools

- GIVEN `catalog/agents/socratic-challenger.md`
- WHEN its `tools` frontmatter is inspected
- THEN it equals `Read, Grep, Glob, Edit, Write`
- AND it does not contain `Bash`

### Requirement: Skill declaration

Frontmatter `skills` MUST be a block list containing `socratic-method`.

#### Scenario: Skills field

- GIVEN `catalog/agents/socratic-challenger.md`
- WHEN its `skills` frontmatter is inspected
- THEN it lists `socratic-method`

### Requirement: On-demand entry, not an SDD phase

The agent MUST be invoked on demand by a caller who wants an idea, plan or decision challenged. It MUST NOT be part of, or require, any SDD phase, and the body MUST NOT depend on SDD artifacts to run.

#### Scenario: Standalone invocation

- GIVEN a caller asks to challenge a plan outside any SDD flow
- WHEN the agent is invoked
- THEN it runs without any SDD phase or artifact
- AND challenges the plan with questions

### Requirement: Question-first challenge following the skill

The body MUST instruct the agent to follow the `socratic-method` skill rules and tone, to challenge the caller's idea, plan or decision primarily by asking questions, and to ground questions by reading relevant local files with Read, Grep and Glob. The body MUST NOT define an alternative questioning style or a tone switch.

#### Scenario: Questions grounded in local files

- GIVEN the caller supplies a plan that references local files
- WHEN the agent challenges it
- THEN it reads the relevant files with Read, Grep and Glob
- AND returns questions that follow the `socratic-method` rules and tone

### Requirement: Sub-agent turn model

Every invocation MUST be independent. The body MUST instruct the agent to return its questions and stop, without waiting for answers in the same invocation. The caller relays the user's answers in a later invocation; continuity across invocations is carried by the Q&A log when one is in use.

#### Scenario: Questions returned and stop

- GIVEN a first invocation with a plan to challenge
- WHEN the agent finishes its turn
- THEN it returns its questions
- AND stops without assuming answers

#### Scenario: Answers relayed in a later invocation

- GIVEN a later invocation carrying the caller's relayed answers and the Q&A log path
- WHEN the agent runs
- THEN it continues the challenge using the log for earlier context
- AND records the new exchange in the log

### Requirement: Optional decision summary

The agent MUST produce a decision summary only when the caller asks for it or the answers have closed every open question. It MUST NOT emit one unprompted otherwise.

#### Scenario: Summary on request

- GIVEN the caller asks for a summary of decisions
- WHEN the agent runs
- THEN it returns a decision summary based on the exchange so far

#### Scenario: No unprompted summary

- GIVEN the answers have not closed every open question and no summary was requested
- WHEN the agent runs
- THEN it returns questions only

### Requirement: Edit and Write only for the Q&A log

The body MUST state that Edit and Write are used only for the Q&A log file at the path given by the caller. The agent MUST NOT use them to implement features, nor to edit source, specs, designs, tests, configuration or any other existing artifact.

#### Scenario: Log written at the caller path

- GIVEN the caller provides a Q&A log path
- WHEN the agent records an exchange
- THEN it writes only to that path

#### Scenario: Other writes refused

- GIVEN the caller asks the agent to implement a feature or edit a spec, design or source file
- WHEN the agent runs
- THEN it does not write or edit that file
- AND tells the caller it only writes the Q&A log

### Requirement: No default log path

The agent MUST NOT assume, derive or invent a default Q&A log path. When the caller gave no path and has not said no log is wanted, the body MUST instruct the agent to ask the caller for a path and to write nothing until it has one.

#### Scenario: No path provided

- GIVEN the caller gave no path and has not said no log is wanted
- WHEN the agent runs
- THEN it asks the caller for a log path
- AND it writes no file

#### Scenario: Path provided later

- GIVEN the agent previously asked for a path
- WHEN a later invocation supplies one
- THEN the agent writes the log at exactly that path

### Requirement: Log opt-out

When the caller says no log is wanted, the agent MUST write nothing and MUST NOT ask for a path again in that invocation.

#### Scenario: Caller declines a log

- GIVEN the caller says no log is wanted
- WHEN the agent runs
- THEN no file is written
- AND no path is requested
- AND questions are still returned

#### Scenario: Opt-out wins over missing path

- GIVEN no path and an explicit opt-out
- WHEN the agent runs
- THEN the agent asks no path question

### Requirement: Q&A log write scope

A missing file MUST be created with Write in the log format (first line `# Q&A log: <topic>`). An existing file whose first line starts with `# Q&A log` MUST be appended to with Edit, and earlier content MUST NOT be changed or deleted. An existing file that is not a Q&A log MUST be left untouched and reported, and another path MUST be requested. Write MUST NOT be used on an existing file.

#### Scenario: Create a missing log

- GIVEN a path that does not exist
- WHEN the agent records round 1
- THEN it creates the file with Write
- AND the first line starts with `# Q&A log`

#### Scenario: Append to an existing log

- GIVEN a path whose first line starts with `# Q&A log`
- WHEN the agent records a new round
- THEN it appends with Edit
- AND earlier content is unchanged

#### Scenario: Refuse a non-log file

- GIVEN a path to an existing file that is not a Q&A log
- WHEN the agent runs
- THEN it writes nothing and reports the file
- AND asks for another path

### Requirement: No feature implementation

The body MUST state that the agent does not implement features, and the description MUST state the same.

#### Scenario: Implementation request

- GIVEN a caller asks the agent to implement the challenged plan
- WHEN the agent runs
- THEN it does not implement it
- AND tells the caller it only challenges, summarizes and logs

### Requirement: Skill requirement stop-and-report

The body MUST contain a `## Requirements` section stating that, when the `socratic-method` rules are not in context, the agent MUST stop and report that the skill must be installed, and MUST NOT improvise a questioning style. Installing the agent MUST NOT install the skill; dependency resolution is out of scope.

#### Scenario: Skill missing

- GIVEN the `socratic-method` rules are not in the agent context
- WHEN the agent is invoked
- THEN it stops and reports that the `socratic-method` skill must be installed
- AND asks no improvised questions

#### Scenario: No dependency installation

- GIVEN `init --agents socratic-challenger` applies on a target without `socratic-method`
- WHEN the install completes
- THEN only the agent is installed

### Requirement: Generic English content without project name or attribution

The agent MUST be written in concise English and be generic (usable in any repository). The file MUST NOT contain the project name `shitaku` nor `Co-Authored-By` or any AI attribution.

#### Scenario: Generic content

- GIVEN `catalog/agents/socratic-challenger.md`
- WHEN its content is inspected
- THEN it is non-empty English
- AND contains neither `shitaku` nor `Co-Authored-By`

### Requirement: Installable create when absent

When the target is absent, `init --agents socratic-challenger --dry-run` MUST classify `create` for `./.claude/agents/socratic-challenger.md` (project scope) and MUST NOT write files, backups or manifest. A user-scope install MUST target `~/.claude/agents/socratic-challenger.md`. Applied install MUST be byte-identical under existing agents-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target file for `socratic-challenger`
- WHEN `init --agents socratic-challenger --scope project --dry-run` runs
- THEN the plan classifies `socratic-challenger` as `create` for `./.claude/agents/socratic-challenger.md`
- AND no file, backup or manifest changes occur

#### Scenario: User-scope target path

- GIVEN a user-scope install of `socratic-challenger`
- WHEN the plan is computed
- THEN the target is `~/.claude/agents/socratic-challenger.md`

#### Scenario: Byte-identical install

- GIVEN the bundled agent and an absent target
- WHEN `init --agents socratic-challenger` applies successfully
- THEN the target file is byte-identical to the catalog file

### Requirement: Catalog-only surface with synced docs

Delivery MUST be catalog data, tests, CONTRIBUTING text and regenerated docs only. `src/` hexagonal layers, `catalog/skills/socratic-method/SKILL.md` and `catalog/profiles/` MUST remain unchanged. The README agents table and website catalog pages (en, es) MUST be regenerated so the docs check scripts pass. CONTRIBUTING MUST stay accurate with two bundled agents instead of stating that the catalog ships one.

#### Scenario: No src changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/`, `catalog/skills/socratic-method/SKILL.md` and `catalog/profiles/` are unchanged

#### Scenario: Generated docs in sync

- GIVEN `socratic-challenger` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `socratic-challenger`

#### Scenario: CONTRIBUTING updated

- GIVEN the agents section of CONTRIBUTING
- WHEN it is read after this change
- THEN it is accurate with two bundled agents
- AND no longer says the bundled catalog ships one agent

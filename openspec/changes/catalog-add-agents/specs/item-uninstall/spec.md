# Delta for Item Uninstall

## ADDED Requirements

### Requirement: Agent uninstall resolution

`uninstall <name> --kind agent` MUST resolve to the owned agent of that name in the selected scope and apply the behavior defined in `agents-install` (Agent uninstall). Ownership MUST be located by absolute file path.

#### Scenario: Agent removed by kind

- GIVEN agent `reviewer` is owned and unmodified
- WHEN `uninstall reviewer --kind agent` runs
- THEN the file is removed, a backup exists, and exit is 0

#### Scenario: Dry run

- GIVEN owned `reviewer`
- WHEN `uninstall reviewer --kind agent --dry-run` runs
- THEN the planned removal is printed and nothing is written

## MODIFIED Requirements

### Requirement: Command surface

The system MUST provide `uninstall <name>` with `--scope project|user`, `--kind mcp|skill|script|command|hook|agent`, `--dry-run`, and `--force`. It MUST NOT prompt for confirmation.
(Previously: `--kind` allowed mcp|skill|script|command|hook)

#### Scenario: Valid agent kind

- GIVEN owned agent `reviewer`
- WHEN `uninstall reviewer --kind agent` runs
- THEN the agent is removed and exit is 0

#### Scenario: Invalid kind

- WHEN `uninstall x --kind widget` runs
- THEN it exits non-zero with a choices error that lists `agent` and writes nothing

### Requirement: Kind collision

When the name is owned as more than one of MCP, skill, script, command, hook, or agent, the system MUST exit 1 listing the candidates (kind, scope) and write nothing. `--kind` MUST resolve it.
(Previously: collision did not cover agents)

#### Scenario: Skill and agent share a name

- GIVEN `x` is owned as skill and as agent
- WHEN `uninstall x` runs
- THEN exit is 1, candidates are listed, and nothing is written

#### Scenario: Disambiguated

- GIVEN the same state
- WHEN `uninstall x --kind agent` runs
- THEN only the agent file is removed and the skill remains

#### Scenario: Command and agent share a name

- GIVEN `x` is owned as command and as agent
- WHEN `uninstall x --kind command` runs
- THEN only the command is removed and the agent file stays

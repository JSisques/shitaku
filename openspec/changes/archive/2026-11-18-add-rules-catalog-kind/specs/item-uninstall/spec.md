# Delta for Item Uninstall

## ADDED Requirements

### Requirement: Rule uninstall resolution

`uninstall <name> --kind rule` MUST resolve to the owned rule of that name in the selected scope and apply the behavior defined in `rules-install` (Rule uninstall). Ownership MUST be located by absolute file path.

#### Scenario: Rule removed by kind

- GIVEN rule `no-secrets` is owned and unmodified
- WHEN `uninstall no-secrets --kind rule` runs
- THEN the file is removed, a backup exists, and exit is 0

#### Scenario: Dry run

- GIVEN owned `no-secrets`
- WHEN `uninstall no-secrets --kind rule --dry-run` runs
- THEN the planned removal is printed and nothing is written

## MODIFIED Requirements

### Requirement: Command surface

The system MUST provide `uninstall <name>` with `--scope project|user`, `--kind mcp|skill|script|command|hook|agent|rule`, `--dry-run`, and `--force`. It MUST NOT prompt for confirmation.
(Previously: `--kind` allowed mcp|skill|script|command|hook|agent)

#### Scenario: Valid rule kind

- GIVEN owned rule `no-secrets`
- WHEN `uninstall no-secrets --kind rule` runs
- THEN the rule is removed and exit is 0

#### Scenario: Invalid kind

- WHEN `uninstall x --kind widget` runs
- THEN it exits non-zero with a choices error that lists `rule` and writes nothing

### Requirement: Kind collision

When the name is owned as more than one of MCP, skill, script, command, hook, agent, or rule, the system MUST exit 1 listing the candidates (kind, scope) and write nothing. `--kind` MUST resolve it.
(Previously: collision did not cover rules)

#### Scenario: Skill and rule share a name

- GIVEN `x` is owned as skill and as rule
- WHEN `uninstall x` runs
- THEN exit is 1, candidates are listed, and nothing is written

#### Scenario: Disambiguated

- GIVEN the same state
- WHEN `uninstall x --kind rule` runs
- THEN only the rule file is removed and the skill remains

#### Scenario: Agent and rule share a name

- GIVEN `x` is owned as agent and as rule
- WHEN `uninstall x --kind agent` runs
- THEN only the agent is removed and the rule file stays

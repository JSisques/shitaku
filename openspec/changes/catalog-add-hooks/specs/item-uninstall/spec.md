# Delta for Item Uninstall

## ADDED Requirements

### Requirement: Hook uninstall

`uninstall <name> --kind hook` MUST remove only the owned handler from its settings file, back up the pre-removal bytes, journal action `remove`, and exit 0. Other handlers, groups, events, and unknown keys MUST remain unchanged and in order. A group or event MUST be removed only if shitaku created it and it is now empty. An edited handler is indistinguishable from a removed one (design decision c), so both MUST be reported as "already absent", write nothing, and exit 0; a hook MUST never be reported as modified, and `--force` MUST have no effect on hooks. A malformed settings file MUST exit non-zero without writing.

#### Scenario: Unmodified hook removed

- GIVEN hook `fmt` is owned and its handler is unchanged
- WHEN `uninstall fmt --kind hook` runs
- THEN the handler is removed, user hooks remain, a backup exists, and exit is 0

#### Scenario: Shared group kept

- GIVEN the handler shares a matcher group with a user handler
- WHEN `uninstall fmt --kind hook` runs
- THEN only the shitaku handler is removed

#### Scenario: Edited hook treated as absent

- GIVEN the user edited the command of owned `fmt`
- WHEN `uninstall fmt --kind hook` runs, with or without `--force`
- THEN "already absent" is reported, nothing is written, and exit is 0

#### Scenario: Already absent

- GIVEN `fmt` is owned but its handler was deleted
- WHEN `uninstall fmt --kind hook` runs
- THEN "already absent" is reported, nothing changes, and exit is 0

#### Scenario: Undo restores hook

- GIVEN `fmt` was uninstalled
- WHEN `undo` runs
- THEN the original bytes are restored and `fmt` is owned again

## MODIFIED Requirements

### Requirement: Command surface

The system MUST provide `uninstall <name>` with `--scope project|user`, `--kind mcp|skill|script|command|hook`, `--dry-run`, and `--force`. It MUST NOT prompt for confirmation.
(Previously: `--kind` allowed mcp|skill|script|command)

#### Scenario: Unmodified MCP removed

- GIVEN MCP `github` is owned and its entry hash equals the recorded hash
- WHEN `uninstall github` runs
- THEN the entry is removed, a backup exists, and exit is 0

#### Scenario: Unmodified skill removed

- GIVEN skill `demo` is owned and its tree hash equals the recorded hash
- WHEN `uninstall demo` runs
- THEN the skill directory is removed, a backup exists, and exit is 0

#### Scenario: Unmodified script removed

- GIVEN script `lint` is owned and its tree hash equals the recorded hash
- WHEN `uninstall lint --kind script` runs
- THEN the script directory is removed, a backup exists, and exit is 0

#### Scenario: Invalid kind

- WHEN `uninstall x --kind widget` runs
- THEN it exits non-zero with a choices error and writes nothing

### Requirement: Kind collision

When the name is owned as more than one of MCP, skill, script, command, or hook, the system MUST exit 1 listing the candidates (kind, scope) and write nothing. `--kind` MUST resolve it.
(Previously: collision covered MCP, skill, script, and command only)

#### Scenario: Ambiguous

- GIVEN `x` is owned as skill and hook, or command and hook
- WHEN `uninstall x` runs
- THEN exit is 1, candidates are listed, and nothing is written

#### Scenario: Disambiguated

- GIVEN the same state
- WHEN `uninstall x --kind hook` or `--kind skill` runs
- THEN only the selected kind is removed

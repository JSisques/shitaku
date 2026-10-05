# Delta for Item Uninstall

## MODIFIED Requirements

### Requirement: Command surface

The system MUST provide `uninstall <name>` with `--scope project|user`, `--kind mcp|skill|script`, `--dry-run`, and `--force`. It MUST NOT prompt for confirmation.
(Previously: `--kind` allowed only mcp|skill)

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

### Requirement: Kind collision

When the name is owned as more than one of MCP, skill, or script, the system MUST exit 1 listing the candidates (kind, scope) and write nothing. `--kind` MUST resolve it.
(Previously: collision covered only MCP vs skill)

#### Scenario: Ambiguous

- GIVEN `x` is owned as MCP and skill, or skill and script
- WHEN `uninstall x` runs
- THEN exit is 1, candidates are listed, and nothing is written

#### Scenario: Disambiguated

- GIVEN the same state
- WHEN `uninstall x --kind skill` or `--kind script` runs
- THEN only the selected kind is removed

## ADDED Requirements

### Requirement: Modified script uninstall

If a script's current tree hash differs from the recorded hash, uninstall MUST exit 3 without writing unless `--force`. With `--force`, only recorded files MUST be deleted, and the directory MUST be removed only if empty.

#### Scenario: Modified script refused

- GIVEN the user edited an owned script file
- WHEN `uninstall lint --kind script` runs without `--force`
- THEN exit is 3 and nothing is written

#### Scenario: Forced script keeps user files

- GIVEN script `lint` has an extra user file
- WHEN `uninstall lint --kind script --force` runs
- THEN recorded files are deleted, the extra file and directory remain, and exit is 0

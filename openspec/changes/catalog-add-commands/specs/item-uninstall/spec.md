# Delta for Item Uninstall

## ADDED Requirements

### Requirement: Command uninstall

`uninstall <name> --kind command` MUST remove the owned command file when its hash equals the recorded hash, back it up, journal action `remove`, and exit 0. If the hash differs it MUST exit 3 without writing unless `--force`; with `--force` it MUST remove only the recorded file and MUST NOT remove other files in the commands directory. The commands directory MUST be removed only if shitaku created it and it is empty. If the file is absent it MUST report "already absent", write nothing, and exit 0.

#### Scenario: Unmodified command removed

- GIVEN command `review` is owned and its file hash equals the recorded hash
- WHEN `uninstall review --kind command` runs
- THEN the file is removed, a backup exists, and exit is 0

#### Scenario: Modified command refused

- GIVEN the user edited an owned `review.md`
- WHEN `uninstall review --kind command` runs without `--force`
- THEN exit is 3 and nothing is written

#### Scenario: Forced removal keeps neighbors

- GIVEN modified `review.md` beside user file `mine.md`
- WHEN `uninstall review --kind command --force` runs
- THEN `review.md` is removed, `mine.md` and the directory remain, and exit is 0

#### Scenario: Undo restores command

- GIVEN `review` was uninstalled
- WHEN `undo` runs
- THEN the original bytes are restored and `review` is owned again

#### Scenario: Already absent

- GIVEN `review` is owned but its file was deleted
- WHEN `uninstall review --kind command` runs
- THEN "already absent" is reported, nothing changes, and exit is 0

## MODIFIED Requirements

### Requirement: Command surface

The system MUST provide `uninstall <name>` with `--scope project|user`, `--kind mcp|skill|script|command`, `--dry-run`, and `--force`. It MUST NOT prompt for confirmation.
(Previously: `--kind` allowed mcp|skill|script)

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

When the name is owned as more than one of MCP, skill, script, or command, the system MUST exit 1 listing the candidates (kind, scope) and write nothing. `--kind` MUST resolve it.
(Previously: collision covered MCP, skill, and script only)

#### Scenario: Ambiguous

- GIVEN `x` is owned as skill and command, or MCP and command
- WHEN `uninstall x` runs
- THEN exit is 1, candidates are listed, and nothing is written

#### Scenario: Disambiguated

- GIVEN the same state
- WHEN `uninstall x --kind command` or `--kind skill` runs
- THEN only the selected kind is removed

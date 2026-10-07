# Item Uninstall Specification

## Purpose

`shitaku uninstall <name>` removes one shitaku-owned MCP or skill safely: backed up, journaled, and undoable.

## Requirements

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

### Requirement: Resolution and ownership

The item MUST be resolved from owned-item replay of the manifest. If the name is owned in exactly one scope, the scope MUST be inferred; `--scope` narrows otherwise. A name not owned MUST exit 1 with nothing written. `--force` MUST NOT override ownership.

#### Scenario: Not installed

- GIVEN `ghost` is not owned, even if present on disk unmanaged
- WHEN `uninstall ghost --force` runs
- THEN exit is 1 and nothing is written

#### Scenario: Scope inferred

- GIVEN `fs` is owned only in user scope
- WHEN `uninstall fs` runs
- THEN the user-scope item is removed

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

### Requirement: Modified items

If the current hash differs from the recorded hash, the system MUST exit 3 without writing unless `--force`. With `--force`, an MCP entry MUST be removed; a skill MUST have only recorded files deleted, and its directory MUST be removed only if empty.

#### Scenario: Modified refused

- GIVEN the user edited `mcpServers.github`
- WHEN `uninstall github` runs
- THEN exit is 3 and nothing is written

#### Scenario: Forced skill keeps user files

- GIVEN skill `demo` has an extra user file
- WHEN `uninstall demo --force` runs
- THEN recorded files are deleted, the extra file and directory remain, and exit is 0

### Requirement: Already absent

If the item is owned but absent on disk, the system MUST report "already absent", write nothing, and exit 0.

#### Scenario: Absent

- GIVEN `demo` is owned but its directory was deleted
- WHEN `uninstall demo` runs
- THEN "already absent" is reported, no file changes, exit 0

### Requirement: Dry run

With `--dry-run` the system MUST print the planned removal and MUST NOT create, modify, or delete any file, including backups and manifest.

#### Scenario: Dry run

- GIVEN an owned unmodified item
- WHEN `uninstall <name> --dry-run` runs
- THEN the plan is printed and the filesystem is unchanged

#### Scenario: Dry run on a modified item

- GIVEN an owned item whose current hash differs from the recorded hash
- WHEN `uninstall <name> --dry-run` runs without `--force`
- THEN the refusal is printed, exit is 3 (same as a real run), and the filesystem is unchanged

### Requirement: Journaled and undoable

A removal MUST be recorded as a normal install in the manifest, with item action `remove` and a backup of the pre-removal bytes.

#### Scenario: Undo restores

- GIVEN `github` was uninstalled
- WHEN `undo` runs
- THEN the original entry bytes are restored and the item is owned again

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

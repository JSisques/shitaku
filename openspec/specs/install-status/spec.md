# Install Status Specification

## Purpose

A read-only `shitaku status` command that reports every active, shitaku-managed item (MCPs and skills) and its state, as text or versioned JSON.

## Requirements

### Requirement: Manifest-driven read-only report

`status` MUST list only items recorded by installs with `undoneAt === null`. It MUST NOT write to configs, skill directories, script directories, command files, backups, or the manifest. Each item MUST carry `kind` (`mcp`, `skill`, `script`, or `command`; the model MUST allow further kinds), `name`, `scope`, `state`, `path`, and `installId`. Items MUST be keyed by scope, path, and name. The output MUST show the agent target. Text output MUST group items by scope, then by kind. A command's `path` MUST be its file path.
(Previously: kinds were mcp|skill|script)

#### Scenario: Active items listed

- GIVEN one active install with MCP `fs`, skill `demo`, script `lint`, and command `review`
- WHEN `shitaku status` runs
- THEN all four are listed with kind, scope, state, and path

#### Scenario: Undone install ignored

- GIVEN an install with `undoneAt` set
- WHEN `status` runs
- THEN none of its items appear

#### Scenario: Same name in two scopes

- GIVEN command `review` installed in project and user scope
- WHEN `status` runs
- THEN two distinct `review` items are listed, one per scope

#### Scenario: No writes

- GIVEN any manifest and disk state
- WHEN `status` runs
- THEN no file or directory is created, modified, or removed

### Requirement: Scope selection

By default `status` MUST report both scopes. `--scope project|user` MUST restrict the report to that scope.

#### Scenario: Default both scopes

- GIVEN active items in project and user scope
- WHEN `status` runs without `--scope`
- THEN items of both scopes are listed

#### Scenario: Scope filter

- GIVEN the same items
- WHEN `status --scope user` runs
- THEN only user-scope items are listed

### Requirement: Item states

Each item MUST have exactly one state, evaluated in this order:

| State                  | Condition                                                                    |
| ---------------------- | ---------------------------------------------------------------------------- |
| `missing`              | MCP entry, skill directory, script directory, or command file absent on disk |
| `modified`             | current hash differs from hash recorded at install                           |
| `missing-from-catalog` | item not in the catalog                                                      |
| `out-of-date`          | current equals recorded, catalog hash differs                                |
| `installed`            | current, recorded, and catalog hashes equal                                  |

`modified` MUST win over `out-of-date`. Hashes are entry hash for MCPs, tree hash for skills and scripts, and file-bytes hash for commands. For an MCP, only its own entry is compared.
(Previously: no command file state)

#### Scenario: Installed

- GIVEN disk, manifest, and catalog hashes equal
- WHEN `status` runs
- THEN the item is `installed`

#### Scenario: Modified wins

- GIVEN the user edited the item and the catalog also changed
- WHEN `status` runs
- THEN the item is `modified`

#### Scenario: Out of date

- GIVEN the item is untouched and the catalog hash differs
- WHEN `status` runs
- THEN the item is `out-of-date`

#### Scenario: Missing and missing-from-catalog

- GIVEN command `a` deleted from disk and MCP `b` removed from catalog
- WHEN `status` runs
- THEN `a` is `missing` and `b` is `missing-from-catalog`

#### Scenario: Unrelated config changes

- GIVEN Claude Code rewrote other entries in `~/.claude.json`
- WHEN `status` runs
- THEN the shitaku MCP entry is still `installed`

#### Scenario: Unlisted user command ignored

- GIVEN `mine.md` sits beside owned `review.md`
- WHEN `status` runs
- THEN `mine` is not listed

### Requirement: Unsafe and unreadable skill trees

A skill tree with symlinks, special files, or unreadable content MUST NOT abort `status`. It MUST be reported as `modified` for that item only, and other items MUST still be classified.

#### Scenario: Symlink in skill

- GIVEN a recorded skill file was replaced by a symlink
- WHEN `status` runs
- THEN that skill is `modified`, other items are reported, and exit is 0

### Requirement: Unreadable config files

An MCP config file that cannot be read or parsed MUST NOT abort `status`. Each item recorded in that file MUST be reported as `modified`, and items in other files MUST still be classified.

#### Scenario: Corrupt config file

- GIVEN the project `.mcp.json` is not valid JSON and the user-scope config is intact
- WHEN `status` runs
- THEN every MCP recorded in `.mcp.json` is `modified`, user-scope items are classified normally, and exit is 0

### Requirement: Catalog source and degraded mode

`status` MUST accept `--source` with the same meaning as in `init`. When the catalog fails to load, `status` MUST NOT abort: it MUST report `catalog unavailable` in the header and report every item whose state depends on the catalog (`installed`, `out-of-date`, `missing-from-catalog`) as `unknown`. States not needing the catalog (`missing`, `modified`) MUST still be reported. In text output the state is shown as `unknown`; in JSON `"state": "unknown"`, and `catalog` is `"unavailable"`.

#### Scenario: Catalog fails to load

- GIVEN the catalog cannot be loaded and skill `demo` is unchanged on disk
- WHEN `status` runs
- THEN the header says `catalog unavailable`, `demo` is `unknown`, and exit is 0

#### Scenario: Degraded still detects local drift

- GIVEN the catalog is unavailable and skill `x` is deleted
- WHEN `status` runs
- THEN `x` is `missing`

#### Scenario: Custom source, known limitation

- GIVEN `demo` was installed with `init --source ./mine` and `status` runs without `--source`
- WHEN `status` compares against the default catalog
- THEN `demo` is `missing-from-catalog` (or `out-of-date` if the default catalog has a different `demo`); passing `--source ./mine` reports it correctly

### Requirement: JSON output

`--json` MUST print one JSON document with `version` (integer, starting at `1`), `target`, `catalog` (`"available"` or `"unavailable"`), and `items`. Each item MUST have `scope`, `kind`, `name`, `state`, `path`, and `installId`. Later changes to the shape MUST be additive.

#### Scenario: JSON shape

- GIVEN an active skill `demo`
- WHEN `status --json` runs
- THEN stdout parses as JSON with `version: 1`, `target: "claude-code"`, and an item with all required fields

### Requirement: Exit codes and manifest errors

`status` MUST exit 0 on every successful run, regardless of item states. A corrupt manifest MUST produce a clear error message and exit 1.

#### Scenario: Drift exits 0

- GIVEN items are `modified` and `missing`
- WHEN `status` runs
- THEN exit is 0

#### Scenario: Corrupt manifest

- GIVEN the manifest is not valid JSON
- WHEN `status` runs
- THEN a clear error is printed, nothing is listed, and exit is 1

#### Scenario: Empty manifest

- GIVEN no manifest or no active installs
- WHEN `status` runs
- THEN it reports no managed items and exits 0

### Requirement: Uninstalled items not reported

Items removed by an uninstall (action `remove`) MUST NOT be listed by `status`, as they are no longer owned.

#### Scenario: Uninstalled item hidden

- GIVEN `demo` was installed and then uninstalled
- WHEN `status` runs
- THEN `demo` is not listed

#### Scenario: Reappears after undo

- GIVEN that uninstall was undone
- WHEN `status` runs
- THEN `demo` is listed again

### Requirement: Unsafe and unreadable script trees

A script tree with symlinks, special files, or unreadable content MUST NOT abort `status`. It MUST be reported as `modified` for that item only, and other items MUST still be classified.

#### Scenario: Symlink in script

- GIVEN a recorded script file was replaced by a symlink
- WHEN `status` runs
- THEN that script is `modified`, other items are reported, and exit is 0

### Requirement: Unsafe and unreadable command files

A command path that is a symlink, a directory, a special file, or unreadable MUST NOT abort `status`. It MUST be reported as `modified` for that item only, and other items MUST still be classified. Command files MUST be observed as single files, never as trees.

#### Scenario: Directory in place of file

- GIVEN `review.md` was replaced by a directory
- WHEN `status` runs
- THEN `review` is `modified`, other items are reported, and exit is 0

#### Scenario: Symlink in place of file

- GIVEN `review.md` was replaced by a symlink
- WHEN `status` runs
- THEN `review` is `modified` and exit is 0

### Requirement: Doctor findings for commands

`doctor` MUST classify an owned command whose file is absent as a missing-item finding naming the command, using the same severity as a missing skill. A present, unmodified command MUST NOT produce a finding. `doctor` MUST NOT write.

#### Scenario: Command deleted

- GIVEN owned command `review` whose file was deleted
- WHEN `doctor` runs
- THEN it reports `review` as missing and writes nothing

#### Scenario: Healthy command

- GIVEN owned `review` unchanged on disk
- WHEN `doctor` runs
- THEN no finding is reported for `review`

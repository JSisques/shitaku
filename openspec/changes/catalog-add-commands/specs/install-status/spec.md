# Delta for Install Status

## ADDED Requirements

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

## MODIFIED Requirements

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

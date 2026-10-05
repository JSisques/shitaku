# Delta for Install Status

## MODIFIED Requirements

### Requirement: Manifest-driven read-only report

`status` MUST list only items recorded by installs with `undoneAt === null`. It MUST NOT write to configs, skill directories, script directories, backups, or the manifest. Each item MUST carry `kind` (`mcp`, `skill`, or `script`; the model MUST allow further kinds), `name`, `scope`, `state`, `path`, and `installId`. Items MUST be keyed by scope, path, and name. The output MUST show the agent target. Text output MUST group items by scope, then by kind.
(Previously: kinds were mcp|skill; no script directories)

#### Scenario: Active items listed

- GIVEN one active install with MCP `fs`, skill `demo`, and script `lint`
- WHEN `shitaku status` runs
- THEN all three are listed with kind, scope, state, and path

#### Scenario: Undone install ignored

- GIVEN an install with `undoneAt` set
- WHEN `status` runs
- THEN none of its items appear

#### Scenario: Same name in two scopes

- GIVEN script `lint` installed in project and user scope
- WHEN `status` runs
- THEN two distinct `lint` items are listed, one per scope

#### Scenario: No writes

- GIVEN any manifest and disk state
- WHEN `status` runs
- THEN no file or directory is created, modified, or removed

### Requirement: Item states

Each item MUST have exactly one state, evaluated in this order:

| State                  | Condition                                                      |
| ---------------------- | -------------------------------------------------------------- |
| `missing`              | MCP entry, skill directory, or script directory absent on disk |
| `modified`             | current hash differs from hash recorded at install             |
| `missing-from-catalog` | item not in the catalog                                        |
| `out-of-date`          | current equals recorded, catalog hash differs                  |
| `installed`            | current, recorded, and catalog hashes equal                    |

`modified` MUST win over `out-of-date`. Hashes are entry hash for MCPs and tree hash for skills and scripts. For an MCP, only its own entry is compared.
(Previously: tree hash/missing covered skills only)

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

- GIVEN script `a` deleted from disk and MCP `b` removed from catalog
- WHEN `status` runs
- THEN `a` is `missing` and `b` is `missing-from-catalog`

#### Scenario: Unrelated config changes

- GIVEN Claude Code rewrote other entries in `~/.claude.json`
- WHEN `status` runs
- THEN the shitaku MCP entry is still `installed`

## ADDED Requirements

### Requirement: Unsafe and unreadable script trees

A script tree with symlinks, special files, or unreadable content MUST NOT abort `status`. It MUST be reported as `modified` for that item only, and other items MUST still be classified.

#### Scenario: Symlink in script

- GIVEN a recorded script file was replaced by a symlink
- WHEN `status` runs
- THEN that script is `modified`, other items are reported, and exit is 0

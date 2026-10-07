# Delta for Install Status

## ADDED Requirements

### Requirement: Unreadable settings files

A settings file that cannot be read or parsed MUST NOT abort `status`. Each hook recorded in that file MUST be reported as `modified` (or per the open decision below), and items in other files MUST still be classified.

#### Scenario: Malformed settings

- GIVEN project `.claude/settings.json` is invalid JSON and user-scope settings are intact
- WHEN `status` runs
- THEN hooks recorded in the project file are reported as drifted, user-scope hooks are classified normally, and exit is 0

### Requirement: Doctor findings for hooks

`doctor` MUST report an owned hook that is absent from its settings file as a finding naming the hook, event, and settings path. It MUST also report an owned hook that was edited, as `missing` (design c). A present, unmodified hook MUST NOT produce a finding. `doctor` MUST NOT write.

#### Scenario: Hook removed

- GIVEN owned hook `fmt` whose handler was deleted from `settings.json`
- WHEN `doctor` runs
- THEN it reports `fmt` and writes nothing

#### Scenario: Hook edited

- GIVEN owned hook `fmt` whose command was edited
- WHEN `doctor` runs
- THEN it reports `fmt` as `hook-missing` and writes nothing

#### Scenario: Healthy hook

- GIVEN owned `fmt` unchanged
- WHEN `doctor` runs
- THEN no finding is reported for `fmt`

## MODIFIED Requirements

### Requirement: Manifest-driven read-only report

`status` MUST list only items recorded by installs with `undoneAt === null`. It MUST NOT write to configs, settings files, skill directories, script directories, command files, backups, or the manifest. Each item MUST carry `kind` (`mcp`, `skill`, `script`, `command`, or `hook`; the model MUST allow further kinds), `name`, `scope`, `state`, `path`, and `installId`. Items MUST be keyed by scope, path, and name. The output MUST show the agent target. Text output MUST group items by scope, then by kind. A hook's `path` MUST be its settings file path. Unrelated changes elsewhere in the settings file MUST NOT affect a hook's state.
(Previously: kinds were mcp|skill|script|command)

#### Scenario: Active items listed

- GIVEN one active install with MCP `fs`, skill `demo`, script `lint`, command `review`, and hook `fmt`
- WHEN `shitaku status` runs
- THEN all five are listed with kind, scope, state, and path

#### Scenario: Undone install ignored

- GIVEN an install with `undoneAt` set
- WHEN `status` runs
- THEN none of its items appear

#### Scenario: Same name in two scopes

- GIVEN hook `fmt` installed in project and user scope
- WHEN `status` runs
- THEN two distinct `fmt` items are listed, one per scope

#### Scenario: No writes

- GIVEN any manifest and disk state
- WHEN `status` runs
- THEN no file or directory is created, modified, or removed

#### Scenario: Unrelated settings changes

- GIVEN Claude Code or the user changed other keys or hooks in `settings.json`
- WHEN `status` runs
- THEN the shitaku hook is still `installed`

### Requirement: Item states

Each item MUST have exactly one state, evaluated in this order:

| State                  | Condition                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `missing`              | MCP entry, skill directory, script directory, command file, or hook handler absent on disk |
| `modified`             | current hash differs from hash recorded at install                                         |
| `missing-from-catalog` | item not in the catalog                                                                    |
| `out-of-date`          | current equals recorded, catalog hash differs                                              |
| `installed`            | current, recorded, and catalog hashes equal                                                |

`modified` MUST win over `out-of-date`. Hashes are entry hash for MCPs, tree hash for skills and scripts, file-bytes hash for commands, and canonical handler hash for hooks. For an MCP or hook, only its own entry or handler is compared. Decided in design (c): a hook whose handler was edited is reported as `missing`, because an edited handler is no longer locatable by canonical match; only an unparseable settings file is reported as `modified`.
(Previously: no hook handler state)

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

- GIVEN hook `a` deleted from `settings.json` and MCP `b` removed from catalog
- WHEN `status` runs
- THEN `a` is `missing` and `b` is `missing-from-catalog`

#### Scenario: Edited hook is reported

- GIVEN the command of owned hook `fmt` was edited in `settings.json`
- WHEN `status` runs
- THEN `fmt` is reported as `missing` (design c), never `installed`

#### Scenario: Unlisted user hook ignored

- GIVEN a user hook sits beside owned `fmt`
- WHEN `status` runs
- THEN the user hook is not listed

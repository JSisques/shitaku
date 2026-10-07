# Commands Install Specification

## Purpose

Plan, apply, and undo Claude Code slash commands (the `command` kind): one flat `.md` file per command, installed into the agent commands directory. Hooks are out of scope.

## Requirements

### Requirement: Command install roots

A command MUST install as the single file `<name>.md`, flat (no subdirectory). User scope MUST target `~/.claude/commands/<name>.md`; project scope MUST target `<cwd>/.claude/commands/<name>.md`. The written bytes MUST be identical to the catalog file. The system MUST NOT touch any other file in the commands directory.

#### Scenario: User and project roots

- GIVEN command `review` and `--scope user` or `--scope project`
- WHEN init applies it
- THEN `~/.claude/commands/review.md` or `<cwd>/.claude/commands/review.md` exists with catalog-identical bytes

#### Scenario: Unrelated user commands untouched

- GIVEN `<cwd>/.claude/commands/mine.md` is user-authored
- WHEN init installs `review` in project scope
- THEN `mine.md` is unchanged

### Requirement: Plan classification

The plan MUST classify each command by SHA-256 of bytes as `create` (absent), `skip` (present equals catalog), `update` (present equals the owned hash, or `--force`), or `conflict` (present, different, not owned). Conflicts MUST appear in the plan.

#### Scenario: Create and skip

- GIVEN `review` is absent, or present with catalog-identical bytes
- WHEN the plan is built
- THEN the action is `create`, or `skip` with no write

#### Scenario: Owned update

- GIVEN `review` is owned, unmodified on disk, and the catalog bytes changed
- WHEN the plan is built
- THEN the action is `update`

#### Scenario: Unmanaged different file

- GIVEN `review.md` exists, differs from the catalog, and is not owned
- WHEN the plan is built
- THEN the action is `conflict`

### Requirement: Conflict, dry-run, and force

A non-interactive run with a conflict and no `--force` MUST write nothing and exit 2. An interactive run MUST warn and ask before replacing. `--dry-run` MUST print the plan only. `--force` MUST first back up the existing file under `~/.claude/.shitaku/backups/`, then replace it.

#### Scenario: Conflict refused

- GIVEN an unmanaged different `review.md` and `--yes` without `--force`
- WHEN init runs
- THEN exit is 2 and no file, backup, or manifest changes

#### Scenario: Forced replace with backup

- GIVEN the same conflict and `--force`
- WHEN init runs
- THEN a byte-identical backup of the old file exists, `review.md` equals the catalog, and undo can restore the old bytes

#### Scenario: Dry run

- GIVEN `--dry-run`
- WHEN init runs
- THEN the plan is printed and the filesystem is unchanged

### Requirement: Selection

`--commands <names>` MUST select commands by name. An unknown name MUST exit non-zero naming it and write nothing. Interactive init MUST offer commands only when the catalog contains at least one.

#### Scenario: Unknown command

- GIVEN `--commands ghost`
- WHEN init runs
- THEN it exits non-zero naming `ghost` and writes nothing

#### Scenario: Prompt hidden when empty

- GIVEN a catalog with no commands
- WHEN interactive init runs
- THEN no command selection prompt appears

### Requirement: Command name and frontmatter

A command name MUST match `^[a-z0-9][a-z0-9-]*$` and equal the filename stem. The file MUST start with single-line YAML frontmatter containing a non-empty `description`; other keys MUST pass through unchanged. Multi-line frontmatter values, missing frontmatter, or an empty body MUST be rejected.

#### Scenario: Valid command

- GIVEN `commands/review.md` with `description: Review a diff` and `argument-hint: [path]`
- WHEN parsed
- THEN it is valid and installed bytes retain both keys

#### Scenario: Invalid names

- GIVEN `Review`, `-x`, or `a_b` as a name
- WHEN validated
- THEN it is rejected naming the name

#### Scenario: Missing or empty description

- GIVEN frontmatter lacks `description`, or it is empty or whitespace
- WHEN parsed
- THEN it is rejected naming the file and `description`

### Requirement: Undo of commands

Undo MUST remove only command files whose hash equals the manifest, restore forced-replace backups, and refuse drift without `--force`. It MUST remove the commands directory only if this install created it and it is empty; it MUST NOT remove a pre-existing or non-empty directory. Undo MUST NOT treat the command file as a directory tree.

#### Scenario: Clean undo prunes created directory

- GIVEN install created `./.claude/commands/` and only `review.md`
- WHEN `undo` runs
- THEN `review.md` and the empty directory are removed

#### Scenario: Shared directory kept

- GIVEN `./.claude/commands/` pre-existed, or now holds `mine.md`
- WHEN `undo` runs
- THEN only `review.md` is removed and the directory stays

#### Scenario: Drift refused

- GIVEN the user edited `review.md` after install
- WHEN `undo` runs without `--force`
- THEN the file is untouched and exit is non-zero

### Requirement: Manifest backward compatibility

Manifests without any `command` entry MUST load and replay unchanged, and the manifest version MUST NOT change.

#### Scenario: Old manifest

- GIVEN a manifest with only mcp, skill, and script entries
- WHEN status, undo, or init runs
- THEN it loads without error

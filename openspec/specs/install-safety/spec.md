# Delta for Install Safety

## ADDED Requirements

### Requirement: Dry run

With `--dry-run`, the system MUST print the plan and MUST NOT create, modify, or delete any file, including backups and manifest.

#### Scenario: Dry run

- GIVEN `init --mcps github --scope user --dry-run`
- WHEN run
- THEN the plan is printed and the filesystem is unchanged

### Requirement: Backup and atomic write

Before modifying an existing file, the system MUST back it up to `~/.claude/.shitaku/backups/`. Writes MUST be atomic (temp file then rename). The target MUST be re-read immediately before writing, and changes made since planning MUST be merged, not lost.

#### Scenario: Backup taken

- GIVEN `~/.claude.json` exists
- WHEN user-scope install applies
- THEN a byte-identical backup exists under `~/.claude/.shitaku/backups/` before the file changes

#### Scenario: Claude wrote meanwhile

- GIVEN `~/.claude.json` gains a key after planning
- WHEN apply runs
- THEN the re-read picks up the key and it survives in the result

#### Scenario: Write failure

- GIVEN the rename fails
- WHEN apply runs
- THEN the original file is intact and the error is reported

### Requirement: Manifest

After a successful apply, the system MUST record each managed entry in `~/.claude/.shitaku/manifest.json` with kind (`mcp`, `skill`, or `script`), file, key path (MCP), backup path, and a SHA-256 hash of the written content. A skill or script MUST be recorded per file plus a per-item tree hash and a flag for directories shitaku created. One install record MUST cover all kinds present. Each item action MAY be `remove`, which records an uninstall. The manifest version MUST NOT change.
(Previously: kinds were mcp|skill only)

#### Scenario: Manifest written

- GIVEN `github`, skill `demo`, and script `lint` are installed
- WHEN apply completes
- THEN the manifest lists each with correct kind and hashes in one install record

#### Scenario: Remove recorded

- GIVEN `lint` is uninstalled
- WHEN uninstall completes
- THEN the manifest has an install record with `lint` action `remove` and version unchanged

### Requirement: Undo

`undo` MUST restore managed files from backups. It MUST first compare current content hashes to the manifest, and MUST refuse for changed entries without `--force`. For skills and scripts it MUST remove only files and directories shitaku created, MUST refuse when the directory contains user-added files or differs from the recorded tree hash, and MUST NOT remove directories that pre-existed the install.
(Previously: tree undo rules covered skills only)

#### Scenario: Clean undo

- GIVEN content matches the manifest hash
- WHEN `undo` runs
- THEN original bytes are restored and entries leave the manifest

#### Scenario: Changed since install

- GIVEN the user edited `mcpServers.github` or a skill/script file after install
- WHEN `undo` runs
- THEN it warns, leaves the entry, and exits non-zero unless `--force`

#### Scenario: Skill or script drift or extra file

- GIVEN `demo/extra.md` or `lint/extra.md` was added by the user
- WHEN `undo` runs without `--force`
- THEN the directory is untouched and exit is non-zero

#### Scenario: Missing backup at undo

- GIVEN a backup file required by `undo` was deleted
- WHEN `undo` runs
- THEN it fails before restoring or removing anything, the manifest still lists the install as not undone, and a rerun fails the same way

#### Scenario: No manifest

- GIVEN no manifest exists
- WHEN `undo` runs
- THEN it reports nothing to undo and changes nothing

### Requirement: Unmanaged protection

The system MUST NOT overwrite or remove entries absent from the manifest without a warning plus confirmation or `--force`.

#### Scenario: Unmanaged same name

- GIVEN `github` exists but is not in the manifest
- WHEN install runs interactively
- THEN the user is warned and asked to confirm before replacement

### Requirement: Secret placeholders

Only `${VAR}` placeholders MUST be written. Resolved env values MUST NOT appear in any written file, manifest, or output.

#### Scenario: Placeholder only

- GIVEN `GITHUB_TOKEN=abc123` is set
- WHEN install applies
- THEN no written file contains `abc123`

### Requirement: Test isolation

All filesystem paths MUST come from injected `homeDir` and `cwd`. Tests MUST NOT touch the real home directory.

#### Scenario: Injected paths

- GIVEN a temp `homeDir` and `cwd`
- WHEN the suite runs
- THEN all reads and writes stay inside them

### Requirement: No legacy state migration

The system MUST NOT read, migrate, or fall back to `~/.claude/.dotagent/`. State lives only under `~/.claude/.shitaku/`.

#### Scenario: Legacy directory ignored

- GIVEN `~/.claude/.dotagent/manifest.json` exists and `~/.claude/.shitaku/` does not
- WHEN `undo` runs
- THEN it reports nothing to undo and leaves the legacy directory untouched

### Requirement: Multi-file write failure

A skill install MUST NOT leave a partially written skill directory. On any write failure the system MUST remove files and directories it created for that skill, restore any replaced directory from backup, report the error, and record no manifest entry for it. Skills MUST be written atomically per file (temp then rename), and the manifest MUST NOT list a skill until all its files are written. Backups written for an install that then fails and is rolled back stay on disk under the state directory; they are referenced by no manifest entry and are not cleaned up automatically, so removing them is a manual step.

#### Scenario: Failure mid-skill

- GIVEN the third of four files fails to write
- WHEN apply runs
- THEN the created files and directories are removed, the error is reported, and the manifest has no entry for the skill

#### Scenario: Failure during forced replace

- GIVEN a forced replace fails after the old directory was backed up
- WHEN apply runs
- THEN the original directory is restored byte-identical

### Requirement: Remove as ownership deletion

Ownership replay MUST treat a `remove` action as deleting ownership of that item. `undo` MUST revert the newest non-undone install even when it is an uninstall.

#### Scenario: Ownership ends

- GIVEN `demo` was installed then uninstalled
- WHEN ownership is replayed
- THEN `demo` is not owned

#### Scenario: Undo of an uninstall

- GIVEN the newest install is an uninstall of `demo`
- WHEN `undo` runs
- THEN `demo` is restored from backup and is owned again

#### Scenario: Config edited after uninstall

- GIVEN an MCP uninstall, then a later edit to the same config file
- WHEN `undo` runs
- THEN it refuses (whole-file restore drift check) and changes nothing

### Requirement: Multi-file script write failure

A script install MUST NOT leave a partially written script directory. On any write failure the system MUST remove files and directories it created for that script, restore any replaced directory from backup, report the error, and record no manifest entry for it. Scripts MUST be written atomically per file (temp then rename), and the manifest MUST NOT list a script until all its files are written. Backups for a rolled-back failed install stay on disk and are not cleaned up automatically.

#### Scenario: Failure mid-script

- GIVEN the third of four files fails to write
- WHEN apply runs
- THEN created files/dirs are removed, error reported, no manifest entry

#### Scenario: Failure during forced script replace

- GIVEN a forced replace fails after the old directory was backed up
- WHEN apply runs
- THEN the original directory is restored byte-identical

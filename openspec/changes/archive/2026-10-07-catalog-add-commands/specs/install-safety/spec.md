# Delta for Install Safety

## ADDED Requirements

### Requirement: Command write failure

A command install MUST NOT leave a partially written file. Commands MUST be written atomically (temp then rename). On any failure the system MUST remove files and directories it created for that command, restore a replaced file from backup byte-identical, report the error, and record no manifest entry for it. The manifest MUST NOT list a command until its file is written. Backups of a rolled-back install stay on disk and are not cleaned up automatically.

#### Scenario: Failure on create

- GIVEN the write of `review.md` fails and `./.claude/commands/` was created by this install
- WHEN apply runs
- THEN the file and the created directory are removed and the manifest has no entry for `review`

#### Scenario: Failure during forced replace

- GIVEN a forced replace fails after the old file was backed up
- WHEN apply runs
- THEN the original file is restored byte-identical

## MODIFIED Requirements

### Requirement: Manifest

After a successful apply, the system MUST record each managed entry in `~/.claude/.shitaku/manifest.json` with kind (`mcp`, `skill`, `script`, or `command`), file, key path (MCP), backup path, and a SHA-256 hash of the written content. A skill or script MUST be recorded per file plus a per-item tree hash and a flag for directories shitaku created. A command MUST be recorded as one file entry (path and hash) plus a flag for the commands directory when shitaku created it. One install record MUST cover all kinds present. Each item action MAY be `remove`, which records an uninstall. The manifest version MUST NOT change. Manifests without `command` entries MUST remain valid.
(Previously: kinds were mcp|skill|script; no single-file kind)

#### Scenario: Manifest written

- GIVEN `github`, skill `demo`, script `lint`, and command `review` are installed
- WHEN apply completes
- THEN the manifest lists each with correct kind and hashes in one install record

#### Scenario: Remove recorded

- GIVEN `review` is uninstalled
- WHEN uninstall completes
- THEN the manifest has an install record with `review` action `remove` and version unchanged

### Requirement: Undo

`undo` MUST restore managed files from backups. It MUST first compare current content hashes to the manifest, and MUST refuse for changed entries without `--force`. For skills and scripts it MUST remove only files and directories shitaku created, MUST refuse when the directory contains user-added files or differs from the recorded tree hash, and MUST NOT remove directories that pre-existed the install. For commands it MUST remove only the recorded file when its hash matches, and MUST remove the commands directory only if shitaku created it and it is empty.
(Previously: undo rules did not cover single-file commands)

#### Scenario: Clean undo

- GIVEN content matches the manifest hash
- WHEN `undo` runs
- THEN original bytes are restored and entries leave the manifest

#### Scenario: Changed since install

- GIVEN the user edited `mcpServers.github` or a skill, script, or command file after install
- WHEN `undo` runs
- THEN it warns, leaves the entry, and exits non-zero unless `--force`

#### Scenario: Skill or script drift or extra file

- GIVEN `demo/extra.md` or `lint/extra.md` was added by the user
- WHEN `undo` runs without `--force`
- THEN the directory is untouched and exit is non-zero

#### Scenario: Command in shared directory

- GIVEN `./.claude/commands/` pre-existed with user files
- WHEN `undo` reverts a command install
- THEN only the installed file is removed and the directory remains

#### Scenario: Missing backup at undo

- GIVEN a backup file required by `undo` was deleted
- WHEN `undo` runs
- THEN it fails before restoring or removing anything, the manifest still lists the install as not undone, and a rerun fails the same way

#### Scenario: No manifest

- GIVEN no manifest exists
- WHEN `undo` runs
- THEN it reports nothing to undo and changes nothing

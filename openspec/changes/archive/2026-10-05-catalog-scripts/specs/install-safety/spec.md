# Delta for Install Safety

## MODIFIED Requirements

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

## ADDED Requirements

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

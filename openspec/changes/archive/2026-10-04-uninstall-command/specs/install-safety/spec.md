# Delta for Install Safety

## MODIFIED Requirements

### Requirement: Manifest

After a successful apply, the system MUST record each managed entry in `~/.claude/.shitaku/manifest.json` with kind (`mcp` or `skill`), file, key path (MCP), backup path, and a SHA-256 hash of the written content. A skill MUST be recorded per file plus a per-skill tree hash and a flag for directories shitaku created. One install record MUST cover both kinds. Each item action MAY be `remove`, which records an uninstall. The manifest version MUST NOT change.
(Previously: item actions did not include `remove`)

#### Scenario: Manifest written

- GIVEN `github` and skill `demo` are installed
- WHEN apply completes
- THEN the manifest lists `github` (kind `mcp`) and `demo` (kind `skill`) with hashes in one install record

#### Scenario: Remove recorded

- GIVEN `github` is uninstalled
- WHEN the uninstall completes
- THEN the manifest has an install record with `github` action `remove` and the manifest version is unchanged

## ADDED Requirements

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

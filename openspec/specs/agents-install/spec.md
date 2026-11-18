# Agents Install Specification

## Purpose

Plan, apply, undo, and uninstall Claude Code sub-agents (the `agent` kind): one flat `.md` file per agent, installed into the agent target's agents directory. Safety model mirrors `commands-install`. Hooks and commands are out of scope. Recursive agent subdirectories and non-Claude targets are out of scope.

## Requirements

### Requirement: Agent install roots

An agent MUST install as the single file `<name>.md`, flat (no subdirectory). User scope MUST target `~/.claude/agents/<name>.md`; project scope MUST target `<cwd>/.claude/agents/<name>.md`. The written bytes MUST be identical to the catalog file. The system MUST NOT touch any other file in the agents directory.

#### Scenario: User and project roots

- GIVEN agent `reviewer` and `--scope user` or `--scope project`
- WHEN init applies it
- THEN `~/.claude/agents/reviewer.md` or `<cwd>/.claude/agents/reviewer.md` exists with catalog-identical bytes

#### Scenario: Nested frontmatter kept verbatim

- GIVEN `agents/reviewer.md` has a multi-line `tools` list and a nested `hooks` block in its frontmatter
- WHEN init applies it
- THEN the installed bytes equal the catalog bytes exactly

#### Scenario: Unrelated user agents untouched

- GIVEN `<cwd>/.claude/agents/mine.md` is user-authored
- WHEN init installs `reviewer` in project scope
- THEN `mine.md` is unchanged

### Requirement: Plan classification

The plan MUST classify each agent by SHA-256 of bytes as `create` (file absent), `skip` (present and equal to the catalog; reason "already installed"), `update` (present and differing, and either `--force` is given or the manifest hash for that absolute path equals the present file; reason "installed by shitaku"), or `conflict` (anything else). Ownership MUST be keyed by absolute file path. A `skip` MUST NOT be journaled. Conflicts MUST appear in the plan. A user file MUST NEVER be silently overwritten. Conflict reasons MUST use the noun `agent`.

#### Scenario: Create

- GIVEN `reviewer.md` is absent in the target
- WHEN the plan is built
- THEN the action is `create`

#### Scenario: Skip identical

- GIVEN `reviewer.md` exists byte-identical to the catalog and is not owned
- WHEN the plan is built
- THEN the action is `skip` with no write and no journal entry, and a later `undo` never deletes that file

#### Scenario: Owned update

- GIVEN `reviewer` is owned, unmodified on disk, and the catalog bytes changed
- WHEN the plan is built
- THEN the action is `update` with reason "installed by shitaku"

#### Scenario: Unmanaged different file

- GIVEN `reviewer.md` exists, differs from the catalog, and is not owned
- WHEN the plan is built
- THEN the action is `conflict` with an agent-specific reason

#### Scenario: Owned but user-edited

- GIVEN `reviewer` is owned but the file on disk differs from both the manifest hash and the catalog
- WHEN the plan is built without `--force`
- THEN the action is `conflict`

#### Scenario: Force update

- GIVEN an unmanaged different `reviewer.md` and `--force`
- WHEN the plan is built
- THEN the action is `update`

### Requirement: Conflict, dry-run, backup, and stale-file protection

A non-interactive run with a conflict and no `--force` MUST write nothing and exit 2. An interactive run MUST ask, per conflicting agent, whether to skip or overwrite. `--dry-run` MUST print the plan only. Any overwrite MUST first back up the existing file under `~/.claude/.shitaku/backups/`. Apply MUST re-read the target file immediately before writing and MUST throw `StaleFileError` without writing if the file no longer matches the state the planned action was based on.

#### Scenario: Conflict refused

- GIVEN an unmanaged different `reviewer.md` and `--yes` without `--force`
- WHEN init runs
- THEN exit is 2 and no file, backup, or manifest changes

#### Scenario: Interactive conflict choice

- GIVEN an interactive run with a conflicting agent
- WHEN the user chooses skip, then repeats and chooses overwrite
- THEN skip leaves the file unchanged; overwrite backs it up and replaces it

#### Scenario: Forced replace with backup

- GIVEN the same conflict and `--force`
- WHEN init runs
- THEN a byte-identical backup of the old file exists, `reviewer.md` equals the catalog, and undo can restore the old bytes

#### Scenario: Dry run

- GIVEN `--dry-run`
- WHEN init runs
- THEN the plan is printed and the filesystem is unchanged

#### Scenario: Stale file at apply

- GIVEN a plan of `create` or `update` and the file changes between plan and apply
- WHEN apply runs
- THEN `StaleFileError` is thrown and the file is not written

### Requirement: Agent selection

`--agents <names>` MUST select agents by name. An unknown name MUST exit non-zero naming it and write nothing. The `--agents` flag MUST count as a kind flag for non-interactive selection. Interactive init MUST offer agents only when the catalog contains at least one. The conflict prompt and plan output MUST label items of this kind as `agent`.

#### Scenario: Unknown agent

- GIVEN `--agents ghost`
- WHEN init runs
- THEN it exits non-zero naming `ghost` and writes nothing

#### Scenario: Flag selection

- GIVEN a catalog with agent `reviewer` and `--agents reviewer --yes`
- WHEN init runs
- THEN only `reviewer` is installed among agents

#### Scenario: Prompt hidden when empty

- GIVEN a catalog with no agents
- WHEN interactive init runs
- THEN no agent selection prompt appears

### Requirement: Undo of agents

Undo MUST remove only agent files whose hash equals the manifest, restore overwrite backups, and refuse drift without `--force`. It MUST remove the agents directory only if this install created it and it is empty; it MUST NOT remove a pre-existing or non-empty directory. Undo MUST NOT treat the agent file as a directory tree.

#### Scenario: Clean undo prunes created directory

- GIVEN install created `./.claude/agents/` and only `reviewer.md`
- WHEN `undo` runs
- THEN `reviewer.md` and the empty directory are removed

#### Scenario: Shared directory kept

- GIVEN `./.claude/agents/` pre-existed, or now holds `mine.md`
- WHEN `undo` runs
- THEN only `reviewer.md` is removed and the directory stays

#### Scenario: Drift refused

- GIVEN the user edited `reviewer.md` after install
- WHEN `undo` runs without `--force`
- THEN the file is untouched and exit is non-zero

#### Scenario: Overwrite restored

- GIVEN an install that overwrote a user file with a backup
- WHEN `undo` runs
- THEN the original bytes are restored

### Requirement: Agent uninstall

`uninstall <name> --kind agent` MUST remove only the owned agent file when its hash equals the recorded hash, back up the bytes first, journal action `remove`, and exit 0. A modified agent MUST be refused without `--force`. An already deleted agent MUST be reported as "already absent" and exit 0. Other files in the agents directory MUST be untouched. Command-surface and name-collision behavior is specified in `item-uninstall`.

#### Scenario: Unmodified agent removed

- GIVEN agent `reviewer` is owned and its file hash equals the recorded hash
- WHEN `uninstall reviewer --kind agent` runs
- THEN the file is removed, a backup exists, and exit is 0

#### Scenario: Modified agent refused

- GIVEN the user edited `reviewer.md`
- WHEN `uninstall reviewer --kind agent` runs without `--force`
- THEN the file is untouched and exit is non-zero

#### Scenario: Undo restores agent

- GIVEN `reviewer` was uninstalled
- WHEN `undo` runs
- THEN the original bytes are restored and `reviewer` is owned again

### Requirement: Manifest backward compatibility and downgrade note

Manifests without any `agent` entry MUST load and replay unchanged, and the manifest version MUST NOT change. A manifest containing an `agent` item MUST be read only by a version that knows the kind; older versions reject `kind: 'agent'` with a manifest error. The README MUST document this downgrade note.

#### Scenario: Old manifest

- GIVEN a manifest with only mcp, skill, script, command, and hook entries
- WHEN status, undo, or init runs
- THEN it loads without error

#### Scenario: Agent item round trip

- GIVEN an install recorded an `agent` item with root equal to the file path
- WHEN the manifest is serialized and reloaded
- THEN the item is preserved, and `afterHash` may be null when the file was deleted

#### Scenario: Downgrade documented

- GIVEN the README
- WHEN inspected
- THEN it states that manifests containing agent items need a newer version

### Requirement: Block-scalar agents install verbatim

An agent whose `name` or `description` is written as a YAML block scalar MUST install with bytes identical to the catalog file, and MUST be offered in selection with a single-line description. Install, plan, manifest hashing, and undo behavior MUST be identical to any other agent.

#### Scenario: Block-scalar agent installs with identical bytes

- GIVEN a catalog agent `reviewer` with `description: >` followed by indented lines, and `--agents reviewer --yes`
- WHEN init runs
- THEN the installed file bytes equal the catalog file bytes, including the block-scalar syntax

#### Scenario: Single-line description in selection

- GIVEN the same agent and an interactive init
- WHEN the agent selection prompt is shown
- THEN the description offered for `reviewer` is one line with no newlines and no repeated whitespace

#### Scenario: Re-run is idempotent

- GIVEN the block-scalar agent is already installed unchanged
- WHEN init runs again
- THEN it is classified as skip identical, as for any other agent

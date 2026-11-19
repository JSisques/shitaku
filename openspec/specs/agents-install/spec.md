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

### Requirement: Declared skill resolution

When agents are selected for an init run, the system MUST resolve the skills they declare in their `skills` frontmatter key. The set of skills planned for the run MUST be the union of the explicitly selected skills and the catalog skills declared by the selected agents. Auto-added skills MUST be planned as regular skill entries in the run scope (`--scope`), which is the agent's own scope. Resolution MUST happen during planning, so `--dry-run`, `--yes`, interactive runs, conflict re-planning and hook-decline re-planning all see the same result. Resolution MUST NOT add a prompt, a flag or an exit code of its own.

Each skill declared by an agent MUST be handled in exactly one of these ways:

- present in the catalog: planned as a skill entry (auto-added, or merged with an explicit selection);
- absent from the catalog and `<skillsDir>/<name>/SKILL.md` exists in the run scope, or in user scope when the run scope is project: reported as an informational note `agent X requires skill Y, found on disk, not managed by shitaku`, nothing is planned for it;
- absent from the catalog and not found on disk: reported as a plan warning `agent X requires skill Y, which is not in the catalog`, nothing is planned for it.

A missing skill MUST NOT fail the run, MUST NOT change the exit code, and MUST NOT block the agent from being installed. The informational note MUST be distinguishable from a warning in the printed plan. Both MUST be printed for real runs and for `--dry-run`.

An auto-added skill entry MUST carry a reason that names every selected agent that requires it (for example `required by agent docs-writer`). A skill both explicitly selected and required by an agent MUST appear as one entry, MUST keep its explicit-selection reason, and MUST still record the requiring agents. A skill required by several agents MUST appear once.

A declared name that does not match the catalog skill name pattern `^[a-z0-9][a-z0-9-]*$` MUST be treated as not in the catalog and warned. It MUST NOT be interpreted as a path and MUST NOT be probed on disk.

Skipping a conflicting agent (conflict prompt) or declining its hooks MUST re-plan from the filtered request, so skills required only by the dropped agent are no longer auto-added, while skills also required by a remaining agent or explicitly selected stay. Uninstalling an agent (`uninstall --kind agent`) MUST leave its auto-added skills installed. `undo` of the install MUST revert the auto-added skills through the journal like any other skill entry. The manifest format and the `status` output MUST NOT change.

#### Scenario: Declared catalog skill is already present

- GIVEN agent `docs-writer` declares `docs-writing` and the skill is already installed byte-identical in the run scope
- WHEN `init --agents docs-writer --yes` runs
- THEN the plan holds `docs-writer` and `docs-writing` classified `skip` with the reason `already installed; required by agent docs-writer`
- AND no warning and no note is printed

#### Scenario: Declared catalog skill is auto-added

- GIVEN agent `docs-writer` declares `docs-writing`, which is in the catalog and not installed
- WHEN `init --agents docs-writer --yes` runs in project scope
- THEN `.claude/agents/docs-writer.md` and `.claude/skills/docs-writing/` are installed under `<cwd>`
- AND the plan lists `docs-writing` as `create` with the reason `required by agent docs-writer`

#### Scenario: Declared skill missing from the catalog and from disk

- GIVEN agent `a` declares `ghost`, which is not in the catalog and not on disk in any checked scope
- WHEN `init --agents a --yes` runs
- THEN the plan prints the warning `agent a requires skill ghost, which is not in the catalog`
- AND agent `a` is installed, no skill entry exists for `ghost`, and the exit code is 0

#### Scenario: Declared skill missing from the catalog but present on disk in run scope

- GIVEN agent `a` declares `local-skill`, which is not in the catalog, and `<run-scope skillsDir>/local-skill/SKILL.md` exists
- WHEN the plan is built
- THEN the plan prints the informational note `agent a requires skill local-skill, found on disk, not managed by shitaku`
- AND no warning is printed for it and no skill entry is planned

#### Scenario: Present in user scope while running in project scope

- GIVEN `--scope project`, agent `a` declares `local-skill` not in the catalog, and only `~/.claude/skills/local-skill/SKILL.md` exists
- WHEN the plan is built
- THEN the informational note is printed instead of a warning

#### Scenario: Present only in project scope while running in user scope

- GIVEN `--scope user`, agent `a` declares `local-skill` not in the catalog, and only `<cwd>/.claude/skills/local-skill/SKILL.md` exists
- WHEN the plan is built
- THEN the warning is printed, because project scope is not checked for a user-scope run

#### Scenario: Directory without SKILL.md is not a skill

- GIVEN a declared skill absent from the catalog and a directory `<skillsDir>/local-skill/` that has no `SKILL.md`
- WHEN the plan is built
- THEN the warning is printed, not the note

#### Scenario: Dry run

- GIVEN `--agents docs-writer --dry-run` where the declared skill is auto-added and another declared skill is missing
- WHEN init runs
- THEN the plan lists the auto-added skill with its reason and prints the warning
- AND no file, backup, journal or manifest changes

#### Scenario: Explicitly selected and also required

- GIVEN `--agents a --skills s` where agent `a` declares `s`
- WHEN the plan is built
- THEN `s` appears once with its explicit-selection reason, and `a` is recorded as a requiring agent

#### Scenario: Several agents require the same skill

- GIVEN agents `a` and `b` both declare `s`
- WHEN `init --agents a,b` plans
- THEN `s` appears once and its reason names both `a` and `b`

#### Scenario: Duplicate names inside one agent

- GIVEN agent `a` declares `s` twice
- WHEN the plan is built
- THEN `s` is planned once and produces at most one warning or note

#### Scenario: Malformed skill name

- GIVEN agent `a` declares `../evil`, `Foo` and `a/b`
- WHEN the plan is built
- THEN each produces the not-in-the-catalog warning, nothing is planned or probed on disk for them, and no path outside the skills directory is read

#### Scenario: Agent with no skills key

- GIVEN agent `a` has no `skills` key
- WHEN `init --agents a --yes` runs
- THEN the plan is identical to the plan before this change

#### Scenario: Auto-added skill conflicts

- GIVEN an auto-added skill `s` whose target differs and is not owned, and `--yes` without `--force`
- WHEN init runs
- THEN `s` is classified `conflict`, nothing is written, and the exit code is 2

#### Scenario: Skipping an agent drops its exclusive skills

- GIVEN agents `a` (declares `s1`, `s2`) and `b` (declares `s2`), and `a` conflicts and the user chooses skip
- WHEN the plan is recomputed
- THEN `s1` is no longer planned, `s2` stays with the reason naming only `b`, and `b` installs

#### Scenario: Explicit skill survives agent skip

- GIVEN `--agents a --skills s` where `a` declares `s` and `a` is skipped
- WHEN the plan is recomputed
- THEN `s` stays planned with its explicit-selection reason

#### Scenario: Undo reverts auto-added skills

- GIVEN an install that auto-added skill `s` for agent `a`
- WHEN `undo` runs
- THEN `s` and `a` are reverted through the journal and a pre-existing skills directory is kept

#### Scenario: Uninstalling an agent keeps its skills

- GIVEN agent `a` and its auto-added skill `s` are installed
- WHEN `uninstall a --kind agent` runs
- THEN `s` stays installed

#### Scenario: Agent with a malformed skills value never installs

- GIVEN a catalog agent whose `skills` value is rejected by the catalog loader
- WHEN `--agents <that agent>` is given
- THEN it is not selectable and the run fails as for any invalid agent, naming the key

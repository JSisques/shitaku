# Skills Install Specification

## Purpose

Install, update, replace, and undo catalog skills (a directory with `SKILL.md` and resources) for Claude Code with plan, backup, manifest, and undo guarantees.

## Requirements

### Requirement: Skill scope targets

A single `--scope` MUST apply to MCPs and skills. User scope MUST target `~/.claude/skills/<name>/`; project scope MUST target `<cwd>/.claude/skills/<name>/`. Every file in the skill directory MUST be installed, including binary resources, byte-identical.

#### Scenario: User scope

- GIVEN skill `demo` with `SKILL.md` and a binary `assets/logo.png`
- WHEN installed with `--scope user`
- THEN `~/.claude/skills/demo/` holds both files byte-identical to the catalog

#### Scenario: Project scope

- GIVEN `--scope project` and cwd `/w`
- WHEN `demo` is installed
- THEN files are written under `/w/.claude/skills/demo/`

### Requirement: Per-skill classification

The plan MUST classify each skill by comparing a tree hash (relative paths plus content bytes) of the catalog skill against the target directory and the manifest:

- create: target directory absent;
- skip: target tree hash equals the catalog hash;
- update: target present, owned by the manifest, and its hash equals the recorded hash;
- conflict: target present, not owned by the manifest, and different.

#### Scenario: Create

- GIVEN no `~/.claude/skills/demo/`
- WHEN planned
- THEN `demo` is `create`

#### Scenario: Skip identical

- GIVEN the target tree is identical to the catalog skill
- WHEN planned
- THEN `demo` is `skip` and nothing is written

#### Scenario: Update owned

- GIVEN `demo` is in the manifest, the target is unmodified, and the catalog changed
- WHEN planned
- THEN `demo` is `update`

#### Scenario: Owned but modified by the user

- GIVEN `demo` is in the manifest and the target hash differs from the recorded hash
- WHEN planned
- THEN `demo` is `conflict`

#### Scenario: Conflict

- GIVEN a different `~/.claude/skills/demo/` exists and is not in the manifest
- WHEN planned
- THEN `demo` is `conflict`

### Requirement: Conflict handling

Conflicts MUST appear in the printed plan. Non-interactive runs with any conflict and no `--force` MUST write nothing and exit 2. A skill MUST NOT be overwritten silently. Interactive runs MUST warn and ask for confirmation.

#### Scenario: Non-interactive conflict

- GIVEN a conflicting `demo` and `--yes` without `--force`
- WHEN `init` runs
- THEN the plan lists the conflict, nothing is written, and exit code is 2

#### Scenario: Interactive decline

- GIVEN a conflict and the user declines
- WHEN `init` runs
- THEN nothing is written for that skill

### Requirement: Force replace

With `--force`, a conflicting skill directory MUST be fully backed up and then replaced as a whole directory (files not in the catalog skill are removed). The backup MUST be restorable by `undo`.

#### Scenario: Force replace

- GIVEN a conflicting `demo` containing an extra file `notes.txt`
- WHEN `init --force` applies
- THEN the old directory is backed up, `demo` equals the catalog skill, and `notes.txt` is gone from the target

### Requirement: Skill selection

`--skills <a,b>` MUST select catalog skills by name. An unknown name MUST exit non-zero naming it and write nothing. Skills MUST honor `--dry-run`.

#### Scenario: Unknown skill

- GIVEN `--skills ghost`
- WHEN run
- THEN it exits non-zero naming `ghost` and writes nothing

#### Scenario: Dry run

- GIVEN `--skills demo --dry-run`
- WHEN run
- THEN the plan is printed and no file, backup, or manifest changes

### Requirement: Skill undo

`undo` MUST revert installed skills: remove files shitaku wrote, restore backed-up content for replaced directories, and remove only directories shitaku created. It MUST refuse (leave the skill untouched, exit non-zero) when the tree hash differs from the manifest, including user-added files, unless `--force`.

#### Scenario: Clean undo of created skill

- GIVEN `demo` was created by shitaku and is unchanged
- WHEN `undo` runs
- THEN `demo/` is removed and its manifest entries are cleared

#### Scenario: User-added file

- GIVEN the user added `demo/extra.md` after install
- WHEN `undo` runs without `--force`
- THEN it refuses, nothing is deleted, and exit is non-zero

#### Scenario: Pre-existing parent kept

- GIVEN `~/.claude/skills/` existed before install
- WHEN `undo` runs
- THEN `~/.claude/skills/` remains

#### Scenario: Created directory holding only foreign files

- GIVEN `.claude/skills/` was created by shitaku and now also holds a file or skill the user added outside `demo/`
- WHEN `undo` runs
- THEN `demo/` is removed, `.claude/skills/` is skipped and kept, and undo succeeds with exit 0 (with or without `--force`)

#### Scenario: Skill file replaced by a symlink

- GIVEN a recorded skill file was replaced by a symlink after install
- WHEN `undo` runs without `--force`
- THEN it refuses with exit 3, lists the path as changed, and touches nothing

#### Scenario: Undo of forced replace

- GIVEN `demo` replaced a non-owned directory via `--force`
- WHEN `undo` runs on unchanged content
- THEN the original directory contents are restored from backup

### Requirement: Skills required by agents

A skill plan entry MAY originate from an agent requirement (see `agents-install`, "Declared skill resolution"). Such an entry MUST carry a reason naming every requiring agent (for example `required by agent docs-writer`) and MUST be shown in the plan, including `--dry-run`. An explicitly selected skill that is also required MUST keep its explicit-selection reason. Entries from agent requirements MUST follow exactly the same rules as explicit ones: scope targets, per-skill classification (create, skip, update, conflict), conflict handling and `--force` replace, backup, journaling, stale-file protection, and `undo`. Requirement-derived and explicit entries MUST NOT be distinguishable in the manifest. A skill missing from the catalog MUST NOT be an error when it is only declared by an agent (see `agents-install`).

#### Scenario: Reason shown in the plan

- GIVEN a skill `s` planned only because agent `a` declares it
- WHEN the plan is printed
- THEN the entry for `s` shows the action and the reason `required by agent a`

#### Scenario: Same classification rules

- GIVEN an auto-added skill whose target is identical, owned and unmodified with a changed catalog, or different and unowned
- WHEN planned
- THEN it is classified `skip`, `update` and `conflict` respectively, as for an explicit skill

#### Scenario: Force replace of an auto-added skill

- GIVEN an auto-added skill whose target conflicts and `--force`
- WHEN init applies
- THEN the old directory is backed up, replaced as a whole, and restorable by `undo`

#### Scenario: Unknown explicit skill still fails

- GIVEN `--skills ghost` and `ghost` is not in the catalog
- WHEN init runs
- THEN it exits non-zero naming `ghost` and writes nothing, regardless of any agent declarations

#### Scenario: Manifest shape unchanged

- GIVEN an install that auto-added a skill
- WHEN the manifest is read
- THEN the skill item has the same fields as an explicitly selected one

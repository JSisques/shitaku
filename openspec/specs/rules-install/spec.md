# Rules Install Specification

## Purpose

Plan, apply, undo, and uninstall instruction-only rules (the `rule` kind): one flat `.md` file per rule, installed into the agent target's rules directory, which Claude Code loads natively. Safety model mirrors `agents-install`. Deterministic checks, severity, precedence layers, learned rules, an `add` command, profile support, `CLAUDE.md` edits, recursive rule subdirectories, and non-Claude targets are out of scope.

## Requirements

### Requirement: Rule install roots

A rule MUST install as the single file `<name>.md`, flat (no subdirectory). User scope MUST target `~/.claude/rules/<name>.md`; project scope MUST target `<cwd>/.claude/rules/<name>.md`. The written bytes MUST be identical to the catalog file. The system MUST NOT touch any other file in the rules directory and MUST NOT read or write `CLAUDE.md`.

#### Scenario: User and project roots

- GIVEN rule `no-secrets` and `--scope user` or `--scope project`
- WHEN init applies it
- THEN `~/.claude/rules/no-secrets.md` or `<cwd>/.claude/rules/no-secrets.md` exists with catalog-identical bytes

#### Scenario: Nested frontmatter kept verbatim

- GIVEN `rules/naming.md` has a `paths:` list in its frontmatter
- WHEN init applies it
- THEN the installed bytes equal the catalog bytes exactly

#### Scenario: Unrelated user rules untouched

- GIVEN `<cwd>/.claude/rules/mine.md` is user-authored
- WHEN init installs `no-secrets` in project scope
- THEN `mine.md` is unchanged

#### Scenario: CLAUDE.md untouched

- GIVEN a `CLAUDE.md` exists in the target
- WHEN init installs any rule
- THEN `CLAUDE.md` is unchanged

### Requirement: Plan classification

The plan MUST classify each rule by SHA-256 of bytes as `create` (file absent), `skip` (present and equal to the catalog; reason "already installed"), `update` (present and differing, and either `--force` is given or the manifest hash for that absolute path equals the present file; reason "installed by shitaku"), or `conflict` (anything else). Ownership MUST be keyed by absolute file path. A `skip` MUST NOT be journaled. Conflicts MUST appear in the plan. A user file MUST NEVER be silently overwritten. Conflict reasons MUST use the noun `rule`.

#### Scenario: Create

- GIVEN `no-secrets.md` is absent in the target
- WHEN the plan is built
- THEN the action is `create`

#### Scenario: Skip identical

- GIVEN `no-secrets.md` exists byte-identical to the catalog and is not owned
- WHEN the plan is built
- THEN the action is `skip` with no write and no journal entry, and a later `undo` never deletes that file

#### Scenario: Owned update

- GIVEN `no-secrets` is owned, unmodified on disk, and the catalog bytes changed
- WHEN the plan is built
- THEN the action is `update` with reason "installed by shitaku"

#### Scenario: Unmanaged different file

- GIVEN `no-secrets.md` exists, differs from the catalog, and is not owned
- WHEN the plan is built
- THEN the action is `conflict` with a rule-specific reason

#### Scenario: Owned but user-edited

- GIVEN `no-secrets` is owned but the file on disk differs from both the manifest hash and the catalog
- WHEN the plan is built without `--force`
- THEN the action is `conflict`

#### Scenario: Force update

- GIVEN an unmanaged different `no-secrets.md` and `--force`
- WHEN the plan is built
- THEN the action is `update`

### Requirement: Conflict, dry-run, backup, and stale-file protection

A non-interactive run with a conflict and no `--force` MUST write nothing and exit 2. An interactive run MUST ask, per conflicting rule, whether to skip or overwrite. `--dry-run` MUST print the plan only. Any overwrite MUST first back up the existing file under `~/.claude/.shitaku/backups/`. Apply MUST re-read the target file immediately before writing and MUST throw `StaleFileError` without writing if the file no longer matches the state the planned action was based on.

#### Scenario: Conflict refused

- GIVEN an unmanaged different `no-secrets.md` and `--yes` without `--force`
- WHEN init runs
- THEN exit is 2 and no file, backup, or manifest changes

#### Scenario: Interactive conflict choice

- GIVEN an interactive run with a conflicting rule
- WHEN the user chooses skip, then repeats and chooses overwrite
- THEN skip leaves the file unchanged; overwrite backs it up and replaces it

#### Scenario: Forced replace with backup

- GIVEN the same conflict and `--force`
- WHEN init runs
- THEN a byte-identical backup of the old file exists, `no-secrets.md` equals the catalog, and undo can restore the old bytes

#### Scenario: Dry run

- GIVEN `--dry-run`
- WHEN init runs
- THEN the plan is printed and the filesystem is unchanged

#### Scenario: Stale file at apply

- GIVEN a plan of `create` or `update` and the file changes between plan and apply
- WHEN apply runs
- THEN `StaleFileError` is thrown and the file is not written

### Requirement: Rule selection

`--rules <names>` MUST select rules by name. An unknown name MUST exit non-zero naming it and write nothing. The `--rules` flag MUST count as a kind flag for non-interactive selection. The conflict prompt and plan output MUST label items of this kind as `rule`.

#### Scenario: Unknown rule

- GIVEN `--rules ghost`
- WHEN init runs
- THEN it exits non-zero naming `ghost` and writes nothing

#### Scenario: Flag selection

- GIVEN the bundled catalog and `--rules no-secrets --scope project --yes`
- WHEN init runs
- THEN only `no-secrets` is installed among rules, byte-identical to the catalog

#### Scenario: Flag alone is non-interactive selection

- GIVEN `--rules no-secrets --yes` and no other kind flag
- WHEN init runs
- THEN no other kind is installed

### Requirement: Interactive selection and recommended set

Interactive init MUST offer rules only when the catalog contains at least one. The recommended starting set MUST be exactly `module-readme`, `conventional-commits`, `tests-for-changes`, `no-secrets`, and `ask-when-unsure`, and MUST be offered as the preselected choice; the user MUST be able to change the selection to any subset of the catalog's rules, including none. How the set is marked MUST NOT change `ProfileSchema` or profile resolution. With `--yes` and no `--rules`, the recommended set MUST NOT be installed implicitly.

#### Scenario: Recommended set preselected

- GIVEN interactive init with the bundled catalog
- WHEN the rule selection prompt appears
- THEN all ten rules are offered and exactly the five recommended rules are preselected

#### Scenario: User narrows selection

- GIVEN the prompt with the recommended set preselected
- WHEN the user deselects `ask-when-unsure` and confirms
- THEN four rules are planned and `ask-when-unsure` is not

#### Scenario: Prompt hidden when empty

- GIVEN a catalog with no rules
- WHEN interactive init runs
- THEN no rule selection prompt appears

#### Scenario: No implicit install under --yes

- GIVEN `init --yes` with no `--rules`
- WHEN init runs
- THEN no rule is installed

### Requirement: Undo of rules

Undo MUST remove only rule files whose hash equals the manifest, restore overwrite backups, and refuse drift without `--force`. It MUST remove the rules directory only if this install created it and it is empty; it MUST NOT remove a pre-existing or non-empty directory. Undo MUST NOT treat the rule file as a directory tree.

#### Scenario: Clean undo prunes created directory

- GIVEN install created `./.claude/rules/` and only `no-secrets.md`
- WHEN `undo` runs
- THEN `no-secrets.md` and the empty directory are removed

#### Scenario: Shared directory kept

- GIVEN `./.claude/rules/` pre-existed, or now holds `mine.md`
- WHEN `undo` runs
- THEN only `no-secrets.md` is removed and the directory stays

#### Scenario: Drift refused

- GIVEN the user edited `no-secrets.md` after install
- WHEN `undo` runs without `--force`
- THEN the file is untouched and exit is non-zero

#### Scenario: Overwrite restored

- GIVEN an install that overwrote a user file with a backup
- WHEN `undo` runs
- THEN the original bytes are restored

### Requirement: Rule uninstall

`uninstall <name> --kind rule` MUST remove only the owned rule file when its hash equals the recorded hash, back up the bytes first, journal action `remove`, and exit 0. A modified rule MUST be refused without `--force`. An already deleted rule MUST be reported as "already absent" and exit 0. Other files in the rules directory MUST be untouched. Command-surface and name-collision behavior is specified in `item-uninstall`.

#### Scenario: Unmodified rule removed

- GIVEN rule `no-secrets` is owned and its file hash equals the recorded hash
- WHEN `uninstall no-secrets --kind rule` runs
- THEN the file is removed, a backup exists, and exit is 0

#### Scenario: Modified rule refused

- GIVEN the user edited `no-secrets.md`
- WHEN `uninstall no-secrets --kind rule` runs without `--force`
- THEN the file is untouched and exit is non-zero

#### Scenario: Undo restores rule

- GIVEN `no-secrets` was uninstalled
- WHEN `undo` runs
- THEN the original bytes are restored and `no-secrets` is owned again

#### Scenario: Install, undo, uninstall round trip

- GIVEN a project install of `no-secrets`
- WHEN `uninstall no-secrets --kind rule` then `undo` run
- THEN the file is back with the original bytes and the manifest shows it owned

### Requirement: Manifest backward compatibility and downgrade note

Manifests without any `rule` entry MUST load and replay unchanged, and the manifest version MUST NOT change. A manifest containing a `rule` item MUST be read only by a version that knows the kind; older versions reject `kind: 'rule'` with a manifest error. The README MUST document this downgrade note.

#### Scenario: Old manifest

- GIVEN a manifest with only mcp, skill, script, command, hook, and agent entries
- WHEN status, undo, or init runs
- THEN it loads without error

#### Scenario: Rule item round trip

- GIVEN an install recorded a `rule` item with root equal to the file path
- WHEN the manifest is serialized and reloaded
- THEN the item is preserved, and `afterHash` may be null when the file was deleted

#### Scenario: Downgrade documented

- GIVEN the README
- WHEN inspected
- THEN it states that manifests containing rule items need a newer version

### Requirement: Seed rules and documentation

The bundled catalog MUST ship exactly ten seed rules, instruction text only, each valid under the catalog rule requirements: `naming`, `small-changes`, `explain-why`, `no-new-deps`, `error-handling`, `ask-when-unsure`, `module-readme`, `conventional-commits`, `tests-for-changes`, `no-secrets`. Seed rules MUST NOT declare checks or severity. CONTRIBUTING MUST include an "Adding to the catalog: rules" section, and the README, generated catalog docs, and website MUST list rules.

#### Scenario: Seed set loads

- GIVEN the bundled catalog
- WHEN loaded
- THEN ten rules with the listed names are available and valid, with no catalog issues

#### Scenario: Docs list rules

- GIVEN README, generated catalog docs, and the website
- WHEN inspected
- THEN each lists the rule kind and CONTRIBUTING has the rules section

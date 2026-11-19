# Delta for Agents Install

## ADDED Requirements

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

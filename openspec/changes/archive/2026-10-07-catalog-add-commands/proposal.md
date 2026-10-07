# Proposal: Catalog slash commands (`command` kind)

## Intent

Issue #47 asks for Claude Code slash commands in the catalog. Today shitaku installs only MCPs, skills, and scripts. This change covers the slash-commands half of #47. Hooks are split into a separate change.

## Scope

### In Scope

- New `command` kind: `catalog/commands/<name>.md`, listed in `catalog.json` `items.commands`
- Name rule `^[a-z0-9][a-z0-9-]*$`, equal to the filename stem
- Required frontmatter with a non-empty `description`. Other keys pass through unchanged. Values must be single-line.
- Flat install to `~/.claude/commands/<name>.md` (user scope) or `./.claude/commands/<name>.md` (project scope)
- Full lifecycle: plan, apply, conflict/`--force` with backup, manifest, undo, uninstall, status, doctor
- Additive profile field `commands: string[]`: schema, validation, and docs only
- CLI: `--commands`, prompter selection, `list commands`, `uninstall --kind command`
- Docs: README, CONTRIBUTING, website (en + es), and generators. All of them say "slash commands".

### Out of Scope

- Hooks. Create a follow-up issue linked to #47.
- Subdirectory namespacing (`commands/<ns>/<cmd>.md`)
- A generic item-kind refactor, and #42 agents
- Installing a profile by name
- Assumption to confirm in review: v1 ships **no bundled example command**. Table markers stay empty and tests use fixtures.

## Capabilities

### New Capabilities

- `commands-install`: command install root, plan/conflict/force, selection, undo, and the empty-dir prune

### Modified Capabilities

- `catalog`: command layout, validation, and the profile `commands` field
- `catalog-list`: `commands` kind filter
- `install-safety`: manifest kind `command`, and undo/remove for single files
- `install-status`: observing command files
- `item-uninstall`: `--kind command`
- `website`: command catalog pages (en + es)

## Approach

Approach 2 from the exploration: a dedicated single-file kind. `command-plan.ts` is a generic "flat file" classifier that compares sha256 hashes of the present, desired, and owned bytes. #42 agents can reuse it. Single files are read and written with `readBytes`/`writeBytes`, not the tree walkers. The frontmatter reader moves out of `skill.ts` into a shared `frontmatter.ts`.

## Affected Areas

| Layer       | Paths                                                                                                                      | Impact           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| domain      | `catalog/{command,frontmatter,schema,profile,listing}.ts`, `plan/{command-plan,change-plan,doctor-plan}.ts`, `manifest.ts` | New and modified |
| ports       | `agent-target.ts` (`commandsDir`), `prompter.ts`, `catalog-source.ts`                                                      | Modified         |
| application | `init-mcps`, `undo-install`, `uninstall-item`, `installed-state`                                                           | Modified         |
| adapters    | `catalog/folder-source.ts`, `claude-code/target.ts`, `cli/{program,clack-prompter}.ts`                                     | Modified         |
| docs/data   | `catalog/catalog.json`, `scripts/generate-*.mjs`, README, CONTRIBUTING, website                                            | Modified         |

## Risks

| Risk                                                                                                                                                 | Likelihood | Mitigation                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| Older shitaku versions throw `ManifestError` when they read a manifest with the new `kind: 'command'`                                                | High       | Document it in the changelog, as was done for scripts                             |
| Tree assumptions leak into undo (`listFiles`), installed-state, or uninstall (`readPresent`) and cause `UnsafeTreeError` or false "modified" results | Med        | Exclude command roots from tree code paths and add an explicit test for each path |
| Undo removes a shared `./.claude/commands` directory                                                                                                 | Med        | Prune only directories this install created, and only when they are empty         |
| jscpd flags `command-plan` against `script-plan`, or a duplicated frontmatter reader                                                                 | Med        | Share the frontmatter module and keep the classifier minimal                      |
| A parallel #42 branch diverges                                                                                                                       | Low        | Keep the flat-file plan generic                                                   |

## Rollback Plan

Revert the PRs of the chain in reverse order. Each PR is self-contained. Users roll back their installs with `shitaku undo` or `uninstall --kind command`. To downgrade shitaku, first remove the `command` entries from the manifest.

## Dependencies

- None. #42 is a soft coordination point.

## Success Criteria (issue #47, commands)

- [ ] The catalog supports `commands/` entries and validates them
- [ ] `init` installs selected commands into the agent commands directory, with conflict and backup safety
- [ ] Profiles can reference commands (schema and validation)
- [ ] Slash commands are documented in README, CONTRIBUTING, and the website
- [ ] Undo, uninstall, status, and doctor handle commands; `pnpm test`, lint, typecheck, and `format:check` pass

## Review Workload Forecast

- Estimated size: about 1,100–1,400 changed lines
- PR slices: (1) schema, load, list, profile field; (2) install lifecycle, which may be split into apply/undo and uninstall/status/doctor; (3) CLI and docs. Each PR body says "Part of #47".

Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High

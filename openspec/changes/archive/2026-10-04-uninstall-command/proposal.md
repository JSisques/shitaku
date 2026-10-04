# Proposal: Uninstall Command

## Intent

Users can only remove shitaku-installed items via `undo`, which reverts a whole install. Issue #55 asks for `shitaku uninstall <name> [--scope] [--dry-run] [--force]` to remove one MCP or skill safely: backed up, journaled, and undoable.

## Scope

### In Scope

- `uninstall <name>` with `--scope`, `--kind mcp|skill`, `--dry-run`, `--force`
- Uninstall recorded as a normal manifest Install with item action `remove`
- Ownership replay treats `remove` as ownership deletion
- Exit codes: 0 removed or already absent; 1 not installed or ambiguous (candidates listed); 3 modified since install (unless `--force`)
- README: command docs, downgrade note, MCP-undo whole-config restore refusal

### Out of Scope

- Bulk removal, profile uninstall
- Confirmation prompt
- Removing unowned items (`--force` never overrides ownership)

## Capabilities

### New Capabilities

- `item-uninstall`: resolve, check, remove, and journal a single owned MCP or skill

### Modified Capabilities

- `install-safety`: manifest item action gains `remove`; undo reverts the newest install even when it is an uninstall
- `install-status`: items removed by uninstall are no longer reported as owned

## Approach

Approach A (confirmed). New use case `uninstall-item` resolves the item through owned-item replay, inferring scope when owned in one scope. MCP: `removeAtPath` in json-merge, modification check `hashEntry === owned entryHash`. Skill: `treeHash === owned root`; forced removal deletes only recorded files and removes the directory only if empty. The write is journaled as an Install (backup = pre-removal bytes), so existing `undo` needs no changes. Manifest version stays 1. Private rollback/backup helpers in `init-mcps.ts` are extracted to a shared module.

## Affected Areas (hexagonal layers)

| Layer       | Path                                                  | Impact                                        |
| ----------- | ----------------------------------------------------- | --------------------------------------------- |
| domain      | `src/domain/manifest.ts`                              | Modified: `remove` action, 3 derive functions |
| domain      | `src/domain/json-merge.ts`                            | Modified: `removeAtPath`                      |
| application | `src/application/uninstall-item.ts`                   | New                                           |
| application | `src/application/init-mcps.ts` + shared helper module | Modified: extract helpers                     |
| adapters    | `src/adapters/cli/program.ts`                         | Modified: command, flags, exit codes          |
| docs        | `README.md`                                           | Modified                                      |
| tests       | `test/**` mirrored                                    | New/Modified                                  |

## Review Workload Forecast

Estimated ~600-750 changed lines; exceeds the 400 budget. Suggested chain:

1. PR 1: manifest `remove` action, derive functions, `removeAtPath`, helper extraction, with tests (~250-300)
2. PR 2: `uninstall-item` use case, CLI wiring, README, with tests (~350-450)

## Risks

| Risk                                                           | Likelihood | Mitigation                                      |
| -------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| Older shitaku rejects manifests containing `remove`            | Med        | README downgrade note                           |
| MCP undo refused after later config edits (whole-file restore) | Med        | Documented; drift check already refuses safely  |
| Forced skill removal deletes user files                        | Low        | Delete only recorded files; keep non-empty dirs |
| PR 2 exceeds budget                                            | Med        | Split CLI/README into a third PR if needed      |

## Rollback Plan

Revert the PRs. Manifests already containing `remove` items need the user to `undo` those installs before downgrading, as documented in README.

## Dependencies

- None external

## Success Criteria

- [ ] Uninstalling an owned, unmodified MCP or skill removes it, writes a backup, and is reverted by `undo`
- [ ] Modified items exit 3 without writes unless `--force`; unowned items exit 1
- [ ] Ambiguous names exit 1 listing candidates; `--kind` resolves them
- [ ] `--dry-run` writes nothing
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run format:check` pass

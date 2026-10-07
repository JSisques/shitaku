# Proposal: Add Claude Code hooks to the catalog (#211)

## Intent

Hooks (`hooks` in Claude Code `settings.json`) are the last common agent-setup piece shitaku cannot install. Users configure them by hand, without ownership, undo or status. Hooks run shell commands with full user permissions, so install must be explicit and auditable.

## Scope

### In Scope

- Catalog kind `hook`: one file per hook in `catalog/hooks/`, one `type: command` handler (`event`, optional `matcher`, `command`, optional `timeout`); may call a catalog script.
- Install into `~/.claude/settings.json` (user) or `.claude/settings.json` (project), array-aware merge into matcher groups.
- Mandatory confirmation showing the exact command, also under `--yes`; skipped only by a dedicated flag (e.g. `--allow-hooks`). `--source` hooks allowed under the same gate.
- Profiles gain a `hooks` array; `list`, `init --hooks`, `undo`, `uninstall`, `status`, `doctor` support hooks.
- Docs: README/website generators, security page (en/es), CONTRIBUTING.

### Out of Scope

- Handler types `http`, `mcp_tool`, `prompt`, `agent`; multi-handler bundles.
- `settings.local.json`, managed settings, plugin `hooks/hooks.json`.
- Marker keys inside user files; byte-preserving (CST) JSON editing.
- Bundled example hooks (structure only).

## Capabilities

### New Capabilities

- `hooks-install`: hook catalog format, settings.json merge/remove, confirmation gate, ownership identity, undo/uninstall.

### Modified Capabilities

- `catalog`: index and profiles gain `hooks`.
- `catalog-list`: lists hooks.
- `install-status`: hook states in `status`/`doctor`.
- `item-uninstall`: removes a single owned hook.
- `website`: hooks pages, profile section, security warning.

## Approach

Follow the commands-kind template (#202-#210). New domain `hook-merge.ts` (json-merge stays object-only) appends handlers without reordering and removes only what shitaku added. Ownership = manifest-recorded `{event, matcher, handlerHash}` located by canonical-JSON match; no marker key (research gap: unknown-key tolerance undocumented). Writes reuse refresh + `StaleFileError` + backup + `writeAtomic`. Edited-hook reporting (modified vs missing) decided in design.

## Affected Areas (hexagonal layers)

| Layer       | Area                                                                                                                                    | Impact       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| domain      | `catalog/hook.ts`, `schema.ts`, `profile.ts`, `manifest.ts`, `hook-merge.ts`, `plan/`, `listing.ts`, `doctor-plan.ts`, `status-plan.ts` | New/Modified |
| ports       | `agent-target.ts` (settingsPath), `prompter.ts`                                                                                         | Modified     |
| application | `init-mcps.ts`, `undo-install.ts`, `uninstall-item.ts`, `installed-state.ts`                                                            | Modified     |
| adapters    | `claude-code/target.ts`, `catalog/folder-source.ts`, `cli/program.ts`, `clack-prompter.ts`                                              | Modified     |
| docs        | `scripts/generate-*.mjs`, website, CONTRIBUTING                                                                                         | Modified     |

## Risks

| Risk                                                  | Likelihood | Mitigation                                                                  |
| ----------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Malicious/unsafe command from `--source`              | Med        | Always show exact command; dedicated flag                                   |
| Claude Code edits settings.json concurrently          | Med        | Re-read + hash, atomic write; targeted uninstall instead of whole-file undo |
| `kind === 'mcp'` branches mis-handle shared text file | Med        | Audit every branch; backward-compatible manifest                            |
| Whitespace normalized on write                        | Low        | Documented; undo restores backup bytes                                      |

## Rollback Plan

Each PR reverts independently. Manifest additions are additive, so reverting leaves old manifests valid; users run `shitaku undo`/`uninstall` before downgrading.

## Indicative PR Chain (stacked-to-main, 400 lines each)

1. Catalog schema, loader, profiles, listing.
2. Domain `hook-merge` + manifest kind + plan.
3. Init/apply/undo wiring, target `settingsPath`, confirmation gate.
4. Uninstall, status, doctor.
5. CLI flags/prompter.
6. Docs generators, security page.

## Success Criteria (issue #211)

- [ ] Catalog hooks load from `catalog/hooks/` and appear in `list`.
- [ ] Profiles reference hooks via `hooks`.
- [ ] `init` installs to user/project settings.json, preserving existing hooks; idempotent re-run.
- [ ] Exact command confirmed even with `--yes` unless the dedicated flag is set.
- [ ] `undo` and `uninstall` remove only shitaku-owned handlers.
- [ ] `status`/`doctor` report hook state.
- [ ] `pnpm test`, typecheck, lint, format, build pass; docs drift checks pass.

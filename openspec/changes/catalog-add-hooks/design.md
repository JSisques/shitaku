# Design: Claude Code hooks in the catalog (#211)

## Technical Approach

Add a `hook` kind on the commands-kind template. One new pure module, `src/domain/hook-merge.ts`, owns every edit of the `hooks` tree; `src/domain/plan/hook-plan.ts` classifies; the application layer reuses refresh, `StaleFileError`, backup, `writeAtomic` and rollback. `settings.json` is a text file (like the MCP config); ownership lives only in the manifest.

## Architecture Decisions

| #   | Topic       | Choice                                                                                                                                                                                                                                                                                                                                                                                                                            | Rejected                                   | Rationale                                                                                                                                                                                                                             |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | Ownership   | Manifest item `kind: 'hook'` under the settings file: `name, action, entryHash, event, matcher (string \| null), handler, previous?, createdEvent, createdGroup`. `entryHash = hashEntry({event, matcher, handler})`. Located by canonical-JSON equality inside groups whose `matcher` is strictly equal (`null` = key absent)                                                                                                    | Marker key; marker in command; group index | No foreign keys in user files (research gap Q2). Stored `handler`/`previous` make every action reversible. Composite hash turns event/matcher changes into `out-of-date`. Additive union member: version stays 1, old manifests parse |
| b   | Merge       | Append to the first group with equal matcher; no-op if a deep-equal handler exists; create event array/group only when absent and report `createdEvent`/`createdGroup`; remove splices one handler and drops group/event only if flagged created and now empty; update replaces in place; never sorts; unknown keys untouched; `JSON.stringify` with `detectIndent` and the original trailing newline (new file: 2 spaces + `\n`) | Extending `json-merge.ts`; `jsonc-parser`  | Keeps object-only merge stable; no new dependency; undo restores exact bytes anyway                                                                                                                                                   |
| c   | Edited hook | `missing` in status, `hook-missing` problem in doctor                                                                                                                                                                                                                                                                                                                                                                             | `modified` via fuzzy match                 | Content identity cannot tell edited from removed; guessing a nearby handler would let uninstall delete user content. Unparseable file stays `modified` / `config-unreadable`                                                          |
| d   | Gate        | Flag `--allow-hooks`. Interactive: `confirmHooks` lists event, matcher, command of each writing hook; decline drops hooks and replans. Non-interactive without the flag: previews to stderr, error, exit 1, nothing written. `--dry-run` prints previews, no prompt. `--source` identical                                                                                                                                         | `--yes` alone; new exit code               | Spec forbids `--yes`; exit 1 avoids widening the exit-code contract                                                                                                                                                                   |
| e   | Undo        | Hook files are text. No drift: byte restore (or delete if created). Drift without `--force`: refused, exit 3. Drift with `--force`, file items all `hook`: targeted reverse in reverse item order (create→remove, update→replace with `previous`, remove→re-add), all texts computed before the first write                                                                                                                       | Whole-file restore under `--force`         | Would clobber Claude Code `/config` edits. MCP files keep whole-file restore                                                                                                                                                          |
| f   | Malformed   | Strict `JSON.parse` (comments, trailing commas, BOM fail). `ConfigError("<path>: <reason>")` at plan time when the root, `hooks`, the target event array, a group in it, or a matching group's `hooks` has the wrong type. Other events are not validated                                                                                                                                                                         | Repair or skip                             | Fail closed before any write; `guarded` maps to exit 1                                                                                                                                                                                |
| g   | Port        | `AgentTarget.settingsPath(scope, paths)` and `toHookHandler(hook)` → `{type: 'command', command, timeout?}`                                                                                                                                                                                                                                                                                                                       | Reusing `configPath`                       | Different files per scope (`~/.claude/settings.json`, `<cwd>/.claude/settings.json`)                                                                                                                                                  |
| i   | Concurrency | Apply re-reads, replans hooks on change, `StaleFileError` if actions differ, backs up, `writeAtomic` (temp + rename: the live watcher never sees a partial file). CLI note: avoid `/config` while installing                                                                                                                                                                                                                      | Locking                                    | Claude Code locking is undocumented; residual window is documented                                                                                                                                                                    |

Hooks never conflict: `skip` when a deep-equal handler sits at the location (an unowned one is not recorded), `update` when the owned handler is found and the catalog changed, `create` otherwise (including owned-but-not-found). Nothing foreign is ever replaced, so `--force` has no effect on hooks. Uninstall reports `modified: false` always.

## `kind === 'mcp'` Audit (h)

| Location                                                              | Change                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `manifest.ts` `deriveOwnership`, refine                               | None (mcp-only; hook `afterHash` never null)                                                            |
| `manifest.ts` `OwnedItem`, `deriveOwnedItems`                         | Kind `hook`; path = `file.path`; optional `hook` detail                                                 |
| `init-mcps.ts` manifest items                                         | Hook branch writes hook items                                                                           |
| `undo-install.ts` `treeRoots`/`itemRoots`/`isByteFile`/`prunableDirs` | Exclude hooks from roots; text for hooks; hook file paths count for pruning (`.claude/` may be created) |
| `uninstall-item.ts` `expectedPath`, plan, `assertFresh`, apply        | Hook branches (text equality freshness)                                                                 |
| `installed-state.ts` observe, `desiredFor`                            | `observeHook` (no `entry`, so no env-unset false positives on `${CLAUDE_PROJECT_DIR}`)                  |
| `doctor-plan.ts` missing, duplicates                                  | `hook-missing`; duplicates stay mcp-only                                                                |
| `listing.ts`, `prompter.ts`, `program.ts` conflicts/`--kind`/notes    | Add `hook`; conflicts unchanged                                                                         |

## Data Flow

    hooks/x.json → FolderCatalogSource → HookItem → planInit
      → hook-plan (settings text + owned) → hook-merge → HookFileChange
      → CLI gate → applyPlan (refresh → backup → writeAtomic → manifest)

## Interfaces / Contracts

```ts
export interface HookLocation {
  event: string;
  matcher: string | null;
}
export interface HookFileChange {
  path: string;
  scope: Scope;
  before: string | null;
  beforeHash: string | null;
  after: string;
  items: { name: string; action: Action; location: HookLocation; handler: HookHandler; reason?: string }[];
}
// ChangePlan gains `hooks: HookFileChange[]` (zero or one entry).
```

## File Changes

| File                                                                                                                                                                                 | Action |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `src/domain/catalog/hook.ts`, `src/domain/hook-merge.ts`, `src/domain/plan/hook-plan.ts`, `catalog/hooks/`                                                                           | Create |
| `schema.ts`, `profile.ts`, `listing.ts`, `manifest.ts`, `change-plan.ts`, `doctor-plan.ts`                                                                                           | Modify |
| `agent-target.ts`, `prompter.ts`, `claude-code/target.ts`, `folder-source.ts`, `clack-prompter.ts`, `program.ts`                                                                     | Modify |
| `init-mcps.ts`, `undo-install.ts`, `uninstall-item.ts`, `installed-state.ts`                                                                                                         | Modify |
| `scripts/generate-catalog-table.mjs`, `generate-website-catalog.mjs` (hook section, page with event/matcher/command and warning, profile list), README, security en/es, CONTRIBUTING | Modify |

## Testing Strategy (strict TDD, RED first)

| Layer       | What                                                                                                                                                            | Approach             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Domain      | hook-merge (every spec scenario, tab/4-space indent, no trailing newline, wrong shapes, shared vs created groups), hook-plan, hook schema, old-manifest fixture | Table-driven Vitest  |
| Application | apply (stale, rollback, createdDirs), undo (byte, forced targeted, refused), uninstall, status/doctor                                                           | In-memory fs helpers |
| Adapters    | folder-source guards; CLI gate (`--yes` exit 1 no write, `--allow-hooks`, dry-run, decline)                                                                     | Existing CLI harness |

## PR Slices (400 lines each)

1. Catalog schema, loader, profiles, listing. 2. `hook-merge`. 3. Manifest item and hook-plan. 4. Port, target, init/apply. 5. Undo. 6. Uninstall, status, doctor. 7. CLI `--hooks` + `--allow-hooks` + prompter (must land together: no hook is reachable before the gate). 8. Docs generators and pages.

## Threat Matrix

All rows N/A: no git, PR, routing or doc-path classification. shitaku never executes hook commands; the write-to-executed-config trust boundary is covered by decision d.

## Migration / Rollout

No migration. Downgrading after installing hooks requires `undo`/`uninstall` first (older versions reject the `hook` item).

## Open Questions

- [ ] An empty group can remain when a later install appended to a group an earlier, already-uninstalled install created (spec-compliant, inert).

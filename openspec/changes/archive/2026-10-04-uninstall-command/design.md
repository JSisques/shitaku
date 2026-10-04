# Design: Uninstall Command

## Technical Approach

Approach A. `uninstall` is a new use case that records the removal as an ordinary `Install` whose items carry `action: 'remove'`. Backups hold the pre-removal bytes, so the existing `undoInstall` (drift check, LIFO per file and skill root, restore) reverts it unchanged. Ownership replay treats `remove` as deletion, so `status`, `init` and later uninstalls see the item as unowned.

## Architecture Decisions

| Decision                       | Options                               | Choice and rationale                                                                                                                                                         |
| ------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journal format                 | new record type; `remove` item action | `remove` action, manifest `version: 1`. Undo needs no change. Older binaries reject it (README note).                                                                        |
| `source` of the record         | catalog `ref()`; new `kind: 'none'`   | Copy `source` from the owning install. No catalog load, no further schema change.                                                                                            |
| `entryHash` of a `remove` item | owned hash; observed hash             | Observed hash of what was removed (differs from owned only under `--force`).                                                                                                 |
| Target resolution              | trust manifest paths; recompute       | Recompute: `target.configPath(scope)` / `` `${target.skillsDir(scope)}/${name}` `` must equal the owned `path`, so project-scope entries from other directories never match. |
| Skill deletion set             | whole directory; recorded files       | Recorded files (owning install, `afterHash !== null`) that exist now. Unforced: equals the tree. Forced: user files survive. Then non-recursive `removeDir` deepest first.   |
| Skill delete order             | any                                   | `SKILL.md` first, so a half-removed skill never loads.                                                                                                                       |
| Emptied `mcpServers`           | prune; keep                           | Keep `{}`: minimal edit, matches `mergeAtPath` creating it.                                                                                                                  |
| Stale check                    | replan; hash compare                  | Re-read before writing; abort with `StaleFileError` if the config `sha256` or skill `treeHash` differs from the plan.                                                        |
| Shared helpers                 | duplicate; extract                    | Extract to `src/application/install-transaction.ts`; `init-mcps.ts` re-exports `StaleFileError`.                                                                             |

## Data Flow

`planUninstall` and `applyUninstall` are private steps of the exported `uninstallItem`.

    CLI uninstall <name> ─→ planUninstall
        loadManifest → deriveOwnedItems → filter(name, kind?, scope?, path matches target)
          0 → UninstallSelectionError (exit 1)   >1 → ambiguous, lists candidates (exit 1)
        observe: MCP readAtPath → hashEntry | skill readPresent → treeHash
          absent → 'already-absent' (exit 0, no write)
          hash ≠ owned && !force → 'refused' (exit 3, no write)
          dryRun → 'dry-run'
    ─→ applyUninstall: re-read (stale?) → write backups → mutate (undo stack)
        → removeDir → appendInstall ; on error rollback(undo, [])

## File Changes

| File                                     | Action        | PR   | Description                                                                                                         |
| ---------------------------------------- | ------------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| `src/domain/manifest.ts`                 | Modify        | 1    | Item `action` enum adds `remove`; `deriveOwnership`, `deriveSkillOwnership`, `deriveOwnedItems` delete on `remove`. |
| `src/domain/json-merge.ts`               | Modify        | 1    | `removeAtPath`.                                                                                                     |
| `src/application/install-transaction.ts` | Create        | 1    | `newInstallId`, `backupPath`, `restoreText`, `restoreBytes`, `rollback`, `StaleFileError`.                          |
| `src/application/init-mcps.ts`           | Modify        | 1    | Use extracted helpers; behavior unchanged.                                                                          |
| `src/application/uninstall-item.ts`      | Create        | 2    | Use case.                                                                                                           |
| `src/adapters/cli/program.ts`            | Modify        | 2    | Command, flags, output, `guarded` entry, exit-code comment.                                                         |
| `README.md`                              | Modify        | 2    | Command docs, downgrade note, MCP-undo whole-file refusal.                                                          |
| `test/**` mirrors                        | Create/Modify | 1, 2 | See Testing.                                                                                                        |

## Interfaces / Contracts

```ts
// domain/json-merge.ts — names absent at keyPath are ignored; indent and trailing newline kept.
export function removeAtPath(text: string, keyPath: string[], names: string[]): string;

// application/install-transaction.ts
export class StaleFileError extends Error {}
export function newInstallId(now: Date): string;
export function backupPath(id: string, n: number, path: string): string; // backups/{id}/{n}-{basename}
export function rollback(
  fs: FileSystem,
  undo: (() => Promise<void>)[],
  dirs: string[],
  cause: unknown,
): Promise<unknown>;

// application/uninstall-item.ts
export interface UninstallDeps {
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  now?: () => Date;
}
export interface UninstallRequest {
  name: string;
  kind?: 'mcp' | 'skill';
  scope?: Scope;
  force?: boolean;
  dryRun?: boolean;
}
export interface UninstallResult {
  status: 'removed' | 'already-absent' | 'dry-run' | 'refused';
  exitCode: 0 | 3;
  item: { kind: 'mcp' | 'skill'; scope: Scope; name: string; path: string };
  files: string[]; // files that are (or would be) changed or deleted
  modified: boolean; // current hash differs from owned
  installId?: string; // set when removed
}
export class UninstallSelectionError extends Error {
  candidates: OwnedItem[];
}
export async function uninstallItem(deps: UninstallDeps, req: UninstallRequest): Promise<UninstallResult>;
```

Records: MCP file `{backup, beforeHash: sha256(before), afterHash: sha256(after), items: [{kind:'mcp', action:'remove', entryHash}]}`; skill, one file per deleted path with `afterHash: null` and item `{kind:'skill', action:'remove', entryHash, root}`; `createdDirs: []`.

CLI: `uninstall <name>` with `--scope project|user`, `--kind mcp|skill`, `--dry-run`, `--force`. `--dry-run` on a modified item without `--force` returns `refused` (exit 3, refusal printed, nothing written), exactly like a real run; the refusal check precedes the dry-run check. `refused` prints `changed since install: <path>` then the `--force` hint on stderr. A user-scope MCP prints the close-Claude-Code note.

## Testing Strategy (strict TDD, RED first)

| Layer       | What                                                                                                                                                                                                                                                                                                                                                                           | Approach                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Domain      | `removeAtPath` (keeps siblings, order, indent, newline; missing path; non-object → `ConfigError`); replay of `remove` in the three derive functions, including remove-then-reinstall and undone uninstall                                                                                                                                                                      | Pure unit tests in `test/domain/`        |
| Application | extraction keeps `init-mcps.test.ts` green; uninstall: resolution (scope inference, ambiguity, `--kind`, other-cwd project entry), absent, refused, force, dry-run writes nothing, stale abort, rollback on injected failure, forced skill keeps user file and directory; `undoInstall` after uninstall restores bytes and ownership; LIFO blocks undo of the original install | Temp-dir `FileSystem` via `test/helpers` |
| Adapter     | flags, messages, exit codes 0/1/3                                                                                                                                                                                                                                                                                                                                              | `runCli` in `program.test.ts`            |

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Deletions stay confined to owned, recomputed paths.

## Migration / Rollout

No data migration. Chain: PR 1 (domain, extraction; no user-visible change) then PR 2 (use case, CLI, README).

## Open Questions

None blocking.

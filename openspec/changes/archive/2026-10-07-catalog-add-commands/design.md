# Design: Catalog slash commands (`command` kind)

## Technical Approach

Add a single-file kind. `catalog/commands/<name>.md` becomes a `CommandItem { name, description, bytes }` and installs as one file at `<home|cwd>/.claude/commands/<name>.md`. A generic flat-file plan (`flat-file-plan.ts`) classifies the file by `sha256(bytes)`. #42 agents can reuse it as-is. In the manifest, a command is a rooted item whose `root` is the file path. LIFO, ownership, and directory pruning then work unchanged. Every directory-tree call (`listFiles`, `readPresent`, `treeHash`) is kept away from command roots. Single files use `readBytes`/`writeBytes`.

## Architecture Decisions

| Decision                 | Choice                                                                                                                                                                | Rejected                                      | Rationale                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Plan module              | `domain/plan/flat-file-plan.ts` (generic `FlatFileChange`, noun-parameterized reason)                                                                                 | `command-plan.ts` with command-specific types | #42 agents are also single `.md` files; one module covers both                                                |
| Classifier duplication   | Extract `classifyOwned(present, desired, owned, force, noun)` to `domain/plan/classify.ts`; `classifySkill`/`classifyScript` become one-line delegates (exports kept) | A third copy                                  | `skill-plan.ts` and `script-plan.ts` already duplicate the classifier; a third copy would be flagged by jscpd |
| Command hash             | `entryHash = sha256(bytes)`, which equals the file `afterHash`                                                                                                        | `treeHash([{path,bytes}])`                    | One file needs no tree semantics, and status/desired reuse plain `sha256`                                     |
| Manifest item            | `TreeItemSchema.extend({ kind: 'command' })`, `root` = absolute file path                                                                                             | A new `path` field                            | `deriveOwnedItems`, `assertNewestPerFile`, and `prunableDirs` already key on `root`                           |
| `afterHash: null` refine | Allow `skill \| script \| command`                                                                                                                                    | Keep skill/script only                        | An uninstall journals a command removal with `afterHash: null`                                                |
| Undo root sets           | Split `itemRoots` (skill/script/command: LIFO + prune) from `treeRoots` (skill/script: `unrecordedFiles`)                                                             | One set                                       | `listFiles(<file>)` throws `UnsafeTreeError`, so undo would always refuse                                     |
| Doctor                   | New `command-missing` code (severity `problem`)                                                                                                                       | Rename `skill-missing` to `item-missing`      | A rename breaks the existing JSON output contract                                                             |
| Profile API              | 6th positional `commandNames: readonly string[] = []`                                                                                                                 | An options object                             | Same pattern as `scriptNames`; no churn in 14 test calls                                                      |
| `Catalog.commands`       | Required                                                                                                                                                              | Optional                                      | Type safety; costs about 26 one-line literal updates                                                          |
| Frontmatter              | `domain/catalog/frontmatter.ts`: `readFrontmatter(text, file)`; skill messages unchanged                                                                              | A copy in `command.ts`                        | Avoids duplication and keeps one parser                                                                       |

## Data Flow

    catalog/commands/x.md --readFileNoFollow+realpath--> parseCommand --> Catalog.commands
    planInit: fs.readBytes(commandsDir/x.md) + deriveCommandOwnership --> buildFlatFilePlan --> plan.commands
    applyPlan: refreshFlatFile (StaleFileError) --> ByteStep{path,scope,item,before,after}
       --> backup(before) --> writeBytes --> journal{kind:'command',root:path} ; rollback + createdDirs
    undo: restore bytes | remove --> prunableDirs (commands dir only if created and empty, removeDir non-recursive)
    uninstall/status/doctor: readBytes(path) --> sha256 --> classifyStatus / remove + afterHash:null

Undo pruning: `missingDirs` records `./.claude/commands` (and `./.claude`) only when the install created them. `prunableDirs` accepts them because `root.startsWith(dir + '/')`. `removeDir` is non-recursive, so a directory that still holds user commands survives. Uninstall's `emptiedDirs(root=file)` yields nothing, so the shared directory is never touched.

## File Changes

| File                                                                                    | Action                                                                                      | PR  |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --- |
| `src/domain/catalog/frontmatter.ts`                                                     | Create (extracted reader)                                                                   | 1   |
| `src/domain/catalog/skill.ts`                                                           | Modify: use `frontmatter.ts`                                                                | 1   |
| `src/domain/catalog/command.ts`                                                         | Create: `CommandNameSchema`, `parseCommand` (trimmed non-empty description, non-empty body) | 1   |
| `src/domain/catalog/{schema,profile,listing}.ts`                                        | Modify: `items.commands`, `ProfileSchema.commands`, `Catalog.commands`, `LIST_KINDS`        | 1   |
| `src/adapters/catalog/folder-source.ts`                                                 | Modify: `loadCommands` (containment, unlisted `*.md` issue)                                 | 1   |
| `catalog/catalog.json`                                                                  | Modify: `"commands": []`                                                                    | 1   |
| `src/domain/plan/{classify,flat-file-plan}.ts`                                          | Create                                                                                      | 2a  |
| `src/domain/plan/{skill-plan,script-plan,change-plan}.ts`                               | Modify: delegate classifier; `ChangePlan.commands`                                          | 2a  |
| `src/domain/manifest.ts`                                                                | Modify: kind, refine, `deriveCommandOwnership`, `OwnedItem.kind`                            | 2a  |
| `src/ports/agent-target.ts`, `src/adapters/claude-code/target.ts`                       | Modify: `commandsDir`                                                                       | 2a  |
| `src/application/init-mcps.ts`                                                          | Modify: `InitRequest.commands`, `UnknownCommandError`, refresh, generalized `ByteStep`      | 2b  |
| `src/application/undo-install.ts`                                                       | Modify: root-set split; command files are byte files                                        | 2b  |
| `src/application/{uninstall-item,installed-state}.ts`, `src/domain/plan/doctor-plan.ts` | Modify                                                                                      | 2c  |
| `src/ports/prompter.ts`, `src/adapters/cli/{program,clack-prompter}.ts`                 | Modify: flag, select, conflicts, `printPlan`, `--kind`, list                                | 3a  |
| `scripts/generate-*.mjs`, README, CONTRIBUTING, `website/**` (en+es)                    | Modify                                                                                      | 3b  |

## Interfaces / Contracts

```ts
export interface FlatFileChange {
  name: string;
  path: string;
  scope: Scope;
  action: Action;
  reason?: string;
  bytes: Uint8Array;
  present: Uint8Array | null;
  desiredHash: string;
  presentHash: string | null;
}
export function buildFlatFilePlan(input: {
  entries: { name: string; path: string; scope: Scope; bytes: Uint8Array; present: Uint8Array | null }[];
  owned: Record<string, string>;
  noun: string;
  force?: boolean;
}): FlatFileChange[];
```

## Testing Strategy (strict TDD, RED first)

| Layer       | Tests                                                                                                                                                                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain      | `command.test.ts` (name, missing/multi-line frontmatter, blank description, empty body, passthrough keys); `frontmatter.test.ts`; `flat-file-plan.test.ts` (create/skip/owned update/force/conflict reasons); `manifest.test.ts` (command kind, null `afterHash`, ownership); profile, listing, doctor-plan |
| Adapters    | `folder-source.test.ts` (fixture `test/fixtures/**/commands/`: valid, unlisted, symlink, bad frontmatter); `target.test.ts` `commandsDir`; `bundled-catalog.test.ts`; `program.test.ts`, `clack-prompter.test.ts`                                                                                           |
| Application | `init-mcps.test.ts` (apply, force backup, rollback via `faultyFs`, stale); `undo-install.test.ts` (no `UnsafeTreeError`, prune created empty dir, keep non-empty or pre-existing dir); `uninstall-item.test.ts`; `installed-state.test.ts` (directory at path means `unreadable`)                           |

Test helpers get `commandSource` and a `commands: []` default.

## PR Slicing (stacked-to-main, "Part of #47")

| PR  | Scope                                                                     | Estimate |
| --- | ------------------------------------------------------------------------- | -------- |
| 1   | Catalog: frontmatter, command, schema, profile, listing, loader, literals | ~370     |
| 2a  | Domain install model: classify, flat-file plan, manifest, `commandsDir`   | ~260     |
| 2b  | `init` apply + undo                                                       | ~350     |
| 2c  | Uninstall, status, doctor                                                 | ~220     |
| 3a  | CLI flag, prompter, list, uninstall `--kind`                              | ~200     |
| 3b  | Docs, generators, website en+es                                           | ~350     |

PR 2 is split because it would be about 830 lines. The user path (`--commands`) ships last, in 3a, so the intermediate merges cannot be reached from the CLI.

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, or process-integration boundary. Command bodies can contain `!` bash lines, but Claude Code runs them, not shitaku. The `--source` trust model is unchanged.

## Migration / Rollout

No data migration. New manifests are additive. Older shitaku versions throw `ManifestError` on `kind: 'command'`; this goes in the changelog, as it did for scripts.

## Open Questions

- [ ] No bundled example command in v1 (proposal assumption); to be confirmed in review.

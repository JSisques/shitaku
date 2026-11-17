# Design: Installable agents in the catalog (#42)

## Technical Approach

Add an `agent` kind as a parallel copy of the `command` kind: one `.md` file per item, bytes verbatim, flat copy to `<agentsDir>/<name>.md`, planned by `buildFlatFilePlan`, decided by `classifyOwned`, owned by absolute file path. A small dedupe lands first so the agent branches are additions, not copies. The frontmatter reader gains an opt-in nested mode used only by agents.

## Architecture Decisions

| #   | Topic              | Choice                                                                                                                                                                                                                                                                                                                                                                           | Rejected                                                | Rationale                                                                                                                                                                                                                                                 |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | Frontmatter reader | Hand-rolled opt-in `readFrontmatter(text, file, { allowNested: true })`. Top-level `key: value` scalars go to `data`. A top-level key with an empty or block (`\|`, `>`) value, plus the indented lines after it, is opaque: its name goes to `opaque`, its value is not parsed. An indented line with no owning key is an issue. Default mode is byte-for-byte today's behavior | `yaml` package                                          | No new runtime dependency (today: zod, commander, clack). Bytes are copied verbatim, so shitaku never needs the nested values. Skills/commands keep strict mode, zero regression. Cost: malformed nested YAML is not detected; documented in CONTRIBUTING |
| b   | Agent schema       | `parseAgent(stem, bytes)`: stem matches the existing name regex; frontmatter `name` and `description` are non-empty single-line scalars; `name === stem`; non-empty body. A required key found in `opaque` gives `key 'description' must be a single-line value`. No allowed-field list                                                                                          | Stem-only (commands style)                              | Claude Code identifies an agent by frontmatter `name`; equality keeps status/uninstall names truthful. Unknown fields are ignored by Claude Code, so a list would only reject valid agents                                                                |
| c   | Dedupe             | `refreshFlatFile(deps, change, owned, force, kind: FlatFileKind)`; `ByteStep.item.kind: TreeKind \| FlatFileKind`; `commandStep` becomes `flatFileStep(change, kind)`; `resolveProfile(name, profiles, known: KnownNames)` and `validateProfiles(profiles, known)`; `isFlatFileKind(kind)` in `manifest.ts`                                                                      | `kind` field on `FlatFileChange`; generic kind registry | Smallest change that removes the hardcoded `'command'` noun. A field on `FlatFileChange` touches every plan fixture; a registry exceeds the review budget (out of scope)                                                                                  |
| d   | Manifest           | `TreeItemSchema.extend({ kind: z.literal('agent') })`, `root` = file path. The null-`afterHash` refine uses `isTreeKind(k) \|\| isFlatFileKind(k)`. `deriveAgentOwnership` = `deriveTreeOwnership(manifest, 'agent')`. `OwnedItem.kind` gains `'agent'`. Manifest `version` stays 1                                                                                              | New version 2                                           | Additive union member: old manifests parse. Older binaries reject the whole manifest: README downgrade note (undo/uninstall agents first)                                                                                                                 |
| e   | Port               | `AgentTarget.agentsDir(scope, paths)`; Claude: `join(scope === 'user' ? homeDir : cwd, '.claude', 'agents')`                                                                                                                                                                                                                                                                     | Reusing `commandsDir` with a suffix                     | Mirrors `commandsDir`; Claude scans recursively, but shitaku installs flat (subdirectories out of scope)                                                                                                                                                  |
| f   | Generic paths      | `undo-install.ts` needs no change: `isByteFile`/`itemRoots` already treat every non-mcp, non-hook kind as a byte file with a root; `.claude/agents/` is pruned via `createdDirs`. Verified by test only                                                                                                                                                                          | Explicit agent branches                                 | Fewer edits; a round-trip test guards it                                                                                                                                                                                                                  |

`isFlatFileKind` replaces `kind === 'command'` in `uninstall-item.ts` (`assertFresh`, plan branch), `installed-state.ts` (`observeFile` dispatch) and the manifest refine. `expectedPath`, `desiredFor` and `doctor-plan.ts` (`agent-missing`) get explicit agent branches because they differ per kind.

## Data Flow

    agents/x.md → FolderCatalogSource.loadFileItems → parseAgent → Catalog.agents
      → planInit (agentsDir + readBytes) → buildFlatFilePlan(noun 'agent') → ChangePlan.agents
      → CLI conflicts/prompt → applyPlan: refreshFlatFile('agent') → flatFileStep → backup → writeBytes → manifest

## Interfaces / Contracts

```ts
export type FlatFileKind = 'command' | 'agent';
export const isFlatFileKind = (k: string): k is FlatFileKind => k === 'command' || k === 'agent';
export interface KnownNames {
  mcps: readonly string[];
  skills: readonly string[];
  scripts?: readonly string[];
  commands?: readonly string[];
  hooks?: readonly string[];
  agents?: readonly string[];
}
export type FrontmatterResult = { data: Record<string, string>; opaque: string[]; body: string } | FrontmatterIssue;
// ResolvedProfile, Catalog and ChangePlan gain `agents`.
```

## File Changes and PR Chain (stacked to main, each <= 400 lines incl. tests)

| PR  | Files                                                                                                                                                                                        | Est.         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `init-mcps.ts` (refresh/step params), `profile.ts` (object arg), `folder-source.ts` call site, `manifest.ts` (`isFlatFileKind`), tests                                                       | ~150         |
| 2   | `frontmatter.ts` nested mode + tests                                                                                                                                                         | ~200         |
| 3   | Create `catalog/agent.ts`, `catalog/agents/.gitkeep`; modify `schema.ts`, `profile.ts`, `listing.ts`, `folder-source.ts`, `catalog.json`, `test/helpers/agents.ts`, `agents: []` in fixtures | ~380 (tight) |
| 4   | `manifest.ts` kind/ownership, `change-plan.ts`, `doctor-plan.ts` code, `agent-target.ts`, `claude-code/target.ts`                                                                            | ~350         |
| 5   | `init-mcps.ts` plan + apply; undo round-trip tests                                                                                                                                           | ~350         |
| 6   | `uninstall-item.ts`, `installed-state.ts`, doctor finding                                                                                                                                    | ~300         |
| 7   | `scripts/generate-*.mjs`, README markers, CONTRIBUTING, website en/es, downgrade note                                                                                                        | ~350         |
| 8   | `program.ts` (`--agents`, `--kind agent`, trust copy), `prompter.ts`, `clack-prompter.ts`, flag docs                                                                                         | ~350         |

PR 3 fallback if over budget: 3a (`agent.ts`, schema, fixtures) and 3b (loader, listing, profile). Agents are unreachable to users until PR 8.

## Testing Strategy (strict TDD, RED first)

| PR  | RED tests                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Existing suites stay green (refactor); profile tests switch to object arg; `isFlatFileKind` table                                                             |
| 2   | Strict mode unchanged (existing tests); nested: `tools` list, `mcpServers` map, `\|` block, orphan indented line, CRLF, `opaque` names                        |
| 3   | `parseAgent`: missing/mismatched `name`, opaque `description`, empty body, bytes verbatim; schema default `[]`; profile unknown agent; listing; loader guards |
| 4   | Old-manifest fixture parses; agent null `afterHash` accepted; ownership; `agentsDir` both scopes                                                              |
| 5   | create/skip/update/conflict/force, `StaleFileError`, conflict reason says "agent", backup, rollback, undo deletes created file and prunes `.claude/agents/`   |
| 6   | uninstall removed/refused/already-absent, skill+agent same name ambiguity; status states; `agent-missing`                                                     |
| 7   | `generators.test.ts`, `docs:catalog:check`                                                                                                                    |
| 8   | CLI harness: `--agents`, unknown agent, interactive selection, conflict prompt, `--kind agent`, trust copy                                                    |

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification or process integration. Agents may grant tools through frontmatter; covered by the `--source` trust copy (PR 8).

## Migration / Rollout

No migration. Downgrade after installing agents requires `undo`/`uninstall` first.

## Open Questions

- [x] Block-scalar `name`/`description` (`description: |`) is rejected in v1; accepted. Follow-up: https://github.com/JSisques/shitaku/issues/238

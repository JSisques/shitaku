# Proposal: Installable agents in the catalog (issue #42)

## Intent

Claude Code sub-agents (`.claude/agents/<name>.md`) cannot be shipped through shitaku. Add an `agent` catalog kind with the same safety model as `commands`.

## Scope

### In Scope

- Scoped dedupe: parametrize `refreshFlatFile` noun and `ByteStep` kind, `resolveProfile` object argument, `isFlatFileKind` helper.
- Frontmatter reader extension: agents accept multi-line/nested YAML (`tools` list, `skills`, `mcpServers`, `hooks`, `experimental`).
- `agent` kind: frontmatter `name` + `description` required, `name` equals file stem, non-empty body, bytes verbatim, no allowed-field list, name regex unchanged.
- Install, undo, uninstall, status, doctor, list; `--agents` flag, interactive selection, `--kind agent`.
- `--source` trust copy mentions agents; no consent gate.
- `"agents": []`, `catalog/agents/.gitkeep`; profile `agents` array (schema/validation only).
- Docs, generators, website (en, es), manifest downgrade note.

### Out of Scope

- Shipping a concrete agent.
- Installing profiles by name (not supported yet).
- Recursive agent subdirectories; non-Claude targets.
- Generic kind registry.

## Capabilities

### New Capabilities

- `agents-install`: install, conflict, undo, uninstall of catalog agents.

### Modified Capabilities

- `catalog`: `items.agents`, agent validation, profile `agents`, multi-line frontmatter for agents, trust copy.
- `catalog-list`: `agent` kind.
- `install-status`: agent status and `agent-missing` doctor finding.
- `item-uninstall`: agent uninstall, skill/agent name ambiguity.

## Approach

Parallel kind modeled on `commands` (exploration Approach 3). Ownership by absolute path via `classifyOwned`.

Reader: hand-rolled, opt-in mode (`allowNested`) in pure `src/domain/catalog/frontmatter.ts`. Top-level scalars extracted; indented/block values kept opaque (bytes stay verbatim). Skills/commands keep strict mode: no regression.

| Option                                | Pros                                     | Cons                                         |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| Hand-rolled opaque mode (recommended) | No dependency; skills/commands unchanged | Malformed nested YAML not detected           |
| `yaml` package                        | Full syntax validation                   | New runtime dependency, supply-chain surface |

## Affected Areas

| Layer       | Area                                                                                   | Impact       |
| ----------- | -------------------------------------------------------------------------------------- | ------------ |
| Domain      | `catalog/{agent,frontmatter,schema,profile,listing}.ts`, `manifest.ts`, `plan/*`       | New/Modified |
| Ports       | `agent-target.ts` (`agentsDir`), `prompter.ts`                                         | Modified     |
| Application | `init-mcps`, `uninstall-item`, `installed-state`, `undo-install`                       | Modified     |
| Adapters    | `claude-code/target.ts`, `catalog/folder-source.ts`, `cli/{program,clack-prompter}.ts` | Modified     |
| Data/docs   | `catalog/`, `scripts/generate-*.mjs`, README, CONTRIBUTING, website                    | Modified     |

## Risks

| Risk                                  | Likelihood | Mitigation                                        |
| ------------------------------------- | ---------- | ------------------------------------------------- |
| Missed `kind === 'command'` branch    | Med        | `isFlatFileKind`, grep checklist, round-trip test |
| Opaque mode accepts broken YAML       | Med        | Document the limit; design may switch to `yaml`   |
| Older versions reject `kind: 'agent'` | Low        | Downgrade note                                    |
| Agents grant tools via frontmatter    | Med        | Trust copy                                        |

## Rollback Plan

Each slice is a revertable PR. Revert the CLI PR to hide the feature; manifests with agent items need a newer version (downgrade note).

## Success Criteria

- [ ] Agent install/undo/uninstall/status round-trip passes.
- [ ] Nested-YAML agent loads; skills/commands strict tests unchanged.
- [ ] Typecheck, lint, format, architecture guard, `pnpm test` green.

## Review Workload Forecast

| PR  | Slice                                                     | Est. lines |
| --- | --------------------------------------------------------- | ---------- |
| 1   | Dedupe refactor                                           | ~150       |
| 2   | Frontmatter reader extension                              | ~200       |
| 3   | Catalog: agent, schema, profile, listing, loader          | ~380       |
| 4   | Manifest, ownership, plans, `agentsDir`                   | ~350       |
| 5   | Init apply + undo                                         | ~350       |
| 6   | Uninstall, status, doctor                                 | ~300       |
| 7   | Docs, generators (no flag docs)                           | ~350       |
| 8   | CLI `--agents`, prompter, `--kind`, trust copy, flag docs | ~350       |

Stacked to main; user-facing surface lands last.

Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High

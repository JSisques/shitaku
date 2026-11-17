# Exploration: catalog-add-agents (issue #42)

## Current State

- Kinds today: mcps, skills, scripts, commands, hooks, plus profiles. Each was added by copy-and-extend; there is no generic kind registry.
- The commands kind is the exact precedent for agents:
  - One `.md` file per item, validated by `parseCommand` (frontmatter `description`, non-empty body, bytes kept verbatim).
  - Flat copy to `<target>/commands/<name>.md`.
  - Plan built by `buildFlatFilePlan`, decided by `classifyOwned`.
  - Manifest item `kind: 'command'` with `root` = the file path; `afterHash` may be null when the file is deleted.
- Skills (directory trees, tree hash, pruning) and hooks (shared settings.json, merge, consent gate) are not needed for agents.

### Conflict and ownership model (reused as-is)

Ownership is keyed by absolute file path (`deriveCommandOwnership` is the analogue).

| Situation                                                       | Action                          |
| --------------------------------------------------------------- | ------------------------------- |
| File absent                                                     | create                          |
| Identical bytes                                                 | skip ("already installed")      |
| Differs and `--force`                                           | update                          |
| Differs and manifest hash for that path equals the present file | update ("installed by shitaku") |
| Anything else                                                   | conflict                        |

A user-owned `~/.claude/agents/x.md` is never silently overwritten. Non-interactive `init` exits 2; interactive asks skip or overwrite per item. Apply re-reads the file and throws `StaleFileError` if the action changed. Overwrites are backed up first. A user file byte-identical to the catalog version becomes `skip` and is not journaled, so `undo` never deletes it.

## Affected Areas

**Domain**

- `src/domain/catalog/agent.ts` (new): `AgentNameSchema`, `AgentItem {name, description, bytes}`, `parseAgent`.
- `src/domain/catalog/schema.ts`: `items.agents` (default `[]`), `ProfileSchema.agents`, `Catalog.agents`.
- `src/domain/catalog/profile.ts`: `resolveProfile` / `validateProfiles` take `agentNames` and return `agents`.
- `src/domain/catalog/listing.ts`: `LIST_KINDS`, `EntryKind`, `ENTRY_KIND`, `listEntries`.
- `src/domain/manifest.ts`: `ItemSchema` agent kind; the `FileSchema.refine` allowing null `afterHash`; ownership derivation; `OwnedItem.kind`.
- `src/domain/plan/change-plan.ts`: `ChangePlan.agents: FlatFileChange[]`.
- `src/domain/plan/doctor-plan.ts`: `DoctorCode` `'agent-missing'` and an `itemFindings` branch.

**Ports**

- `src/ports/agent-target.ts`: `agentsDir(scope, paths)`.
- `src/ports/prompter.ts`: `selectAgents`; `ConflictInfo.kind` adds `'agent'`.

**Application**

- `src/application/init-mcps.ts`: `InitRequest.agents`, `UnknownAgentError`, plan entries, agent step, apply loop. `refreshFlatFile` hardcodes `noun: 'command'` and must be parametrized. `ByteStep.item.kind` needs `'agent'`.
- `src/application/uninstall-item.ts`: `expectedPath`, plan branch, `assertFresh`, every `kind === 'command'` test.
- `src/application/installed-state.ts`: `observeFile` dispatch and a `desiredFor` branch.
- `src/application/undo-install.ts`: mostly generic; verify pruning of an install-created `.claude/agents/` directory.
- `list-catalog.ts`, `status.ts`, `doctor.ts`, `journal.ts`: believed generic; confirm during apply.

**Adapters**

- `src/adapters/claude-code/target.ts`: `agentsDir` = `join(scope==='user' ? homeDir : cwd, '.claude', 'agents')`.
- `src/adapters/catalog/folder-source.ts`: `loadAgents` via `loadFileItems('agents', '.md', ...)`, profile validation, returned catalog.
- `src/adapters/cli/program.ts`: `--agents <names>`, `InitOptions`, `hasKindFlag`, interactive `selectAgents`, conflicts, `printPlan`, abort check, `--kind` choices.
- `src/adapters/cli/clack-prompter.ts`: `selectAgents`, `CONFLICT_LABELS.agent`, `confirm` target count.

**Catalog, docs, tooling**

- `catalog/catalog.json` gets `"agents": []`; add `catalog/agents/.gitkeep`.
- `scripts/generate-catalog-table.mjs` and README `<!-- catalog:agents:start/end -->` markers.
- `scripts/generate-website-catalog.mjs`, website overview/commands/flags/security pages (en and es).
- `README.md` and `CONTRIBUTING.md` sections; manifest downgrade note.

**Tests (strict TDD)**

- New: `test/domain/catalog/agent.test.ts`, `test/helpers/agents.ts`.
- Extended: schema, profile, listing, manifest, flat-file-plan, change-plan, doctor-plan, folder-source, bundled-catalog, target, init-mcps, undo-install, uninstall-item, installed-state, status, doctor, list-catalog, program, clack-prompter, generators.
- 31 `hooks: []` literals across 17 files need `agents: []`.

## Approaches

1. **Parallel kind (copy commands).** Matches established style; near-duplicate code; `command` branches become `command || agent` in 6-8 places. Effort: medium (~1,700 lines).
2. **Generalize a "flat markdown kind" descriptor first.** Removes duplication, but refactors shipped code inside a feature change and exceeds the review budget. Effort: high.
3. **Approach 1 plus a small scoped dedupe (recommended).** Parametrize the `refreshFlatFile` noun and `ByteStep` kind; replace `resolveProfile` positional args with an object; add an `isFlatFileKind` helper. Effort: medium (+~100 lines).

### Frontmatter strictness fork

- (i) Commands style: require only `description`, name = file stem.
- (ii) Skills style: require `name` and `description`, `name === file stem`.

Claude Code identifies a subagent by its frontmatter `name`, so (ii) keeps `status`/`uninstall` names truthful. Caveat: `readFrontmatter` accepts single-line scalars only; multi-line lists and nested keys are rejected at load.

## Recommendation

Approach 3 with frontmatter option (ii): require `name` + `description`, `name` equal to file stem, non-empty body, bytes verbatim, no consent gate, ship `"agents": []`. Profiles get an `agents` array for schema/validation only (profiles cannot be installed by name yet; state this in the proposal).

Suggested stacked-to-main chain (each <= 400 lines):

| PR   | Scope                                                                   |
| ---- | ----------------------------------------------------------------------- |
| PR1  | Catalog: agent.ts, schema, profile object-arg refactor, listing, loader |
| PR2a | Domain: manifest kind, ownership, change-plan, doctor code, `agentsDir` |
| PR2b | `init` apply + undo                                                     |
| PR2c | Uninstall, status, doctor                                               |
| PR3a | CLI: `--agents`, prompter, `--kind agent`                               |
| PR3b | Docs, generators, website en+es                                         |

## Risks

- Breadth (~35 source, ~20 test files); a missed `kind === 'command'` branch silently excludes agents. Mitigate with a grep checklist and a round-trip test.
- `refreshFlatFile` hardcoded noun gives wrong conflict reasons until parametrized.
- With option (i), `a.md` containing `name: b` registers as `b` in Claude Code while shitaku reports `a`.
- Frontmatter reader rejects real-world agents with multi-line lists; document the limit.
- Older versions throw `ManifestError` on `kind: 'agent'`; add the README downgrade note.
- Docs guards: `docs:catalog:check` needs README markers; `generators.test.ts` sandboxes need the agents section.
- A skill and an agent sharing a name make `uninstall` ambiguous without `--kind`; add tests.
- Agents can grant tools/permissions through frontmatter; `--source` trust copy must say so.
- Not verified: Claude Code's agent name rule (catalog regex allows digits).
- Total size exceeds 400 lines; chained PRs required.

## Open product questions

1. Require frontmatter `name` equal to the file stem (recommended), or stem only like commands?
2. Any install-time confirmation for agents, or same trust as commands and skills (recommended: none)?
3. Reject multi-line frontmatter (current reader), or extend the reader in a separate change?
4. Allow digits in agent names, pending the Claude Code rule?

## Ready for Proposal

Yes, once the open product questions are confirmed.

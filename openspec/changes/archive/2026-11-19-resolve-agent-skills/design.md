# Design: Resolve skills declared by agents on `shitaku init` (#280)

## Technical Approach

Approach 1 from the proposal: agents declare `skills:` in frontmatter, the catalog layer parses it into `AgentItem.skills`, and `planInit` merges the declared catalog skills into the regular skill plan. Resolution lives in the plan step, so dry-run, `--yes`, conflict re-planning and hook-decline re-planning all see the same result. Apply, journal, backup and undo are untouched: they are already generic for every `plan.skills` entry.

Layers:

- **Domain, catalog**: `readFrontmatter` gains an opt-in `lists` option (block sequence and inline flow sequence of scalars). `parseAgent` requests `['skills']`. `frontmatter.ts` stays import-free and uses erasable TypeScript only.
- **Domain, plan**: a new pure resolver `src/domain/plan/agent-dependencies.ts` returns the required and missing skills keyed by dependency kind, plus the message builders. `SkillPlanEntry`/`SkillChange` carry `requiredBy` and `autoAdded`. `ChangePlan` gains `warnings` and `notes`.
- **Application**: `planInit` calls the resolver, adds the auto skill entries after the explicit ones, and turns each missing skill into a warning or, when a `SKILL.md` already exists on disk, a note. The on-disk probe uses the existing `FileSystem` and `AgentTarget` ports (new helper `src/application/agent-skills.ts`). `InitRequest.skippedSkills` lets the CLI keep a declined auto skill out of a re-plan.
- **Adapter, CLI**: `printPlan` appends the `required by agent ...` reason to auto entries and prints `warning:` and `note:` lines. `runInit` passes the skipped skill names when it re-plans after conflicts. The exit code never changes because of warnings or notes.

## Architecture Decisions

### Decision: Opt-in `lists` option in the import-free frontmatter reader

**Choice**: Add `lists?: readonly string[]` to the nested-mode options of `readFrontmatter`, symmetric with `mappings`. A listed key yields `lists[key]: string[]` and never appears in `data` or `opaque`. Accepted forms:

| Input after `skills:`                                                                                                                            | Result                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| empty, followed by `- item` lines (indented or at column 0, consistent indentation)                                                              | items in order                                                                                           |
| empty, no item lines                                                                                                                             | `[]` (YAML `null`, read as "no skills")                                                                  |
| `[a, b]`, `['a', "b"]`, `[]`, optional trailing `# comment`                                                                                      | items in order                                                                                           |
| anything else (plain scalar, block scalar header, nested mapping, multi-line or unterminated flow, empty flow item, trailing comma, nested flow) | issue naming the key, for example `frontmatter key 'skills' must be a block or flow sequence of scalars` |

Items reuse `readScalar` (block form) and refactored quote scanners (flow form). The quoted decoders are split into `scan*Quoted(text, from) -> { value, end } | { reason }`; the existing callers keep their `QUOTED_TAIL` check, so their behavior is unchanged.

**Alternatives considered**: (a) Treat `skills` as a `mappings` key: wrong shape, a top-level sequence is not a mapping. (b) Pull in a YAML library: breaks the portability guard (`frontmatter-portability.test.ts`) and the plain-Node docs scripts. (c) Parse `skills` inside `agent.ts` from raw lines: duplicates scanning logic outside the reader that already owns frontmatter grammar.

**Rationale**: Keeps one grammar owner, preserves the strict-subset guarantee (anything accepted reads the same way in a standard YAML parser, except the empty value read as `[]`), and default strict mode, `mappings`, skills and commands are untouched because the option is opt-in.

### Decision: `AgentItem.skills: string[]`, required, deduplicated, unvalidated names

**Choice**: `parseAgent` calls `readFrontmatter(..., { allowNested: true, lists: ['skills'] })`, sets `skills = [...new Set(front.lists['skills'] ?? [])]`, and does not validate item names. A malformed `skills` value fails `parseAgent` with the reader issue, which the catalog source already reports as `warning: skipped <file>: <reason>`.

**Alternatives considered**: Validate names with `SkillNameSchema` at parse time and reject the agent; keep `skills` opaque on error.

**Rationale**: Name validity is a resolution concern: an unknown or malformed name is simply "not in the catalog" and produces a plan warning (proposal decision). Rejecting the whole agent for one bad name is harsher than the product wants. Structural errors are still rejected so the subset stays strict.

### Decision: Pure resolver keyed by dependency kind

**Choice**: `resolveAgentDependencies(agents, catalog)` in `src/domain/plan/agent-dependencies.ts` returns `{ skills: { required: Map<skill, agent[]>, missing: { agent, name }[] } }`. Order is deterministic: selected-agent order, then declaration order. The module also exports the message builders (`requiredByReason`, `missingSkillWarning`, `unmanagedSkillNote`) and `isSafeSkillName`.

**Alternatives considered**: Inline the logic in `planInit`; return a flat list of skill names.

**Rationale**: A pure function is table-testable without ports, and the per-kind key lets #300 add `mcps: { required, missing }` without touching callers of `skills`. Keeping message text in the domain makes the CLI and tests agree on one source.

### Decision: Separate `requiredBy` and `autoAdded` fields, classification `reason` untouched

**Choice**: `SkillPlanEntry` and `SkillChange` gain optional `requiredBy?: string[]` (every selected agent that declares the skill, set whenever there is at least one) and `autoAdded?: true` (set only when the skill is in the plan because of agents, not because the user selected it). `buildSkillPlan` copies both. `reason` keeps carrying the classification reason (`already installed`, `installed by shitaku`, conflict text). `printPlan` composes the shown reason: `[change.reason, change.autoAdded && requiredByReason(change.requiredBy)]` joined with `; `.

**Alternatives considered**: Overwrite `reason` with `required by agent X` in `buildSkillPlan` (loses `already installed` and conflict reasons, and the conflict prompt reads `reason`); a single `origin: 'selected' | 'agent'` enum required on every entry (forces edits in every test literal).

**Rationale**: Matches the proposal ("explicit selection reason wins, `requiredBy` is still recorded") without breaking the conflict prompt, which keeps showing the classification reason. Both fields are optional, so existing literals and `refreshSkill` keep compiling.

### Decision: `ChangePlan.warnings` and `ChangePlan.notes` as plain strings

**Choice**: Two required `string[]` fields on `ChangePlan`. `buildPlan` and the empty plan in `planMcps` return `[]`; `planInit` fills them. `printPlan` prints each as `warning: <text>` and `note: <text>` on stdout (`deps.out`), after the plan rows and env lines, in both real runs and `--dry-run`. Exit codes are unchanged.

**Alternatives considered**: A typed `PlanMessage { level, kind, agent, name }`; printing to stderr; a `Warnings:` header block.

**Rationale**: The existing plan already emits `warning: X is not set` and `note: close Claude Code...` lines on stdout, so the new lines match the established output style (the "Warnings section" of the proposal is this group of prefixed lines). Strings stay generic for #300. Required fields catch every `ChangePlan` producer at compile time; there are only two in `src/`.

### Decision: On-disk probe in the application layer, guarded by a name check

**Choice**: New `src/application/agent-skills.ts` exports `classifyMissingSkills(deps, scope, missing): Promise<{ warnings: string[]; notes: string[] }>`. For each missing `{ agent, name }`: if `isSafeSkillName(name)` and `fs.exists(`${skillsDir}/${name}/SKILL.md`)` is true in the run scope, or in user scope when the run scope is `project`, emit a note; otherwise emit a warning. Unsafe names (anything not matching the skill name pattern, for example `../x`) are never probed and always warn.

**Alternatives considered**: A new port method; probing in the domain; probing every declared skill, including catalog ones.

**Rationale**: `FileSystem.exists` and `AgentTarget.skillsDir` already exist, so no port changes are needed and the domain stays free of I/O. The name guard prevents frontmatter text from steering filesystem probes outside the skills directory. Only catalog-missing skills are probed, so the common path adds no I/O.

### Decision: `InitRequest.skippedSkills` for conflict re-planning

**Choice**: Add `skippedSkills?: string[]` to `InitRequest`. `planInit` never auto-adds a skill named there. In `runInit`, when the user answers `skip` to a conflict of kind `skill`, the name is added to `skippedSkills` (in addition to the existing removal from `keep.skill`), and the re-plan request carries it. The hook-decline re-plan spreads `request`, so it keeps the list.

**Alternatives considered**: Rely on `applyPlan` ignoring `conflict` entries.

**Rationale**: Without this, skipping an auto-added skill while choosing `overwrite` for another item sets `force = true`, the re-plan re-adds the skill, classifies it `update` under `--force`, and overwrites the directory the user just declined. Skipping a conflicting agent needs nothing extra: the agent leaves the filtered request and its exclusive skills disappear on re-plan.

## Data Flow

```
catalog/agents/*.md
   │ folder-source -> parseAgent -> readFrontmatter({ lists: ['skills'] })
   ▼
AgentItem { name, description, skills, bytes }
   │
planInit(req)
   ├─ validate explicit names (unchanged; unknown explicit skill still throws)
   ├─ resolveAgentDependencies(selectedAgents, catalogSkillNames)   [domain, pure]
   │     └─ { skills: { required: Map, missing: [] } }
   ├─ autoNames = required.keys() - explicit - req.skippedSkills
   ├─ skillEntries = explicit (requiredBy?) ++ auto (requiredBy, autoAdded)
   ├─ classifyMissingSkills(fs, target, paths, scope, missing)    [application, ports]
   │     └─ { warnings, notes }
   └─ ChangePlan { ..., skills: buildSkillPlan(entries), warnings, notes }
          │
runInit ── conflicts? ── skip skill => skippedSkills; skip agent => filtered request
          │                 └─ planInit(request) again (same resolution)
          ├─ hook decline ── planInit({ ...request, hooks: [] })
          ├─ printPlan: rows (+ "required by agent ..."), env lines, warning:/note: lines
          └─ applyPlan (unchanged: backup, journal, undo per skill entry)
```

## File Changes

| File                                                  | Action | PR  | Description                                                                                                                             |
| ----------------------------------------------------- | ------ | --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/catalog/frontmatter.ts`                   | Modify | 1   | `lists` option and overload, `ListedFrontmatterResult`, block-sequence and flow-sequence readers, quote scanners returning an end index |
| `src/domain/catalog/agent.ts`                         | Modify | 1   | `AgentItem.skills`, request `lists: ['skills']`, dedupe                                                                                 |
| `test/domain/catalog/frontmatter-lists.test.ts`       | Create | 1   | Table-driven accept/reject cases for both forms; strict-mode and `mappings` regression                                                  |
| `test/domain/catalog/frontmatter-portability.test.ts` | Modify | 1   | Plain-Node run that parses `skills: [a, b]` with `lists`                                                                                |
| `test/domain/catalog/agent.test.ts`                   | Modify | 1   | `skills` from block, flow, absent, duplicates; malformed value issue                                                                    |
| `test/helpers/agents.ts`                              | Modify | 1   | `makeAgent` derives `skills` through `parseAgent` (or takes them explicitly) so items match their bytes                                 |
| `test/adapters/catalog/folder-source.test.ts`         | Modify | 1   | An agent with an inline `skills:` loads; a malformed one is reported as a skipped file                                                  |
| `src/domain/plan/agent-dependencies.ts`               | Create | 2   | Resolver, `isSafeSkillName`, message builders                                                                                           |
| `src/domain/plan/skill-plan.ts`                       | Modify | 2   | `requiredBy?`, `autoAdded?` on entry and change; copied by `buildSkillPlan`                                                             |
| `src/domain/plan/change-plan.ts`                      | Modify | 2   | `warnings`, `notes` on `ChangePlan`; `buildPlan` returns `[]`; skill comment updated                                                    |
| `src/application/agent-skills.ts`                     | Create | 2   | `classifyMissingSkills` with the guarded on-disk probe                                                                                  |
| `src/application/init-mcps.ts`                        | Modify | 2   | `skippedSkills` on `InitRequest`; resolution and entries in `planInit`; empty plan gets `warnings`/`notes`                              |
| `src/adapters/cli/program.ts`                         | Modify | 2   | `printPlan` reason and message lines; `skippedSkills` in conflict re-plan                                                               |
| `test/domain/plan/agent-dependencies.test.ts`         | Create | 2   | Resolver tables and message text                                                                                                        |
| `test/domain/plan/skill-plan.test.ts`                 | Modify | 2   | Fields copied through                                                                                                                   |
| `test/application/agent-skills.test.ts`               | Create | 2   | Note vs warning by scope; unsafe name never probed                                                                                      |
| `test/application/init-mcps.test.ts`                  | Modify | 2   | Merge, dedupe, scope, order, skipped, warnings, apply and undo of auto skills                                                           |
| `test/adapters/cli/program.test.ts`                   | Modify | 2   | Dry-run output, `--yes` install, warnings exit 0, conflict skip of agent and of auto skill                                              |
| `test/adapters/catalog/bundled-catalog.test.ts`       | Modify | 2   | Guard: every skill a bundled agent declares exists in the bundled catalog                                                               |
| `catalog/agents/docs-writer.md`                       | Modify | 2   | Line "Installing this agent does not install the skill." becomes false; reword                                                          |
| `CONTRIBUTING.md` (agents section only)               | Modify | 3   | Document `skills:` forms and resolution                                                                                                 |
| `README.md` (agents section)                          | Modify | 3   | Document auto-install, warnings and notes                                                                                               |

## Interfaces / Contracts

```ts
// src/domain/catalog/frontmatter.ts (import-free, erasable TS only)
export type ListedFrontmatterResult =
  | {
      data: Record<string, string>;
      opaque: string[];
      maps: Record<string, BlockMapping>;
      lists: Record<string, string[]>;
      body: string;
    }
  | FrontmatterIssue;
// New overload, declared before the existing ones:
export function readFrontmatter(
  text: string,
  file: string,
  options: { allowNested: true; lists: readonly string[]; mappings?: readonly string[] },
): ListedFrontmatterResult;

// src/domain/catalog/agent.ts
export interface AgentItem {
  name: string;
  description: string;
  /** Skill names declared in frontmatter, deduplicated, in declaration order; empty when absent. */
  skills: string[];
  bytes: Uint8Array;
}

// src/domain/plan/agent-dependencies.ts
export interface MissingDependency {
  agent: string;
  name: string;
}
export interface DependencyResolution {
  skills: { required: Map<string, string[]>; missing: MissingDependency[] };
  // #300 adds: mcps: { required: Map<string, string[]>; missing: MissingDependency[] };
}
export function resolveAgentDependencies(
  agents: readonly Pick<AgentItem, 'name' | 'skills'>[],
  catalog: { skills: readonly string[] },
): DependencyResolution;
export const isSafeSkillName: (name: string) => boolean; // same pattern as SkillNameSchema
export const requiredByReason: (agents: readonly string[]) => string;
//   ['a'] -> 'required by agent a'; ['a', 'b'] -> 'required by agents a, b'
export const missingSkillWarning: (agent: string, skill: string) => string;
//   'agent <agent> requires skill <skill>, which is not in the catalog'
export const unmanagedSkillNote: (agent: string, skill: string) => string;
//   'agent <agent> requires skill <skill>, found on disk, not managed by shitaku'

// src/domain/plan/skill-plan.ts (both optional)
interface SkillPlanEntry {
  /* ... */ requiredBy?: string[];
  autoAdded?: true;
}
interface SkillChange {
  /* ... */ requiredBy?: string[];
  autoAdded?: true;
}

// src/domain/plan/change-plan.ts
interface ChangePlan {
  /* ... */ warnings: string[];
  notes: string[];
}

// src/application/init-mcps.ts
interface InitRequest {
  /* ... */ skippedSkills?: string[];
}

// src/application/agent-skills.ts
export function classifyMissingSkills(
  deps: Pick<InitDeps, 'fs' | 'target' | 'paths'>,
  scope: Scope,
  missing: readonly MissingDependency[],
): Promise<{ warnings: string[]; notes: string[] }>;
```

Ordering contract: `plan.skills` lists explicit skills in request order, then auto-added skills in resolution order (selected-agent order, then declaration order). Warnings and notes follow the order of `missing`. Exact message text is owned by the spec; the strings above are the design proposal.

## Testing Strategy

Strict TDD: each row starts with a failing test (RED) before the code.

| Layer                 | What to Test                                                                                                                                                                                                                                                                         | Approach                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (domain, reader) | Block form at column 0 and indented; flow `[a, b]`, quoted items, `[]`, trailing comment; empty value is `[]`; rejects scalar, `                                                                                                                                                     | `, nested mapping, multi-line flow, `[a,]`, `[a,,b]`, nested `[[a]]`, unterminated quotes, tab indent; listed key absent from `data`/`opaque`; strict mode and `mappings` unchanged | Table-driven `it.each` in `frontmatter-lists.test.ts`; existing suites kept as regression |
| Portability           | `lists` works under plain Node with no flags                                                                                                                                                                                                                                         | Extend the spawn test in `frontmatter-portability.test.ts`                                                                                                                          |
| Unit (domain, agent)  | `skills` from both forms equal; absent -> `[]`; duplicates removed; malformed -> key-named issue                                                                                                                                                                                     | `agent.test.ts`                                                                                                                                                                     |
| Unit (domain, plan)   | Union and per-skill agent lists; missing entries; order; empty agents; message builders; `isSafeSkillName`; `buildSkillPlan` copies fields                                                                                                                                           | `agent-dependencies.test.ts`, `skill-plan.test.ts`                                                                                                                                  |
| Application           | Note in run scope; note from user scope when run scope is project; warning otherwise; unsafe name not probed (spy on `fs.exists`)                                                                                                                                                    | `agent-skills.test.ts` with in-memory fs                                                                                                                                            |
| Application           | `planInit`: auto skill in run scope with `requiredBy`/`autoAdded`; explicit plus required deduped without `autoAdded`; `skippedSkills` excluded; unknown explicit skill still throws; missing -> warning, plan still built; `applyPlan` journals auto skills and `undo` removes them | `init-mcps.test.ts` with fixture catalog                                                                                                                                            |
| Adapter (CLI)         | `--dry-run` prints `required by agent ...` and writes nothing; `--yes` installs agent and skill; warning printed, exit 0; skipping a conflicting agent drops its exclusive skill; skipping a conflicting auto skill while overwriting another item does not overwrite the skill      | `program.test.ts` with fake prompter                                                                                                                                                |
| Repo guard            | Every bundled agent's declared skills are in the bundled catalog                                                                                                                                                                                                                     | `bundled-catalog.test.ts`                                                                                                                                                           |
| Architecture          | Domain stays I/O-free; no `../` imports                                                                                                                                                                                                                                              | Existing `architecture.test.ts`, `naming` guards                                                                                                                                    |

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. One related hardening is still a design requirement: the on-disk probe builds a path from frontmatter text, so `classifyMissingSkills` MUST skip the probe for names that fail `isSafeSkillName` (RED test: a `../x` name produces a warning and `fs.exists` is never called with it). Planned skill roots only use catalog skill names, which `SkillNameSchema` already validates.

## Migration / Rollout

No migration required. The manifest format, `status` and `undo` are unchanged; auto-added skills are ordinary journaled skill entries. Delivery as three chained PRs, each green on its own:

| PR  | Boundary                                                                                                                 | Estimate |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | Reader `lists` option, `AgentItem.skills`, test helper, PR 1 tests. `skills` is parsed but unused.                       | ~220-280 |
| 2   | Resolver, plan fields, application helper, `planInit`, `printPlan`, `runInit` re-plan, `docs-writer.md` line, PR 2 tests | ~300-380 |
| 3   | CONTRIBUTING agents section, README agents section                                                                       | ~40-80   |

If PR 2 exceeds the 400-line budget at apply time, split it into 2a (domain resolver, `skill-plan` and `change-plan` fields with `[]` defaults, unit tests; no behavior change) and 2b (application helper, `planInit`, CLI, integration tests, catalog line). Rollback: revert in reverse order; after reverting PR 2, `skills` is parsed but unused, and reverting PR 1 restores the opaque handling.

## Open Questions

- [ ] Spec alignment: confirm that a plain scalar (`skills: foo` or `skills: a, b`) is rejected with a key-named issue (design default) rather than read as a one-item or comma-separated list. Rejection makes such a third-party agent a skipped catalog file. Verify against the Claude Code subagent `skills` syntax before the spec is final.
- [ ] Spec alignment: confirm the exact message and reason text (`required by agent` vs `required by agents` for several agents) and that warnings and notes print as prefixed `warning:`/`note:` lines on stdout.
- [ ] Docs scope: the website docs (`website/src/content/docs/en/...`) also describe agent installs; the proposal limits docs to CONTRIBUTING and README. Decide whether a website update is a follow-up.

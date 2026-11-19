# Proposal: Resolve skills declared by agents on `shitaku init` (#280)

## Intent

Claude Code agents can declare the skills they rely on in frontmatter (`skills:`). shitaku installs the agent file verbatim but treats `skills` as an opaque key. The result is an installed agent whose declared skills are missing. Three bundled agents already declare skills (`docs-writer`, `pr-creator`, `socratic-challenger`), so a user who runs `shitaku init --agents docs-writer --yes` gets a broken setup unless they also know to pass `--skills`.

Success means that selecting an agent installs the catalog skills it declares, shows them in the plan (dry-run included) with the reason, keeps all existing safety guarantees (conflicts, backups, journal, undo), and warns without failing when a declared skill is not in the catalog.

## Scope

### In Scope

- Parse the agent `skills` frontmatter key into a list of names. The reader supports the multi-line block sequence (`skills:` followed by `- name` items) and the inline flow form (`skills: [a, b]`). This is a user decision.
- Expose `skills: string[]` on `AgentItem` (empty when the key is absent).
- Resolve declared skills inside `planInit`: take the union of explicitly selected skills and the skills declared by the selected agents, then plan them as regular skill entries in the same run scope.
- Add a reason to auto-added skill entries (for example `required by agent docs-writer`). When several agents need a skill, the reason lists all of them. An explicitly selected skill keeps its normal reason.
- Add a `warnings` field to `ChangePlan` and print it from `printPlan` for both real runs and `--dry-run`. A declared skill that is missing from the catalog produces a warning, not a failure.
- Keep conflict-skip and hook-decline re-planning correct. Skipping an agent drops the skills that only that agent required, because the plan is recomputed from the filtered request.
- Write tests first (strict TDD) for the reader, `parseAgent`, the resolver, `planInit`, and the CLI plan output.
- Docs: the agents section of `CONTRIBUTING.md` and the README text about agents.

### Out of Scope

- A prompt for each skill or a `--no-agent-skills` opt-out (exploration Approach 4; possible follow-up).
- Resolving MCP servers that agents require (#300). The design must make this reuse possible, but it is not built here.
- Removing a skill when its agent is uninstalled (`uninstall --kind agent`).
- Changing the manifest format or the `status` output.
- Profile removal (#285) and any `CONTRIBUTING.md` edits outside the agents section.
- Full YAML support. Only the two list forms above are accepted for `skills`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog`: the "Agent catalog entries" requirement now says agents expose a parsed `skills` list. The "Opt-in nested frontmatter reader" requirement gains an opt-in list mode for named top-level keys that accepts block sequences of scalars and an inline flow sequence of scalars. Default strict mode, other keys and the existing `mappings` behavior stay unchanged. A malformed `skills` value (for example a nested mapping) must be rejected with a clear, key-named issue, or kept opaque. The spec phase decides which; see Risks.
- `agents-install`: a new requirement, "Declared skill resolution". Selected agents pull their declared catalog skills into the plan in the run scope, with a reason. Missing skills produce plan warnings. Conflict-skip of an agent drops the skills only it required. Uninstalling an agent leaves its skills in place. Undo of the install reverts the auto-added skills like any other journaled entry.
- `skills-install`: skill plan entries may come from agent requirements. They carry the `required by agent X` reason and follow the same classification, conflict, backup and undo rules as explicitly selected skills.

## Approach

This is exploration Approach 1, chosen by the user. It touches these hexagonal layers:

1. **Domain (`src/domain/catalog/frontmatter.ts`, `agent.ts`)**: add an opt-in `lists` option to `readFrontmatter`, used with `allowNested`, symmetric with `mappings`. A listed key yields `lists[key]: string[]` from either a block sequence or an inline `[a, b]` flow sequence of plain or quoted scalars. The module stays import-free, as the portability test requires. `parseAgent` requests `['skills']` and sets `AgentItem.skills`.
2. **Domain (new pure resolver, e.g. `src/domain/plan/agent-dependencies.ts`)**: a function takes the selected agents and the catalog skill names and returns `{ required: Map<skillName, agentNames[]>, missing: { agent, skill }[] }`. The result is keyed by dependency kind, so #300 can add an MCP branch without changing callers.
3. **Domain (`change-plan.ts`, `skill-plan.ts`)**: add `ChangePlan.warnings: string[]` and an optional `requiredBy: string[]` on skill plan entries. The plan builder turns `requiredBy` into the reason.
4. **Application (`src/application/init-mcps.ts`)**: before `skillEntries` are built, `planInit` merges the resolver's required skills into `skillNames` and turns `missing` into warnings. Apply, journal and undo stay unchanged because they are already generic for each skill entry.
5. **Adapter (`src/adapters/cli/program.ts`)**: `printPlan` prints the reason and a `Warnings` block. The exit code is unaffected.

Rationale: the plan and the confirm gate are already the consent surface. Resolving inside `planInit` means dry-run, `--yes`, conflict re-planning and hook-decline re-planning all see the same result, and no new port is needed.

### Scoped decisions (recommendations)

| Topic                                              | Recommendation                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Warning channel                                    | `ChangePlan.warnings`, printed by `printPlan` in a `Warnings` section in both dry-run and real runs, on the same stream as the plan. No change to the exit code.                                                                                                                                                                                                        |
| Scope of auto-added skills                         | The run scope (`req.scope`), which is always the agent's scope because one init run has one scope.                                                                                                                                                                                                                                                                      |
| Uninstalling an agent                              | Leaves its auto-added skills installed, since other agents or the user may rely on them. `undo` of the whole install still reverts them through the journal.                                                                                                                                                                                                            |
| Skill missing from the catalog but present on disk | **Decided by the user: option (c).** When `<skillsDir>/<name>/SKILL.md` exists in the run scope, or in user scope when the run scope is project (Claude Code loads both), emit an informational note (`agent X requires skill Y, found on disk, not managed by shitaku`) instead of a warning. Otherwise warn: `agent X requires skill Y, which is not in the catalog`. |
| Explicitly selected and also required              | Deduplicate to one entry. The explicit selection reason wins, and `requiredBy` is still recorded.                                                                                                                                                                                                                                                                       |
| Malformed names in `skills`                        | Not found in the catalog, so treated as missing and warned. They are never treated as paths.                                                                                                                                                                                                                                                                            |
| #300 reuse                                         | The resolver output is keyed by dependency kind, and warnings are generic plan strings.                                                                                                                                                                                                                                                                                 |
| CONTRIBUTING                                       | Edit only the agents section, to stay orthogonal to #285.                                                                                                                                                                                                                                                                                                               |

### Product fork for the orchestrator

- **Missing from the catalog but already installed:** (a) emit no warning when a matching skill is found on disk, which is the recommendation; (b) always warn, because shitaku cannot vouch for the content on disk; (c) emit an informational note instead of a warning. **Resolved: the user chose (c).**

## Affected Areas

| Area                                                                                                                                 | Layer       | Impact       | Description                                            |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------ | ------------------------------------------------------ |
| `src/domain/catalog/frontmatter.ts`                                                                                                  | Domain      | Modified     | Opt-in `lists` option: block and inline flow sequences |
| `src/domain/catalog/agent.ts`                                                                                                        | Domain      | Modified     | `AgentItem.skills: string[]`                           |
| `src/domain/plan/agent-dependencies.ts`                                                                                              | Domain      | New          | Pure resolver for declared dependencies                |
| `src/domain/plan/change-plan.ts`, `skill-plan.ts`                                                                                    | Domain      | Modified     | `warnings`, `requiredBy` and the reason                |
| `src/application/init-mcps.ts`                                                                                                       | Application | Modified     | Merge required skills and emit warnings in `planInit`  |
| `src/adapters/cli/program.ts`                                                                                                        | Adapter     | Modified     | Print the reason and warnings                          |
| `test/domain/catalog/*`, `test/domain/plan/*`, `test/application/init-mcps.test.ts`, `test/adapters/cli/*`, `test/helpers/agents.ts` | Tests       | Modified/New | TDD coverage                                           |
| `CONTRIBUTING.md` (agents section), `README.md`                                                                                      | Docs        | Modified     | Document `skills:` resolution                          |

## Risks

| Risk                                                                                                      | Likelihood | Mitigation                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A malformed `skills` value starts making a previously valid agent invalid, which breaks existing catalogs | Med        | The spec decides between rejecting with a key-named issue and staying opaque with a warning. The recommendation is to reject only a nested mapping under `skills` and keep everything else readable. |
| The flow-sequence parser accepts too much or too little (quotes, trailing commas, empty `[]`)             | Med        | Define a strict subset in the spec, reject the rest with a key-named issue, and add table-driven tests                                                                                               |
| A strict-mode regression for skills and commands                                                          | Low        | `lists` is opt-in. The existing "strict mode unchanged" scenarios stay as regression tests.                                                                                                          |
| Conflict skip on an agent leaves orphan auto-added skills                                                 | Low        | Resolution happens inside `planInit` on the filtered request. An explicit test covers it.                                                                                                            |
| Surprising installs for users of `--yes`                                                                  | Low        | The plan output lists the skills with their reason. The opt-out flag is deferred and recorded as a follow-up.                                                                                        |

## Rollback Plan

Revert the PR slices in reverse order. PR 3 (docs) and PR 2 (resolver, `planInit`, CLI) revert cleanly. After that, agents still parse `skills`, but nothing consumes the value. Reverting PR 1 restores the opaque handling. The manifest format does not change, so existing installs, `status` and `undo` keep working across a rollback. Skills installed through resolution are ordinary journaled skill entries, and `shitaku undo` removes them.

## Dependencies

- None external. #300 depends on the resolver shape. #285 is orthogonal.

## Success Criteria

- [ ] `shitaku init --agents docs-writer --yes` installs `docs-writer` and every skill it declares that exists in the catalog, in the same scope.
- [ ] `--dry-run` lists the auto-added skills with `required by agent <name>` and writes nothing.
- [ ] A declared skill missing from the catalog produces a plan warning, and the exit code does not change.
- [ ] Both `skills:` block sequences and `skills: [a, b]` parse to the same list. Skill and command strict-mode behavior is unchanged.
- [ ] Skipping a conflicting agent drops the skills only it required. `undo` reverts the auto-added skills.
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint` and `pnpm run format:check` pass. The architecture and portability guards stay green.

## Review Workload Forecast

| Slice | Content                                                                                        | Estimated changed lines |
| ----- | ---------------------------------------------------------------------------------------------- | ----------------------- |
| PR 1  | Frontmatter `lists` option (block and flow), `AgentItem.skills`, and tests                     | ~220-280                |
| PR 2  | Resolver, `ChangePlan.warnings`, `requiredBy`/reason, `planInit` merge, `printPlan`, and tests | ~300-380                |
| PR 3  | CONTRIBUTING agents section and README                                                         | ~40-80                  |
| Total |                                                                                                | ~560-740                |

Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High

Suggested slicing: three chained PRs in the order above. Each one is autonomous and green on its own. PR 1 changes only the parsing and adds an unused field. PR 2 is the behavior change. PR 3 is documentation. Under `ask-on-risk`, the orchestrator must ask for the chain strategy (`stacked-to-main` or `feature-branch-chain`) before apply.

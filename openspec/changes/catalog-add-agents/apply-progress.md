# Apply progress: catalog-add-agents

Mode: Strict TDD. Delivery: stacked-to-main. Branch: feat/agents-1-dedupe.

## PR 1: Dedupe (tasks 1.1-1.5) - COMPLETE

- [x] 1.1 `isFlatFileKind` table test (`test/domain/manifest.test.ts`)
- [x] 1.2 Profile tests on the known-names object arg (`test/domain/catalog/profile.test.ts`, `bundled-catalog.test.ts`)
- [x] 1.3 `FlatFileKind`, `isFlatFileKind`, `KnownNames`, object-arg `resolveProfile`/`validateProfiles`, `folder-source.ts` call site
- [x] 1.4 `refreshFlatFile(..., kind)`, `ByteStep.item.kind: TreeKind | FlatFileKind`, `flatFileStep(change, kind)`
- [x] 1.5 Grep checklist baseline recorded below; command suites green

### TDD Cycle Evidence

| Task | RED                                                     | GREEN                                         | REFACTOR                                |
| ---- | ------------------------------------------------------- | --------------------------------------------- | --------------------------------------- |
| 1.1  | `isFlatFileKind` missing -> manifest tests failed       | `manifest.ts` exports it; 7 table cases pass  | `FileSchema` refine uses it             |
| 1.2  | profile tests on `(name, profiles, KNOWN)` failed (22)  | `profile.ts` takes `KnownNames`               | folder-source builds one `known` object |
| 1.3  | covered by 1.1/1.2                                      | see above                                     | prettier format                         |
| 1.4  | existing command suites pin behavior (private function) | `kind` drives `noun` and manifest `item.kind` | `commandStep` -> `flatFileStep`         |
| 1.5  | n/a                                                     | n/a                                           | baseline below                          |

### Work Unit Evidence

| Evidence          | Value                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test      | `pnpm vitest run test/domain/manifest.test.ts test/domain/catalog/profile.test.ts`: RED 22 failed, then green; full `pnpm run test`: 57 files, 1310 passed |
| Runtime harness   | N/A: behavior-preserving refactor; existing init/undo suites exercise the path                                                                             |
| Rollback boundary | `init-mcps.ts`, `profile.ts`, `folder-source.ts`, `manifest.ts`, and the three test files                                                                  |

### Grep checklist baseline (`rg -n "kind === 'command'|kind !== 'command'|'command'" src`)

Command-specific branches to classify in PR 6 (task 6.8):

- `src/domain/plan/doctor-plan.ts:105` `o.item.kind === 'command'` (explicit agent branch later)
- `src/application/installed-state.ts:141,164` (migrate to `isFlatFileKind`)
- `src/application/uninstall-item.ts:84,139,170` (84: explicit agent branch in `expectedPath`; 139, 170: migrate)
- `src/application/init-mcps.ts:141` plan `noun: 'command'` (PR 5); `:393`, `:406` pass `'command'` to the parametrized helpers
- `src/domain/manifest.ts:27,123,149,187` schema literal, `deriveTreeOwnership` kind, `deriveCommandOwnership`, `OwnedItem.kind`
- `src/ports/prompter.ts:18`, `src/adapters/cli/program.ts:263,352,637` (PR 8)
- `src/domain/catalog/listing.ts:6,24` (PR 3b)
- Not kind-related (ignore): `hook-merge.ts:7`, `catalog/hook.ts:46,50`, `claude-code/target.ts:23`

### Deviations

- `KnownNames` omits `agents?` until PR 3b (`ResolvedProfile` has no `agents` yet).
- Added the `agent` literal to the manifest `ItemSchema` and `'agent'` to `OwnedItem.kind` now (design row d, pulled forward): required for `ByteStep.item.kind: FlatFileKind` to typecheck against `Install['files']`. Additive; old manifests parse. Test added ("agent items").
- `refreshFlatFile` stays private; the `'agent'` noun path cannot be exercised until `plan.agents` exists (PR 5). The `'command'` noun path is covered by existing suites.

## PR 2: Frontmatter nested mode

| Task | RED                                              | GREEN                                    | Refactor                                  |
| ---- | ------------------------------------------------ | ---------------------------------------- | ----------------------------------------- |
| 2.1  | strict-mode-unchanged test (absent/false option) | default path unchanged                   | n/a                                       |
| 2.2  | 10 nested-mode tests failed, 10 existing passed  | `allowNested` overload + `opaque` list   | n/a                                       |
| 2.3  | see 2.2                                          | 20/20 in `frontmatter.test.ts`           | n/a                                       |
| 2.4  | n/a                                              | n/a                                      | shared `splitBlock` helper for both modes |
| 2.5  | n/a                                              | design.md Open Question closed, #238 ref | n/a                                       |

### Deviations

- `readFrontmatter` uses overloads: strict mode still returns `{ data, body }` with no `opaque` key (so existing `toEqual` tests stay untouched); nested mode returns the new `NestedFrontmatterResult` with `opaque`. Design typed `opaque` as always present on `FrontmatterResult`.

## PR 3a: Agent schema

| Task | RED                                                          | GREEN                                                            | Refactor                                                        |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| 3a.1 | `agent.test.ts` failed (module missing, 19 tests)            | n/a                                                              | n/a                                                             |
| 3a.2 | see 3a.1                                                     | 19/19 with `parseAgent` + `AgentNameSchema`                      | n/a                                                             |
| 3a.3 | 2 new `schema.test.ts` tests failed (`items.agents` missing) | `agents: z.array(AgentNameSchema).default([])`                   | n/a                                                             |
| 3a.4 | n/a                                                          | `test/helpers/agents.ts` (`agentBytes`, `makeAgent`, `REVIEWER`) | n/a                                                             |
| 3a.5 | n/a                                                          | n/a                                                              | `NAME_PATTERN` exported from `command.ts`, reused by `agent.ts` |

Files: `src/domain/catalog/agent.ts` (new), `command.ts`, `schema.ts`, `test/domain/catalog/{agent,schema}.test.ts`, `test/helpers/agents.ts`.
Verification: typecheck, lint, format:check, build clean; full suite 1346/1346.

### Deviations

- No JSON catalog fixtures exist under `test/fixtures/`, and `Catalog.agents` is PR 3b (task 3b.2), so no `agents: []` literals were added; 3a.4 is the builder helper only.
- `NAME_PATTERN` lives in `command.ts` (existing flat-file precedent); skill/script/hook keep their own inline regex (out of scope).

## PR 3b: Loader, listing, profile

| Task | RED                                                                        | GREEN                                                        | Refactor                                    |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| 3b.1 | 9 loader tests failed (`catalog.agents` missing)                           | n/a                                                          | n/a                                         |
| 3b.2 | see 3b.1                                                                   | `loadAgents` via `loadFileItems`; `Catalog.agents`           | n/a                                         |
| 3b.3 | 4 profile tests failed (agents merge, empty default, unknown, validate x7) | `ProfileSchema.agents`, `KnownNames.agents?`, resolve branch | n/a                                         |
| 3b.4 | listing tests failed (seven kinds, `agent` rows, filter, empty list)       | `agents` in `LIST_KINDS`, `EntryKind`, `ENTRY_KIND`, entries | n/a                                         |
| 3b.5 | n/a                                                                        | `"agents": []` in `catalog.json`; `catalog/agents/.gitkeep`  | n/a                                         |
| 3b.6 | n/a                                                                        | n/a                                                          | `ResolvedProfile.agents`; 31 literals fixed |

Files: `src/adapters/catalog/folder-source.ts`, `src/domain/catalog/{schema,profile,listing}.ts`, `catalog/catalog.json`, `catalog/agents/.gitkeep`, folder-source/profile/listing/bundled-catalog tests, and `agents: []` literals in 6 application tests and 4 helpers.
Verification: typecheck, lint, format:check, build clean; full suite 1360/1360; `docs:catalog:check` passes.

### Deviations

- `ChangePlan.agents` stays out (PR 4); the `list agents` empty case is covered at the domain level (`listEntries` returns `[]`, which the existing CLI maps to `no matching items`).
- Profile `agents` is validated only; profiles cannot install agents by name yet.

## PR 4: Manifest, plan, port

| Task | RED                                                                                 | GREEN                                                                             | Refactor                                                |
| ---- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 4.1  | `deriveAgentOwnership` import missing (4 manifest tests failed)                     | n/a (schema, refine and `OwnedItem.kind` already pulled forward in PR 1)          | n/a                                                     |
| 4.2  | see 4.1                                                                             | `deriveAgentOwnership` via `deriveTreeOwnership`; refine message                  | n/a                                                     |
| 4.3  | `ChangePlan.agents` undefined; agent noun plan test already green (generic planner) | n/a                                                                               | n/a                                                     |
| 4.4  | see 4.3                                                                             | `ChangePlan.agents`, `agents: []` in `buildPlan`/`planMcps`; `agent-missing` code | n/a                                                     |
| 4.5  | `target.agentsDir` is not a function                                                | n/a                                                                               | n/a                                                     |
| 4.6  | see 4.5                                                                             | `AgentTarget.agentsDir`; Claude impl                                              | n/a                                                     |
| 4.7  | n/a                                                                                 | n/a                                                                               | no in-memory doubles exist (all use `claudeCodeTarget`) |

Files: `src/domain/{manifest,plan/change-plan,plan/doctor-plan}.ts`, `src/ports/agent-target.ts`, `src/adapters/claude-code/target.ts`, `src/application/init-mcps.ts` (one literal), and the manifest, flat-file-plan, change-plan and target tests.
Verification: typecheck, lint, format:check, build clean; full suite green.

### Deviations

- Null-afterHash refine, `agent` item literal and `OwnedItem.kind` were already done in PR 1.
- `agent-missing` is only a union member; doctor behavior lands in PR 6.

## PR 5: Init and undo

| Task | RED                                                                                      | GREEN                                                                                        | Refactor                                         |
| ---- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 5.1  | 12 agent tests failed (`UnknownAgentError` and `InitRequest.agents` missing, empty plan) | n/a                                                                                          | n/a                                              |
| 5.2  | see 5.1                                                                                  | `InitRequest.agents`, `UnknownAgentError`, agent plan via `flatFileEntries` + noun `agent`   | `flatFileEntries` shared with commands           |
| 5.3  | apply tests in the same run (create, force, backup, stale, rollback, skip, `mine.md`)    | n/a                                                                                          | n/a                                              |
| 5.4  | see 5.3                                                                                  | `refreshFlatFile(..., 'agent')`, `flatFileStep(c, 'agent')`, empty-check sum includes agents | n/a                                              |
| 5.5  | n/a (verify-only: 4 undo agent tests green without any `undo-install.ts` change)         | n/a                                                                                          | n/a                                              |
| 5.6  | n/a                                                                                      | n/a                                                                                          | `refreshFlatFiles` replaces two duplicated loops |

Files: `src/application/init-mcps.ts`, `test/application/{init-mcps,undo-install}.test.ts`, `test/helpers/agents.ts` (`agentSource`, `REVIEWER_V2`).

### Deviations

- `undo-install.ts` and `isByteFile`/`itemRoots` needed no change (design f confirmed).
- Commands and agents now share `flatFileEntries` (plan) and `refreshFlatFiles` (apply).

## PR 6: Uninstall, status, doctor

| Task | RED                                                                               | GREEN                                                                            | Refactor                                             |
| ---- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 6.1  | 8 agent uninstall tests failed (`'reviewer' was not installed by shitaku`)        | n/a                                                                              | n/a                                                  |
| 6.2  | see 6.1                                                                           | `expectedPath` agent branch; `isFlatFileKind` in `planUninstall` / `assertFresh` | n/a                                                  |
| 6.3  | skill+agent and command+agent collisions removed without error (single candidate) | same `expectedPath` branch makes both kinds candidates                           | n/a                                                  |
| 6.4  | 4 agent status tests failed (agent observed as a tree)                            | n/a                                                                              | n/a                                                  |
| 6.5  | see 6.4                                                                           | `observeFile` dispatch via `isFlatFileKind`; `desiredFor` agent branch           | n/a                                                  |
| 6.6  | `agent-missing` finding not emitted                                               | `agent-missing` in `doctor-plan.ts`                                              | command/agent missing branches merged (6.7)          |
| 6.7  | n/a                                                                               | n/a                                                                              | one flat-file `*-missing` branch in `doctor-plan.ts` |
| 6.8  | n/a                                                                               | n/a                                                                              | grep table below                                     |

Files: `src/application/{uninstall-item,installed-state}.ts`, `src/domain/plan/doctor-plan.ts`, and the uninstall, status and doctor-plan tests. Code and tests: 224 insertions, 13 deletions (~237 lines).
Verification: typecheck, lint, format:check, build clean; full suite green (1400 tests).

### Deviations

- Doctor still emits the generic info `modified` finding for an edited agent (same as commands); only `agent-missing` is absent for it.
- Disambiguation is tested at the application level (`kind` omitted gives candidates, `kind: 'agent'` resolves); the `--kind agent` CLI wiring is PR 8.
- `undo-install.ts` and `status.ts` / `doctor.ts` needed no change.

### 6.8 grep classification (`rg -n "kind === 'command'|kind !== 'command'|'command'" src`)

| Hit                                                          | Class | Note                                                               |
| ------------------------------------------------------------ | ----- | ------------------------------------------------------------------ |
| `domain/manifest.ts:27` command item literal                 | (b)   | agent literal sits right below (PR 1)                              |
| `domain/manifest.ts:50-51` `FlatFileKind` / `isFlatFileKind` | (a)   | the helper itself                                                  |
| `domain/manifest.ts:125,195` kind unions                     | (b)   | include `'agent'`                                                  |
| `domain/manifest.ts:152` `deriveCommandOwnership`            | (b)   | `deriveAgentOwnership` added in PR 4                               |
| `domain/hook-merge.ts:7`, `domain/catalog/hook.ts:46,50`     | (c)   | hook handler `type: 'command'`, not an item kind                   |
| `domain/catalog/listing.ts:6,24`                             | (b)   | `EntryKind` includes `agent`; `commands:` key maps the plural flag |
| `application/installed-state.ts:164` `desiredFor`            | (b)   | agent branch added in PR 6                                         |
| `application/uninstall-item.ts:84` `expectedPath`            | (b)   | agent branch added in PR 6 (read/fresh checks migrated to (a))     |
| `application/init-mcps.ts:143,449,464`                       | (b)   | agent plan, apply and step siblings added in PR 5                  |
| `adapters/claude-code/target.ts:25`                          | (c)   | hook handler `type: 'command'`                                     |
| `ports/prompter.ts:18`                                       | defer | PR 8 (conflict kind union)                                         |
| `adapters/cli/program.ts:263,352,637`                        | defer | PR 8 (`--agents`, `--kind agent`, conflict kinds)                  |

Migrated to `isFlatFileKind` in PR 6: `uninstall-item.ts` (`planUninstall`, `assertFresh`), `installed-state.ts` (`observeFile` dispatch), `doctor-plan.ts` (missing branch).

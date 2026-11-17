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

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

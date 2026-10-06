# Proposal: Catalog Duplication Script

## Intent

Issue #147: add a bundled `duplication` catalog script on `jscpd` so projects can report copy-paste clones and fail above a threshold via `shitaku run duplication` (CI/agents).

## Scope

### In Scope

- `catalog/scripts/duplication/{index.mjs,script.json}` — plain ESM; `tools: ["jscpd"]`; no script-root npm bootstrap
- Register `duplication` in `catalog.json` `items.scripts` (after `complexity`, `dead-code`)
- Resolve `jscpd` from cwd `.bin` then `npx`; `--reporters json` + **temp** `--output` (cleanup; no cwd mutation)
- Envelope `shitaku.catalog.duplication/v1`: `percentage`, `threshold`, `clones[]` (both locations, lines, tokens)
- CLI: `--threshold`, `--min-lines`, `--min-tokens`, `--format json|text`; exit 0/1/2 (script-owned)
- Defaults: gitignore on; ignore `node_modules`, build output, test fixtures
- Tests (clone + clean fixtures), `bundled-catalog` update, README/website docs regen

### Out of Scope

- jscpd `--baseline`
- Complexity-style script-root bootstrap / shipped npm deps
- Wiring `resolveToolInvocation` into `runScript`
- Hexagonal `src/` changes

## Capabilities

### New Capabilities

- `catalog-scripts-duplication`: CLI, envelope, exits, ignore/gitignore, local-bin/npx tool resolution, temp report lifecycle

### Modified Capabilities

- `scripts-install`: “Bundled catalog scripts” MUST list/ship `duplication` with `complexity` and `dead-code` (no shipped npm deps)

## Approach

Mirror **dead-code**: thin jscpd adapter, no catalog deps. Own shitaku `--format` (never forward jscpd language `--format`); parse temp JSON report; enforce threshold after parse; reuse install/run/doctor as-is.

## Affected Areas

| Area                                            | Impact   | Description                                   |
| ----------------------------------------------- | -------- | --------------------------------------------- |
| `catalog/scripts/duplication/`                  | New      | `index.mjs` + `script.json`                   |
| `catalog/catalog.json`                          | Modified | Add `duplication`                             |
| `test/catalog/scripts/duplication.test.ts`      | New      | Spawn, envelope, exits, no leftover `report/` |
| `test/fixtures/duplication/`                    | New      | Known clone + clean                           |
| `test/adapters/catalog/bundled-catalog.test.ts` | Modified | Three scripts                                 |
| `openspec/specs/scripts-install`                | Modified | Bundled list + `duplication`                  |
| README + website catalog docs                   | Modified | Docs regen                                    |
| Hexagonal `src/`                                | None     | Reuse run/install/doctor                      |

## Risks

| Risk                        | Likelihood | Mitigation                             |
| --------------------------- | ---------- | -------------------------------------- |
| jscpd writes `./report/`    | Med        | Temp `--output` + cleanup; test assert |
| `--format` name collision   | Med        | Script owns flag; never forward        |
| JSON key drift across jscpd | Med        | Mock v5 shape; optional smoke          |
| Review budget ~400 LOC      | Med        | `auto-chain` if needed                 |

## Rollback Plan

Delete `catalog/scripts/duplication/`, drop catalog entry, revert tests/docs/spec deltas. No `src/` or state migration; undo installed `.shitaku/scripts/duplication/`.

## Dependencies

- #144 CLOSED; patterns from `dead-code`/`complexity`; consumer-provided `jscpd` (not shipped)

## Success Criteria

- [ ] `shitaku run duplication` on Linux/macOS/Windows without an agent
- [ ] JSON/text clones (both locations) + percentage; over-threshold exits 1
- [ ] Catalog registration; no script-root npm bootstrap
- [ ] Clone + clean fixture tests; no leftover cwd `report/`
- [ ] Docs regen; `scripts-install` includes `duplication`

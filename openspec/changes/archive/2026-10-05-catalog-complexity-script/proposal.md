# Proposal: Catalog Complexity Script

## Intent

Ship first bundled catalog script `complexity` (#145) for cyclomatic/cognitive metrics via `shitaku run`, locking a stable JSON envelope for #148. #144 left scripts empty and deferred shared output.

## Scope

### In Scope

- `catalog/scripts/complexity/{index.mjs,script.json,eslint.config.mjs}`; register in `items.scripts`
- CLI: paths/globs; `--max-cyclomatic`/`--max-cognitive` (10/15); exit 0/1/2; JSON default + `--format text`
- Encode D1A–D4A (Approach); flip empty-scripts tests/docs/specs; regenerate catalog tables; soften CONTRIBUTING

### Out of Scope

- Hexagonal CLI/`shitaku run` changes (script-local preferred)
- #148 hotspots; cross-script envelope; type-aware lint beyond TS parse

## Capabilities

### New Capabilities

- `catalog-scripts-complexity`: CLI, thresholds, formats, ignore, JSON envelope, exit codes for `complexity`

### Modified Capabilities

- `scripts-install`: drop “Empty structure / no concrete scripts”; catalog MAY ship `complexity`

## Approach

Shipped ESLint flat config (`complexity` + `sonarjs/cognitive-complexity`); low rule max emits scores; `index.mjs` maps ESLint JSON → envelope and enforces CLI thresholds.

| ID  | Encoding                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D1A | Install tools into `…/scripts/complexity/node_modules`; run local `eslint` + shipped `-c`. Not multi `-p` alone for flat-config imports.      |
| D2A | Tools: `eslint`, `eslint-plugin-sonarjs`, `typescript-eslint`, `typescript`, `@eslint/js`. Document #145 two-tool deviation (TS flat config). |
| D3A | `.gitignore` via `includeIgnoreFile` + fixed ignores (`node_modules`, `.git`, …).                                                             |
| D4A | JSON: `schema`, `tool`, `functions[]` (`file`,`name`,`line`,`cyclomatic`,`cognitive`), worst-first. Exit 0/1/2 (ok/exceed/error).             |

## Affected Areas

| Area                                                            | Impact           | Description                                                  |
| --------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| `catalog/scripts/complexity/`, `catalog/catalog.json`           | New/Modified     | Script tree + `items.scripts`                                |
| `test/**`, docs, `openspec/specs/scripts-install`               | Modified/New     | Guards, fixtures, spawn tests, tables, empty-structure delta |
| Hexagonal `src/{domain,ports,application,adapters}` + `main.ts` | None (preferred) | Keep run/ProcessRunner; minimal tweak only if D1A requires   |

## Risks

| Risk                                      | Likelihood | Mitigation                                  |
| ----------------------------------------- | ---------- | ------------------------------------------- |
| Install-root import resolve fails         | Med        | Validate in design; escalate only if proven |
| Doctor warns library-only tools           | Med        | Document expected info warnings             |
| Cognitive join / anonymous names          | Med        | Spec stable `name` rules                    |
| >400 lines (`auto-chain`/stacked-to-main) | High       | Tasks forecast + slice                      |
| Incomplete empty-scripts flip             | Med        | Flip tests/specs/docs together              |

## Rollback Plan

Remove script tree + catalog entry; restore empty-scripts guards/specs/docs; delete fixtures/tests. No domain migration. Revert commit or stacked slice independently.

## Dependencies

- #144 on main; D1A–D4A confirmed (preproposal rev 3); #148 consumes D4A (out of scope)

## Success Criteria

- [ ] Fixtures exit 0 under thresholds, 1 when exceeded
- [ ] Default JSON matches D4A; `--format text` works
- [ ] `.js`/`.ts` parse with tools in script install root; D3A ignores applied
- [ ] Empty-scripts guards/docs/specs flipped; strict-TDD tests green

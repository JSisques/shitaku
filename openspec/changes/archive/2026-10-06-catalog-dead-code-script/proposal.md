# Proposal: Catalog Dead-Code Script

## Intent

Ship bundled `dead-code` (#146): run knip on the consumer project and emit a stable JSON envelope for unused files/exports/types/deps — **no** catalog npm deps (#144; opposite of complexity #145 bootstrap).

## Scope

### In Scope

- `catalog/scripts/dead-code/{index.mjs,script.json}`; register in `items.scripts`
- Knip via cwd `.bin` then `npx`; never script-root bootstrap; never `--fix`
- Envelope `shitaku.catalog.dead-code/v1`; `--format json|text`; `--include`; exit 0/1/2
- Fixtures (unused export/file/dependency) + spawn tests; update `bundled-catalog.test.ts`
- Docs regen; openspec install delta + new dead-code capability

### Out of Scope

- Complexity-style install-root bootstrap; wiring `resolveToolInvocation` into `runScript`
- Auto-fix; knip kinds beyond the six buckets; hexagonal `src/**` changes

## Capabilities

### New Capabilities

- `catalog-scripts-dead-code`: CLI, formats, include, envelope, exit, no-fix, knip config policy

### Modified Capabilities

- `scripts-install`: catalog ships `complexity` **and** `dead-code`

## Approach

**Approach 1 (confirmed):** thin adapter — spawn local/npx `knip --reporter json`; map issues → grouped `findings`; reject `--fix` (exit 2); consumer knip config or defaults.

Research: knip JSON folds unused deps + unusedDevDependencies under `dependencies` — classify into envelope buckets via `package.json`. Always emit six kind keys; sort file/name/line; default JSON stdout.

## Affected Areas

| Area                                                          | Impact       | Description             |
| ------------------------------------------------------------- | ------------ | ----------------------- |
| `catalog/scripts/dead-code/`, `catalog/catalog.json`          | New/Modified | Script + registration   |
| `test/.../dead-code*`, `bundled-catalog.test.ts`              | New/Modified | Fixtures, spawn, guards |
| README + website catalog pages                                | Modified     | Regen                   |
| `openspec/specs/scripts-install`, `catalog-scripts-dead-code` | Modified/New | Spec deltas             |
| Hexagonal `src/**` + `main.ts`                                | None         | PATH injection reused   |

## Risks

| Risk                          | Likelihood       | Mitigation                   |
| ----------------------------- | ---------------- | ---------------------------- |
| deps/devDeps share knip key   | High (confirmed) | Classify via package.json    |
| npx cold-start in CI          | Med              | Local knip in fixtures       |
| User `--fix`                  | Med              | Reject → exit 2              |
| Knip exit ≠ 0/1/2             | Med              | Own mapping; spawn/parse → 2 |
| Docs regen vs 400-line budget | Med              | Tasks forecast / chain       |

## Rollback Plan

Remove script tree + catalog entry; revert tests/docs/spec deltas. No domain migration; no leftover install-root `node_modules`.

## Dependencies

- #144/#145 on main; Approach 1 + CLI/envelope confirmed; research rev 1 (knip keys)

## Success Criteria

- [ ] Local knip or npx; no catalog npm deps
- [ ] Envelope + text + `--include`; exit 0/1/2; `--fix` rejected
- [ ] Fixtures for unused export/file/dependency; both scripts registered
- [ ] Docs regen; strict-TDD green

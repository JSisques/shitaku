# Design: Catalog Dead-Code Script

Ship bundled `dead-code` as a thin knip adapter under `catalog/scripts/dead-code/`. All logic lives in the script; hexagonal `src/**` and `runScript` stay unchanged (cwd `.bin` PATH injection reused). Opposite of complexity: **no** script-root npm bootstrap.

## Technical Approach

`index.mjs` parses CLI, rejects `--fix`, resolves `knip` (cwd `.bin` then `npx`), spawns `knip --reporter json` with consumer config/defaults, maps issues → envelope `shitaku.catalog.dead-code/v1` (six kind keys), applies `--include`, prints JSON|text, exits 0/1/2 by own policy. Register in `items.scripts`; flip bundled-catalog; fixtures + spawn RED; regen docs. Aligns with proposal Approach 1 and `catalog-scripts-dead-code` / `scripts-install` deltas.

## Architecture Decisions

| Decision        | Options                                                       | Tradeoff                                                       | Choice                                                                                         |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Tool strategy   | Script-root bootstrap vs local/npx                            | Bootstrap violates #144/#146                                   | **cwd `.bin` then `npx knip`**; no catalog npm deps                                            |
| Resolve sharing | Wire `resolveToolInvocation` into `runScript` vs script-local | Hexagonal change out of scope                                  | **Duplicate probe rules in script** (same as domain helper); no `src` edits                    |
| Envelope        | Free-form vs locked six kinds                                 | #146 consumers need stable keys                                | **`shitaku.catalog.dead-code/v1`** + always-present six keys                                   |
| Deps split      | Trust knip keys vs package.json                               | Knip folds unused deps+devDeps under `dependencies` (research) | **Classify via consumer `package.json`**                                                       |
| Ambiguous name  | Drop vs prod bucket                                           | Rare (optionalPeer etc.)                                       | **`findings.dependencies`**                                                                    |
| Peer/optional   | Dev vs prod                                                   | Spec: production                                               | **`#dependencies` / peer / optional → `dependencies`**; `#devDependencies` → `devDependencies` |
| `--fix`         | Strip silently vs reject                                      | Silent strip hides intent                                      | **Exit 2; never spawn with `--fix`**                                                           |
| Config          | Ship knip config vs consumer                                  | Complexity ships eslint; knip must use project                 | **Consumer `knip.json` / `knip.config.*` / pkg field; else knip defaults**                     |
| Exit codes      | Passthrough knip vs map                                       | Knip ≠ 0/1/2 contract                                          | **Own map**: 0 none / 1 any included finding / 2 tool·parse·CLI·IO                             |
| Include         | Envelope-only vs pass knip `--include`                        | Knip collapses deps/devDeps                                    | **Pass knip `--include` when possible; always filter envelope; exit 1 counts included only**   |

**ADR-1:** Domain/application unchanged — spawn/map/classify/CLI only in catalog script.

**ADR-2:** `unlisted` from knip `unlisted` only; never reclassify through package.json.

## Data Flow

```
shitaku run dead-code → ProcessRunner(index.mjs, cwd=project, PATH+=cwd/.bin)
  → parseArgs (reject --fix / bad --format / unknown --include → 2)
  → resolve knip: cwd/node_modules/.bin/knip[.cmd] else npx knip
  → spawnSync(knip, [--reporter, json, …include], shell:false, cwd=project)
  → parse issues → classify deps via package.json → sort → filter include
  → JSON|text stdout → exit 0|1|2
```

## File Changes

| File                                                | Action | Description                                      |
| --------------------------------------------------- | ------ | ------------------------------------------------ |
| `catalog/scripts/dead-code/{index.mjs,script.json}` | Create | Adapter + metadata `tools:["knip"]`              |
| `catalog/catalog.json`                              | Modify | `items.scripts` include `dead-code`              |
| `test/adapters/catalog/bundled-catalog.test.ts`     | Modify | Expect `complexity` + `dead-code`                |
| `test/fixtures/dead-code/**`                        | Create | Unused export / file / dependency (+ clean)      |
| `test/catalog/scripts/dead-code.test.ts`            | Create | Spawn RED: exit, envelope, text, include, no-fix |
| `README.md`, `website/.../catalog/**`               | Modify | `docs:catalog` / `docs:website-catalog`          |
| `openspec/specs/**`                                 | Modify | Via archive merge later                          |

**Unchanged:** `src/**`, `run-script.ts`, `scripts-run.ts`, ProcessRunner, complexity tree.

## Interfaces / Contracts

```json
{
  "schema": "shitaku.catalog.dead-code/v1",
  "tool": "dead-code",
  "findings": {
    "files": [],
    "exports": [],
    "types": [],
    "dependencies": [],
    "devDependencies": [],
    "unlisted": []
  }
}
```

Finding: `{ file, name, line?, col? }`. Sort per kind: `file`, `name`, `line`. CLI: `--format json|text` (default json), `--include <kinds>` (comma/repeat; tokens = six keys). Text: kind/file/name rows (TSV or sectioned).

## Testing Strategy

| Layer       | What                             | Approach                                                                         |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Unit        | Classify/sort/include/arg reject | Pure helpers in script or extracted testable fns                                 |
| Integration | Spawn on fixtures                | Exit 0/1/2; envelope shape; text; include; consumer config; local knip preferred |
| Guards      | Catalog registration             | Flip bundled-catalog; install-root has no nm bootstrap                           |
| Docs        | Tables                           | `docs:catalog:check`                                                             |

Strict TDD: RED spawn before body. Fixtures install local knip to avoid npx flakiness.

## Threat Matrix

| Boundary                 | Applicability               | Design response                                                                                                       | Planned RED tests                                                                          |
| ------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Documentation-like paths | N/A — no exec-file classify | —                                                                                                                     | —                                                                                          |
| Git / commit / push / PR | N/A — no VCS/PR automation  | —                                                                                                                     | —                                                                                          |
| Subprocess (knip/npx)    | **Applicable**              | `shell:false`; argv built by script only; never forward `--fix`; cwd=consumer project; no consumer package.json write | `--fix` → exit 2 + files unchanged; spawn/parse fail → exit 2; no mutation of fixture tree |

## Migration / Rollout

No migration. Forecast review budget; prefer `auto-chain` slices if docs regen pushes authored diff near 400:

1. Catalog tree + registration + bundled-catalog
2. Fixtures + spawn behavior (envelope/include/fix/exit)
3. Docs regen

## Open Questions

- [x] Approach 1 (local/npx) confirmed
- [x] Envelope + six kinds confirmed
- [x] package.json classification (research rev 1)
- [x] No hexagonal `src` changes
- [x] `--fix` → exit 2
- [x] Ambiguous unused name → `dependencies`

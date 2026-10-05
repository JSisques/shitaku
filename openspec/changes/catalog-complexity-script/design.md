# Design: Catalog Complexity Script

Ship bundled `complexity` under `catalog/scripts/complexity/`. Logic lives in the script (flat config + `index.mjs`); `shitaku run` stays spawn-passthrough. Proven escape hatch: ignore runtime `node_modules` when listing/hashing **script** trees so D1A does not break status/undo.

## Technical Approach

Catalog ships `index.mjs`, `script.json`, `eslint.config.mjs`, `package.json` (+ lockfile). First run bootstraps deps into `…/scripts/complexity/node_modules`, runs local `eslint -c` shipped config `--format json`, maps messages to D4A envelope, enforces CLI thresholds (exit 0/1/2). Flip empty-scripts guards/docs/specs; regen catalog tables. Aligns with proposal D1A–D4A and delta specs.

## Architecture Decisions

| Decision    | Options                                      | Tradeoff                             | Choice                                                                       |
| ----------- | -------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| D1A resolve | Multi `-p` vs install-root nm + local eslint | PATH ≠ ESM import (research)         | **Install-root + local bin**                                                 |
| Bootstrap   | Init hook / self-bootstrap / vendor nm       | Hook=hexagonal; vendor=size/symlinks | **Self-bootstrap** via shipped `package.json`                                |
| Tree vs nm  | Walk as-is vs ignore script `node_modules/`  | nm blows limits/symlinks             | **ADR-2: ignore + rm on undo/uninstall**                                     |
| D2A tools   | Issue 2-tool vs full set                     | TS needs parser                      | **eslint, eslint-plugin-sonarjs, typescript-eslint, typescript, @eslint/js** |
| D3A ignore  | Defaults vs gitignore wire                   | Defaults ≠ `.gitignore`              | **`includeIgnoreFile` + fixed ignores**                                      |
| D4A JSON    | Free-form vs locked                          | #148 consumes                        | **`schema`, `tool`, `functions[]` worst-first**                              |
| Doctor      | Strip tools vs declare five                  | Doctor checks cwd `.bin` only        | **Declare five; expect `info` for binless**                                  |
| Run layer   | PATH rewrite vs script-local                 | Prefer script-local                  | **`import.meta.url` → install-root eslint**; no ProcessRunner change         |

**ADR-1:** Domain stays pure — bootstrap/spawn/map/thresholds in catalog script only.

**ADR-2:** Filter top-level `node_modules/` in script present walks; recursive delete on undo/uninstall. Ship lockfile so only nm is runtime-generated. Escalate to NODE_PATH/config rewrite **only if** local install still fails plugin `import`.

## Data Flow

```
shitaku run complexity → ProcessRunner(index.mjs, cwd=project)
  → ensureDeps(scriptRoot) → npm → scriptRoot/node_modules
  → local eslint -c shipped --format json
  → join/sort → JSON|text → exit 0/1/2
```

| Rule                           | Config                  | Join                                        |
| ------------------------------ | ----------------------- | ------------------------------------------- |
| `complexity`                   | `max: 0`                | Key `file`+`line`; name from message        |
| `sonarjs/cognitive-complexity` | `0` (or `-1` if needed) | Merge same key; missing cognitive → `0`     |
| Anonymous                      | —                       | Non-empty stable name; else `"<anonymous>"` |

Sort: `max(cyclomatic,cognitive)` desc, then file, line.

## File Changes

| File                                                                                                  | Action | Description                     |
| ----------------------------------------------------------------------------------------------------- | ------ | ------------------------------- |
| `catalog/scripts/complexity/{index.mjs,script.json,eslint.config.mjs,package.json,package-lock.json}` | Create | Script + D2A deps + lock        |
| `catalog/catalog.json`                                                                                | Modify | `items.scripts: ["complexity"]` |
| `src/adapters/fs/walk.ts` and/or `src/application/skill-tree.ts`                                      | Modify | ADR-2 skip nm for scripts       |
| `src/application/undo-install.ts`, `uninstall-item.ts`                                                | Modify | Remove script-root nm           |
| `test/adapters/catalog/bundled-catalog.test.ts`                                                       | Modify | Expect complexity               |
| `test/fixtures/complexity/**`, `test/catalog/scripts/complexity.test.ts`                              | Create | Fixtures + spawn RED            |
| `test/adapters/fs/walk.test.ts` (+ undo)                                                              | Modify | ADR-2 coverage                  |
| `README.md`, `website/.../catalog/**`, `CONTRIBUTING.md`                                              | Modify | Regen; soften no-scripts prose  |
| `openspec/specs/scripts-install/spec.md`                                                              | Modify | Via delta (empty → complexity)  |

Unchanged preferred: `run-script.ts`, `ProcessRunner`, domain schemas.

## Interfaces / Contracts

```json
{
  "schema": "shitaku.catalog.complexity/v1",
  "tool": "complexity",
  "functions": [{ "file": "src/a.ts", "name": "foo", "line": 12, "cyclomatic": 11, "cognitive": 8 }]
}
```

CLI: paths/globs; `--max-cyclomatic` 10; `--max-cognitive` 15; `--format json|text`. Exit 0/1/2. `tools` lists all five D2A names.

## Testing Strategy

| Layer          | What                          | Approach                            |
| -------------- | ----------------------------- | ----------------------------------- |
| Unit           | Parse/join/sort; bad args     | Pure helpers / script unit          |
| Integration    | Spawn `index.mjs` on fixtures | Exit + JSON/text + ignore/TS        |
| Guards / ADR-2 | Catalog + nm walk/undo        | Flip bundled-catalog; walk/undo RED |
| Docs           | Tables                        | `docs:catalog:check`                |

Strict TDD: RED spawn before body.

## Threat Matrix

| Boundary                 | Applicability               | Design response                                                      | Planned RED tests                         |
| ------------------------ | --------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Documentation-like paths | N/A — no exec-file classify | —                                                                    | —                                         |
| Git / commit / push / PR | N/A — no VCS/PR automation  | —                                                                    | —                                         |
| Subprocess (eslint/npm)  | **Applicable**              | `shell:false`; install cwd=scriptRoot; no consumer package.json edit | Tool fail → exit 2; no consumer pkg write |

## Migration / Rollout

No migration. `auto-chain` / stacked-to-main slices (tasks forecast):

1. Foundation: catalog tree + ADR-2 + empty-scripts flip
2. Behavior: fixtures + spawn (thresholds/formats/ignore/TS)
3. Docs: README/website + CONTRIBUTING

## Open Questions

- [x] D1A–D4A confirmed
- [ ] Cognitive threshold `0` vs `-1` — decide in apply via emission fixture
- [ ] `includeIgnoreFile` import (`eslint/config` vs `@eslint/compat`) — match eslint major at apply

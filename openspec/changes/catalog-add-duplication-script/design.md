# Design: Catalog Duplication Script

## Technical Approach

Add a dead-code-style catalog script `duplication` that shells to consumer-provided `jscpd`, parses a **temporary** JSON report, emits `shitaku.catalog.duplication/v1`, and maps threshold outcomes to exit 0/1/2. No hexagonal `src/` changes; reuse `run` / install / doctor as-is. Specs: `catalog-scripts-duplication`, `scripts-install` (bundled list).

## Architecture Decisions

| Decision          | Options / tradeoff                                             | Choice                                                                                                                |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Tool bootstrap    | Script-root npm (complexity) vs local `.bin`/`npx` (dead-code) | **dead-code style**: `tools: ["jscpd"]`; no catalog `package.json` / bootstrap                                        |
| Resolve path      | Import domain `resolveToolInvocation` vs script-local mirror   | **Script-local mirror** of `localBinRelativePaths` + `.bin` then `npx jscpd` (same as dead-code; `src/` out of scope) |
| Report I/O        | knip stdout JSON vs jscpd file reporters                       | **`--reporters json` + temp `--output`**; parse then delete; never leave cwd `report/`                                |
| Format flag       | Forward to jscpd vs own                                        | **Script owns `--format json\|text`**; never pass shitaku `--format` to jscpd (jscpd `--format` = languages)          |
| Threshold / exits | Pass-through jscpd exit vs script map                          | **Script-owned**: parse report → compare `percentage` to `--threshold` → 0/1; tool/parse/CLI → 2                      |
| Baseline          | jscpd `--baseline`                                             | **Out of scope** — reject if passed                                                                                   |
| Defaults          | ignore / gitignore                                             | **gitignore on**; ignore `node_modules`, build dirs (`dist`/`build`/`coverage`), `test/fixtures`                      |

## Data Flow

```
shitaku run duplication [args]
        │
        ▼
catalog/scripts/duplication/index.mjs
  parseArgs → resolveJscpd(cwd) → mkdtemp
  spawn jscpd: --reporters json --output <tmp>
               --min-lines/--min-tokens/--threshold
               --gitignore --ignore <defaults>
        │
        ▼
  read <tmp>/jscpd-report.json → map clones → envelope
  rm tmp (finally) → stdout JSON|text → exit 0|1|2
```

## File Changes

| File                                            | Action | Description                                            |
| ----------------------------------------------- | ------ | ------------------------------------------------------ |
| `catalog/scripts/duplication/index.mjs`         | Create | Plain ESM adapter (resolve, spawn, parse, print, exit) |
| `catalog/scripts/duplication/script.json`       | Create | Metadata: tools, args, exitCodes                       |
| `catalog/catalog.json`                          | Modify | Append `duplication` after `dead-code`                 |
| `test/catalog/scripts/duplication.test.ts`      | Create | Mock jscpd + fixtures; exits; no leftover `report/`    |
| `test/fixtures/duplication/{clone,clean}/`      | Create | Known clone + clean trees                              |
| `test/adapters/catalog/bundled-catalog.test.ts` | Modify | Expect three scripts                                   |
| `openspec/specs/scripts-install/spec.md`        | Modify | Merge bundled-list delta at archive                    |
| README / website catalog docs                   | Modify | Regen after catalog change                             |
| `src/**`                                        | None   | Locked                                                 |

## Interfaces / Contracts

```ts
// stdout JSON (default)
{
  schema: 'shitaku.catalog.duplication/v1',
  tool: 'duplication',
  percentage: number,       // overall duplication % from jscpd
  threshold: number,        // applied CLI threshold (default 0)
  clones: Array<{
    firstFile: string; firstStart: number; firstEnd: number;
    secondFile: string; secondStart: number; secondEnd: number;
    lines: number;
    tokens: number;
  }>
}
```

CLI: `--threshold <n>` (default `0`), `--min-lines <n>`, `--min-tokens <n>` (jscpd defaults when omitted), `--format json|text`. Invalid/unsupported/`--baseline` → exit 2.

Mock jscpd in tests: accept `--reporters json` + `--output <dir>`, write v5-shaped `jscpd-report.json` there; assert argv never contains language `--format` from shitaku.

## Testing Strategy

| Layer          | What                                                  | Approach                                                              |
| -------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Unit/spawn     | CLI parse, envelope, exits 0/1/2, format text vs JSON | Vitest spawn `index.mjs` + mock `.bin/jscpd` (dead-code pattern)      |
| Contract       | Local bin vs fake `npx`; no script-root bootstrap     | Mock PATH / inspect catalog tree                                      |
| Lifecycle      | Temp cleanup                                          | After run, assert no cwd `report/`; mock writes only under `--output` |
| Ignore         | Defaults skip `node_modules`/build                    | Mock report omits ignored paths when only there                       |
| Optional smoke | Real `jscpd` once                                     | Install in fixture copy (non-default CI path OK)                      |
| Catalog        | Registration                                          | `bundled-catalog.test.ts`                                             |

Strict TDD: RED tests before `index.mjs` body.

## Threat Matrix

Subprocess boundary exists; VCS/PR rows from `threat-matrix.md` do not apply.

| Boundary                 | Applicability                          | Design response | Planned RED tests |
| ------------------------ | -------------------------------------- | --------------- | ----------------- |
| Documentation-like paths | N/A: no executable-file classification | —               | —                 |
| Git repository selection | N/A: cwd = `process.cwd()` only        | —               | —                 |
| Commit state             | N/A: no commits                        | —               | —                 |
| Push state               | N/A: no push                           | —               | —                 |
| PR commands              | N/A: no PR automation                  | —               | —                 |

Process-contract RED (carry to tasks): reject `--baseline`; never forward shitaku `--format` to jscpd; no leftover `report/`; map tool/parse failures to exit 2 without mutating project files.

## Migration / Rollout

No migration. Install via existing init/scripts path; consumers supply `jscpd`. Rollback = delete script tree + catalog entry + tests/docs.

## Open Questions

- [x] Default threshold: **0** (any reported percentage > 0 → exit 1)
- [x] Exact jscpd JSON filename under `--output`: pin in apply against installed jscpd (expect `jscpd-report.json`); mock writes that name

# Exploration: catalog-add-duplication-script (issue #147)

**Verdict:** Ship `catalog/scripts/duplication/` as plain ESM that spawns **project-local `jscpd` or `npx jscpd`** (no script-root `package.json` / bootstrap — same tool policy as `dead-code`). Read jscpd’s `json` reporter from a **temp `--output` dir** (never leave `report/` in the consumer cwd), normalize into a versioned envelope with clones + overall percentage, enforce `--threshold` / `--min-lines` / `--min-tokens`, and map exit 0/1/2. Baseline mode is out of scope. Ready for proposal.

## Quick path

1. Add `catalog/scripts/duplication/{index.mjs,script.json}` only; list `duplication` in `items.scripts` (order with existing: `complexity`, `dead-code`, `duplication`).
2. Script resolves `jscpd` via cwd `node_modules/.bin` then `npx jscpd`; never ships npm deps.
3. Spawn with `--reporters json`, temp `--output`, `--gitignore` (default on), default `--ignore` for `node_modules`, build output, and test fixtures; map `--threshold` / `--min-lines` / `--min-tokens`.
4. Parse JSON report → envelope `shitaku.catalog.duplication/v1`; `--format text`; exit 0 under threshold / 1 above / 2 errors (do not pass jscpd exit through unchanged).
5. Extend `bundled-catalog.test.ts` + `scripts-install` bundled-scripts requirement; add fixtures + spawn tests (clone present / clean); regenerate README/website catalog docs.

## Current State

### Scripts infrastructure (post #144 / #145 / #146)

| Concern              | Status                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog layout       | `catalog/scripts/<name>/index.mjs` + `script.json`; `items.scripts: ["complexity", "dead-code"]`                                                                       |
| Metadata             | Zod `ScriptMetaSchema`: `name`, `description`, `tools[]`, optional `args`/`output`/`exitCodes`                                                                         |
| Install roots        | project `./.shitaku/scripts/<name>/`; user `stateDir()/scripts/<name>/`                                                                                                |
| Run                  | `runScript` spawns `execPath` + installed `index.mjs`; prepends **cwd** `node_modules/.bin` to `PATH`; exit passthrough                                                |
| Domain tool helper   | `resolveToolInvocation(tool)` → local-bin then `{ kind:'npx', args:[tool] }`; **not called by `runScript`** — scripts that need it duplicate the probe (see dead-code) |
| Doctor               | Warns when installed script’s `tools[]` missing from local `.bin`; non-fatal                                                                                           |
| Complexity reference | Self-bootstraps eslint into **script-root** `node_modules` via shipped `package.json` + lockfile                                                                       |
| Dead-code reference  | **No** script-root npm deps; resolves `knip` from cwd `.bin` or `npx`; maps JSON reporter → envelope; exit 0/1/2                                                       |
| Docs                 | CONTRIBUTING “Add a script”; `pnpm run docs:catalog` / `docs:website-catalog` regenerate README + website pages                                                        |

### Issue #147 (authoritative)

- Plain ESM at `catalog/scripts/duplication/index.mjs`; `shitaku run duplication [args]`.
- `jscpd` required tool; local project install else `npx` (per #144: **bundle no npm dependencies**).
- jscpd `json` reporter → normalize to shared catalog-script output style: each clone with both locations (file + line range), size in lines/tokens, overall duplication percentage.
- Configurable `--threshold`, `--min-lines`, `--min-tokens`; human-readable `--format text`.
- Exit `0` under threshold, `1` above, `2` on errors.
- Respect `.gitignore`; ignore build output, `node_modules`, and test fixtures by default.
- Register in `catalog.json` with metadata; tests: fixture with known clone + fixture without clones.
- **Baseline mode OUT OF SCOPE** (follow-up). Parent #144 is CLOSED — unblocked.
- npm note (2026-10-04): `jscpd` 5.4.0 with `--threshold`, reporters including `json`/`sarif`/`codeclimate`, and `--baseline` (defer).

### Sibling pattern matrix

| Reuse from dead-code / complexity UX                                              | Do **not** reuse from complexity                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Plain `index.mjs` + `script.json`; arg parse / `--format json\|text` / exit 0/1/2 | `package.json` / lockfile / `ensureDeps()` bootstrap into script-root |
| Versioned `schema` + `tool` envelope                                              | Shipped ESLint config / `NODE_PATH` / install-root `.bin`             |
| Script-local `localBinRelativePaths` + npx fallback                               | Declaring many packages in `tools[]` for install-root resolution      |
| Mock `.bin` tool in tests + optional real-tool smoke                              | Consumer-config “ship override” — jscpd uses ignore flags + gitignore |
| Catalog registration + bundled-catalog + docs regen                               | —                                                                     |

### jscpd CLI / JSON reporter (docs + issue)

| Flag / behavior                  | Notes for this script                                                                                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--reporters json`               | Writes `jscpd-report.json` under `--output` (default `./report/`) — **not** knip-style stdout JSON                                                                                                                         |
| `--output <dir>`                 | Must point at a **temp directory** created by the script; delete after read so consumer cwd is not mutated                                                                                                                 |
| `--threshold <percent>`          | Fail when duplication % ≥ threshold; map to script exit 1 (also enforce after parse so exit policy is owned by shitaku)                                                                                                    |
| `--min-lines` / `--min-tokens`   | Defaults in jscpd: 5 / 50; pass through when CLI sets them                                                                                                                                                                 |
| `--gitignore` / `--no-gitignore` | Respect `.gitignore` by default (on)                                                                                                                                                                                       |
| `--ignore` globs                 | Pass defaults for `**/node_modules/**`, build dirs (`**/dist/**`, `**/build/**`, `.next`, coverage, etc.), and test fixtures (`**/fixtures/**`, `**/__fixtures__/**` — finalize in design)                                 |
| `--format` (jscpd)               | Means **source language formats** — **collides** with shitaku `--format json\|text`. Script MUST own `--format` for output and MUST NOT forward it to jscpd                                                                |
| `--baseline`                     | Out of scope                                                                                                                                                                                                               |
| JSON shape (current docs)        | `{ duplicates: [{ format, lines, tokens, firstFile: { name, start, end }, secondFile: {...} }], statistics: { total: { percentage, ... } } }` — research should confirm v5 field names (`statistics` vs older `statistic`) |

## Affected Areas

| Path                                                              | Why                                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `catalog/scripts/duplication/index.mjs`                           | New entry: resolve/spawn jscpd, temp output, normalize, CLI                            |
| `catalog/scripts/duplication/script.json`                         | Metadata: `tools: ["jscpd"]`, args, output, exitCodes                                  |
| `catalog/catalog.json`                                            | Add `"duplication"` to `items.scripts`                                                 |
| `test/adapters/catalog/bundled-catalog.test.ts`                   | Expect three scripts; file list for duplication tree (`index.mjs`, `script.json` only) |
| `test/fixtures/duplication/` (new)                                | Project with known clone + clean project                                               |
| `test/catalog/scripts/duplication.test.ts` (new)                  | Spawn: exit codes, JSON shape, text, threshold, ignores, no cwd mutation               |
| `openspec/specs/scripts-install/spec.md`                          | Extend “Bundled catalog scripts” to include `duplication`                              |
| `openspec/specs/catalog-scripts-duplication/` (new, later)        | CLI/envelope/exit/ignore/tool-resolution                                               |
| `README.md` + `website/src/content/docs/{en,es}/catalog/scripts/` | Regenerated via `docs:catalog` / `docs:website-catalog`                                |

**Not affected (reuse as-is):** hexagonal layers; `runScript` PATH injection; `resolveToolInvocation` domain helper (optional mirror inside script only); complexity/dead-code script trees.

## Approaches

### 1. Project-local / npx jscpd (issue #147 / #144 / dead-code pattern) — **recommended**

Script probes `cwd/node_modules/.bin/jscpd` (and `.cmd` on win32), else `npx jscpd`; runs with `--reporters json` and a temp `--output`; reads report file; normalizes; never ships catalog npm deps; never leaves report artifacts in cwd.

- **Pros:** Matches #147 and #144 tool policy; doctor/`tools:["jscpd"]` fit; lean install tree; mirrors proven dead-code adapter; PATH injection from `runScript` helps local bin.
- **Cons:** First run without local jscpd hits network via npx; JSON-on-disk requires careful temp lifecycle; CLI `--format` name collision with jscpd; possible JSON key drift across jscpd majors.
- **Effort:** Low–Medium

### 2. Complexity-style bootstrap (ship jscpd in script-root)

Ship `package.json` + lockfile; `npm ci` into `.shitaku/scripts/duplication/node_modules`; pin jscpd.

- **Pros:** Reproducible version; offline after bootstrap.
- **Cons:** **Violates #147 / #144** (“bundles no npm dependencies”); larger catalog/tarball; contradicts dead-code precedent and parent strategy.
- **Effort:** Medium — **reject**

### 3. Domain `resolveToolInvocation` wired into `runScript`

Change application layer to rewrite spawns for declared tools.

- **Pros:** Shared resolution for all scripts.
- **Cons:** Out of scope for a catalog script; `runScript` already PATH-prepends; dead-code already solved this in-script.
- **Effort:** Medium — **defer**

### Recommendation

**Approach 1.** Implement duplication as a thin jscpd adapter with **no** script-root dependencies. Mirror dead-code’s tool strategy and complexity/dead-code UX (JSON default, `--format text`, exit 0/1/2). Own threshold gating after parsing `statistics.total.percentage` (still pass `--threshold` through to jscpd when set). Use a unique temp output directory per run and always clean it up.

## Proposed JSON envelope

```json
{
  "schema": "shitaku.catalog.duplication/v1",
  "tool": "duplication",
  "percentage": 5.0,
  "threshold": 0,
  "clones": [
    {
      "a": { "file": "src/utils.js", "startLine": 10, "endLine": 20 },
      "b": { "file": "src/helpers.js", "startLine": 5, "endLine": 15 },
      "lines": 10,
      "tokens": 120
    }
  ]
}
```

Notes for proposal/design:

- Always emit `clones` (empty array OK), `percentage`, and the effective `threshold`.
- Sort clones by `lines` desc, then `a.file`, then `a.startLine`.
- Default stdout JSON; `--format text` → human rows (file ranges + sizes + summary percentage); unsupported `--format` → exit 2.
- Default `--threshold`: propose `0` (any positive duplication percentage fails) unless research shows jscpd treats equality differently — lock in design. Document that “under threshold” means `percentage < threshold` (or `<=` if jscpd’s semantics differ; design must match jscpd or document override).
- Default ignores applied even when consumer has no `.jscpd.json`; consumer jscpd config MAY still apply via jscpd’s own discovery — design should state whether catalog passes explicit ignores always (recommended) or only when no consumer config.
- Text format: one summary line for percentage + one line per clone with both locations.

## Risks

- **JSON reporter writes files** — without a temp `--output`, jscpd creates `./report/` in the consumer project (mutation). Must use temp dir + cleanup; tests must assert no leftover `report/` under cwd.
- **`--format` name collision** — shitaku output format vs jscpd language `--format`; script must intercept and never forward.
- **jscpd version / JSON key drift** — issue cites 5.x; older docs show `statistic` vs `statistics`, and richer `startLoc` shapes. Research or a pinned smoke install should lock the mapper; tests should mock the expected v5 shape.
- **npx cold-start / network** — CI without jscpd-in-project may be slow or flaky; prefer mock `.bin` in unit tests + optional real jscpd smoke (same as dead-code).
- **Exit-code mapping** — jscpd’s native exit (threshold reporter) must not be passed through blindly; spawn/parse failures → 2; under/over → 0/1 from script policy.
- **Ignore defaults vs fixtures** — default ignore of `**/fixtures/**` must not break tests that analyze fixture copies as cwd roots (fixtures become the project root, not a nested `fixtures/` path — OK if copy to temp).
- **bundled-catalog hard asserts** — currently expects exactly `['complexity', 'dead-code']`; must update for three scripts.
- **Review budget** — script + tests + docs regen may approach ~400 LOC; preflight `delivery_strategy=auto-chain` — plan chained PRs if needed (e.g. script+tests then docs/spec merge).

## Ready for Proposal

**Yes.** Orchestrator should proceed to `sdd-propose`. Optional short `sdd-research` only if locking jscpd 5.x JSON field names / threshold comparison (`>` vs `>=`) before the envelope is frozen; otherwise design can pin via a real-tool smoke like dead-code did for knip.

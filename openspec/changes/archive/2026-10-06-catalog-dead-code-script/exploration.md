# Exploration: catalog-dead-code-script (issue #146)

**Verdict:** Ship `catalog/scripts/dead-code/` as plain ESM that spawns **project-local `knip` or `npx knip`** (no script-root `package.json` / bootstrap). Normalize `--reporter json` into a versioned envelope grouped by kind. Reuse complexity’s CLI/exit/format patterns; **do not** reuse its install-root tool strategy. Ready for proposal.

## Quick path

1. Add `catalog/scripts/dead-code/{index.mjs,script.json}` only; list `dead-code` in `items.scripts`.
2. Script resolves `knip` via cwd `node_modules/.bin` then `npx knip`; never ships npm deps; never passes `--fix`.
3. Parse knip JSON → envelope `shitaku.catalog.dead-code/v1`; `--format text`; `--include` kinds filter; exit 0/1/2.
4. Extend `bundled-catalog.test.ts`; add fixtures + spawn tests (unused export, unused file, unused dependency).
5. Regenerate README/website catalog docs (`docs:catalog`, `docs:website-catalog`).

## Current State

### Scripts infrastructure (post #144 / #145)

| Concern              | Status                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Catalog layout       | `catalog/scripts/<name>/index.mjs` + `script.json`; `items.scripts: ["complexity"]`                                                 |
| Metadata             | Zod `ScriptMetaSchema`: `name`, `description`, `tools[]`, optional `args`/`output`/`exitCodes`                                      |
| Install roots        | project `./.shitaku/scripts/<name>/`; user `stateDir()/scripts/<name>/`                                                             |
| Run                  | `runScript` spawns `execPath` + installed `index.mjs`; prepends **cwd** `node_modules/.bin` to `PATH`; exit passthrough             |
| Domain tool helper   | `resolveToolInvocation(tool)` → local-bin then `{ kind:'npx', args:[tool] }`; **tested with `knip`**; **not called by `runScript`** |
| Doctor               | Warns when installed script’s `tools[]` missing from local `.bin`; non-fatal                                                        |
| Complexity reference | Self-bootstraps eslint into **script-root** `node_modules` via shipped `package.json` + lockfile; uses shipped flat config          |
| Docs                 | CONTRIBUTING “Add a script”; `pnpm run docs:catalog` / `docs:website-catalog` regenerate README + website pages                     |

### Issue #146 (authoritative)

- Plain ESM; `shitaku run dead-code [args]`.
- `knip` required tool; local project install else `npx`.
- Per #144: **bundle no npm dependencies** (explicit contrast with complexity #145).
- Knip `--reporter json` → normalize findings by kind: `files`, `exports`, `types`, `dependencies`, `devDependencies`, `unlisted`.
- `--format text`; exit `0` none / `1` findings / `2` errors; `--include` kinds filter.
- Use project knip config when present; else knip defaults. **Never delete / no `--fix`.**
- Tests: fixture with unused export, unused file, unused dependency.

### Knip JSON reporter (context7 `/websites/knip_dev`)

Top-level `{ "issues": [ { "file": "...", "<issueType>": [ { "name", "line?", "col?", "pos?" } ] } ] }`.

Issue-type keys include `files`, `exports`, `types`, `dependencies`, `unlisted`, plus others (`binaries`, `duplicates`, …). CLI: `--include files,exports` (comma or repeated). Knip supports `--fix`; script must never pass it. Config: project `knip.json` / `knip.config.*` auto-detected; else defaults + plugins.

**Gap:** docs say unused **devDependencies** share the `dependencies` reporter key unless rules split them. Envelope still needs a `devDependencies` bucket per #146 — proposal/research must confirm whether JSON emits a distinct `devDependencies` array or whether the script must classify against `package.json`.

### Complexity: reuse vs not

| Reuse                                                                             | Do **not** reuse                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Plain `index.mjs` + `script.json`; arg parse / `--format json\|text` / exit 0/1/2 | `package.json` / lockfile / `ensureDeps()` bootstrap into script-root |
| Versioned schema string + `tool` field envelope pattern                           | Shipped ESLint config / `NODE_PATH` / install-root `.bin`             |
| Catalog registration + bundled-catalog expectations + spawn tests                 | Declaring many packages in `tools[]` for install-root resolution      |
| Docs regenerate flow                                                              | “Ignore via shipped config” — knip uses **consumer** config           |

## Affected Areas

| Path                                                      | Why                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `catalog/scripts/dead-code/index.mjs`                     | New entry: spawn knip, normalize, CLI                                  |
| `catalog/scripts/dead-code/script.json`                   | Metadata: `tools: ["knip"]`, args, output, exitCodes                   |
| `catalog/catalog.json`                                    | Add `"dead-code"` to `items.scripts`                                   |
| `test/adapters/catalog/bundled-catalog.test.ts`           | Expect both `complexity` and `dead-code`; file list for dead-code tree |
| `test/fixtures/dead-code/` (new)                          | Unused export / file / dependency project fixture(s)                   |
| `test/catalog/scripts/dead-code.test.ts` (new)            | Spawn: exit codes, JSON shape, text, `--include`, no mutation          |
| `README.md` + `website/src/content/docs/{en,es}/catalog/` | Regenerated via `docs:catalog` / `docs:website-catalog`                |
| `openspec/specs/scripts-install`                          | Extend “Bundled complexity script” (or sibling) to list `dead-code`    |
| `openspec/specs/catalog-scripts-dead-code/` (new, later)  | CLI/envelope/exit/no-fix/config policy                                 |
| Website overview prose                                    | Mentions only `complexity` today — regenerator or hand tweak           |

**Not affected (reuse as-is):** hexagonal layers; `runScript` PATH injection; `resolveToolInvocation` (optional copy of logic inside script, not a runtime API change unless design chooses to share).

## Approaches

### 1. Project-local / npx knip (issue #146 / #144) — **recommended**

Script probes `cwd/node_modules/.bin/knip` (and `.cmd` on win32), else `npx knip`; runs with `--reporter json`; never `--fix`. No catalog npm deps.

- **Pros:** Matches #146 and #144 tool policy; doctor/`tools:["knip"]` already fit; lean install tree; uses consumer knip config; PATH injection from `runScript` helps local bin.
- **Cons:** First run without local knip hits network via npx; version drift across consumers; must normalize knip’s per-file JSON into grouped kinds; `devDependencies` split may need extra logic.
- **Effort:** Low–Medium

### 2. Complexity-style bootstrap (ship knip in script-root)

Ship `package.json` + lockfile; `npm ci` into `.shitaku/scripts/dead-code/node_modules`; pin knip version.

- **Pros:** Reproducible knip version; offline after first bootstrap; mirrors complexity.
- **Cons:** **Violates #146 / #144** (“bundles no npm dependencies”); larger catalog/tarball; contradicts parent issue strategy; doctor semantics differ (tool in script root vs project).
- **Effort:** Medium — **reject**

### 3. Domain `resolveToolInvocation` wired into `runScript`

Change application layer to rewrite spawns for declared tools.

- **Pros:** Shared resolution for all scripts.
- **Cons:** Out of scope for a catalog script; `runScript` already PATH-prepends; complexity already bypassed this with self-bootstrap; more surface for one script.
- **Effort:** Medium — **defer**; script-local resolution is enough

### Recommendation

**Approach 1.** Implement dead-code as a thin knip adapter with **no** script-root dependencies. Mirror complexity’s UX (JSON default, `--format text`, exit 0/1/2) but opposite tool strategy. Optionally duplicate the small `localBinRelativePaths` / npx fallback inside `index.mjs` (same rules as `resolveToolInvocation`) without changing `run-script.ts`.

## Proposed JSON envelope

```json
{
  "schema": "shitaku.catalog.dead-code/v1",
  "tool": "dead-code",
  "findings": {
    "files": [{ "file": "src/orphan.ts", "name": "src/orphan.ts" }],
    "exports": [{ "file": "src/math.ts", "name": "factorial", "line": 12, "col": 14 }],
    "types": [{ "file": "src/math.ts", "name": "Radians", "line": 20, "col": 13 }],
    "dependencies": [{ "file": "package.json", "name": "lodash" }],
    "devDependencies": [{ "file": "package.json", "name": "unused-dev" }],
    "unlisted": [{ "file": "package.json", "name": "rimraf" }]
  }
}
```

Notes for proposal/design:

- Always emit all six kind keys (empty arrays when none) for stable consumers.
- Sort within each kind by `file`, then `name`, then `line`.
- `--include files,exports` filters which kinds appear in output **and** which count toward exit `1` (pass through to knip `--include` where possible; filter envelope for kinds knip collapses).
- Text format: one section or TSV rows with a `kind` column.
- Default stdout JSON (match complexity); unsupported `--format` → exit 2.

## Risks

- **devDependencies key mismatch** — knip may fold unused deps/devDeps under `dependencies`; need research or package.json classification.
- **npx cold-start / network** — CI without knip-in-project may be slow or flaky; fixtures should prefer local install or pin via test env.
- **Knip `--fix` footgun** — must strip/reject any user attempt to pass `--fix` (exit 2) so the script never mutates.
- **bundled-catalog hard asserts** — currently `items.scripts === ['complexity']` and `entries === ['complexity']`; must update for two scripts (order: likely alphabetical or catalog.json order).
- **Config sensitivity** — consumer knip config can hide findings; tests need isolated fixtures with minimal/no knip config.
- **Exit-code mapping** — knip’s own exit codes may not match 0/1/2; script must map (parse JSON + own policy; treat spawn/parse failures as 2).
- **Review budget** — script + tests + docs regen may approach ~400 LOC; plan chained PR if docs inflate.

## Ready for Proposal

**Yes.** Orchestrator should proceed to `sdd-propose` (optional short `sdd-research` only if `devDependencies` JSON key needs empirical confirmation before locking the envelope). No implementation in this phase.

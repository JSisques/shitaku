# Exploration: catalog-complexity-script (issue #145)

**Verdict:** Ship `catalog/scripts/complexity/` as the first concrete catalog script using a self-contained ESLint flat config (`complexity` + `eslint-plugin-sonarjs/cognitive-complexity`), mapping `--format json` messages into a stable per-function JSON report that #148 hotspots can consume. #144 left the “shared output contract” undefined — this change must define it. Ready for proposal after a short research pass on npx plugin + TypeScript parser resolution.

## Quick path

1. Add `catalog/scripts/complexity/{index.mjs,script.json,eslint.config.mjs}` and list `complexity` in `items.scripts`.
2. Script spawns ESLint with the shipped config (not the consumer’s); thresholds enforced in the script, not only in ESLint `max`.
3. Tool resolution inside the script: local `node_modules/.bin` then `npx` (with explicit `-p` packages for the plugin).
4. Replace empty-scripts guard in `bundled-catalog.test.ts`; add fixtures + spawn tests for under/over threshold and JSON shape.
5. Regenerate README/website catalog tables; keep output schema stable for #148.

## Current State

### Scripts infrastructure (#144, on main)

| Concern                | Status                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog layout         | `catalog/scripts/<name>/index.mjs` + `script.json`; `items.scripts: []`                                                                       |
| Metadata schema        | Zod `ScriptMetaSchema`: `name`, `description`, `tools[]`, optional `args`, `output`, `exitCodes`                                              |
| Install roots          | project `./.shitaku/scripts/<name>/`; user `stateDir()/scripts/<name>/`                                                                       |
| Run                    | `shitaku run` → `runScript` → `ProcessRunner` with `process.execPath` + installed `index.mjs`, `shell:false`, stdio inherit, exit passthrough |
| Tool policy (domain)   | `resolveToolInvocation`: local `.bin` then `{ kind:'npx', args:[tool] }`                                                                      |
| Tool policy (run path) | Only prepends `cwd/node_modules/.bin` to `PATH`; does **not** call `resolveToolInvocation` or rewrite spawns                                  |
| Doctor                 | `script-tool-missing` (`info`): tool absent from local `.bin`; non-fatal; message says npx may still work                                     |
| Specs                  | `openspec/specs/scripts-install`, `scripts-run`, plus catalog/list/status deltas                                                              |
| Empty guard            | `scripts-install` “Empty structure”; `bundled-catalog.test.ts` asserts `items.scripts: []` and no non-dot entries under `catalog/scripts/`    |
| Docs                   | CONTRIBUTING “Add a script”; README Scripts/Run; generators already support scripts tables                                                    |

### What #144 did **not** define

- Shared JSON stdout envelope across scripts — explicitly **out of scope** in the archived proposal.
- Exact shapes for optional `args` / `output` / `exitCodes` (design open question left unchecked).
- Any concrete script content.

Issues #145 and #148 refer to a “shared output contract from #144”; in practice **#145 must introduce the first stable contract** (at least for complexity JSON), which #148 will read via `shitaku run complexity`.

### Host project tooling (relevant to engine choice)

- Repo already has `eslint` `10.11.0` as a **devDependency** (close to issue’s 10.12.0).
- `eslint-plugin-sonarjs` is **not** installed.
- Flat config at repo root (`eslint.config.js`) is for shitaku itself; the script must ship its own config beside `index.mjs` so consumer projects are not required to match it.

### ESLint rule report behavior (feasibility)

| Rule                           | Package                       | Reports when                   | Score in message                                                                                                      |
| ------------------------------ | ----------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `complexity`                   | ESLint core                   | `complexity > max`             | `"{{name}} has a complexity of {{complexity}}. Maximum allowed is {{max}}."`                                          |
| `sonarjs/cognitive-complexity` | `eslint-plugin-sonarjs` 4.2.2 | `complexityAmount > threshold` | `"Refactor this function to reduce its Cognitive Complexity from {{complexityAmount}} to the {{threshold}} allowed."` |

Implication: to **list** scores (not only gate), the shipped ESLint config should use very low rule thresholds (e.g. cyclomatic `max: 0`; cognitive threshold `-1` or `0`) so messages emit per function, then `index.mjs` applies CLI `--max-cyclomatic` / `--max-cognitive` (defaults 10 / 15) for exit code `1`. Cognitive `0` functions may be absent from sonar messages — join with cyclomatic rows and treat missing cognitive as `0`.

## Affected Areas

| Path                                                                                | Why                                                                                           |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `catalog/scripts/complexity/`                                                       | New script tree: `index.mjs`, `script.json`, shipped ESLint config (+ optional small helpers) |
| `catalog/catalog.json`                                                              | Add `"complexity"` to `items.scripts`                                                         |
| `test/adapters/catalog/bundled-catalog.test.ts`                                     | Replace empty-scripts assertion; expect `complexity` loaded                                   |
| `test/fixtures/complexity/` (new)                                                   | Under/over threshold JS/TS samples                                                            |
| `test/catalog/scripts/complexity.test.ts` (new, recommended)                        | Spawn script: exit 0/1, JSON shape, text format                                               |
| `README.md` / website catalog                                                       | Regenerated tables; prose that bundled catalog now ships a script                             |
| `CONTRIBUTING.md`                                                                   | Soften “do not commit concrete scripts” now that #145 is that follow-up                       |
| `openspec/specs/scripts-install` (delta later)                                      | MODIFY/remove “Empty structure / no concrete scripts”                                         |
| `openspec/specs/` (possible new `catalog-scripts-complexity` or extend scripts-run) | Behavior of this script’s CLI/output/exit codes                                               |
| Docs generators                                                                     | No code change expected; `--check` needs regenerated content                                  |

**Not affected (reuse as-is):** `ProcessRunner`, `run-script` resolution order, doctor severity model, hexagonal layers — unless research forces a run-layer change for multi-package `npx` (prefer handling inside the script).

## Approaches

### 1. ESLint core `complexity` + `eslint-plugin-sonarjs` (issue preferred)

Ship flat config next to `index.mjs`; run ESLint with `--format json`; map messages → per-function report; CLI thresholds + formats in the script.

- **Pros:** Matches #145; no build step; independent of consumer ESLint config; scores come from maintained engines; peer range includes ESLint 10.
- **Cons:** Rule messages only fire above configured max (need low max + post-filter); cognitive messages omit function name (join by file/line); **npx must install/resolve the plugin**, not only the `eslint` binary; TS parsing likely needs `@typescript-eslint/parser` / `typescript-eslint` beyond the two named tools.
- **Effort:** Medium

### 2. Programmatic ESLint API / custom visitors in `index.mjs`

Load rules via `ESLint` class or walk AST yourself for both metrics.

- **Pros:** Fuller control over “all functions” reporting; possibly cleaner join of scores.
- **Cons:** Heavier script; still depends on same packages; more code to maintain; diverges from issue’s “`--format json` and map messages” path.
- **Effort:** Medium–High

### 3. Fallback engines (`typhonjs-escomplex` / `ts-complex`)

- **Pros:** Simpler CLI packaging if they expose scores directly.
- **Cons:** Last published 2022 (issue already rejects as primary); weaker TS story; #148 consistency risk if metrics differ from ESLint/sonar.
- **Effort:** Medium (reject as primary)

### Recommendation

**Approach 1.** Implement the issue’s preferred engine. Put tool invocation (`eslint` local bin → `npx -p eslint -p eslint-plugin-sonarjs …`) inside the catalog script. Define a **versioned JSON report schema** in `script.json` `output` (and docs) as the de facto shared contract for #148.

Suggested report shape (proposal can refine):

```json
{
  "script": "complexity",
  "version": 1,
  "thresholds": { "cyclomatic": 10, "cognitive": 15 },
  "functions": [
    {
      "file": "src/foo.ts",
      "name": "bar",
      "line": 12,
      "cyclomatic": 11,
      "cognitive": 8
    }
  ]
}
```

Sort `functions` worst-first (e.g. by `max(cyclomatic, cognitive)` then file/line). Exit: `0` within limits, `1` any exceedance, `2` tool/parse/IO errors. Default stdout JSON; `--format text` human table.

## Research questions (worth a short sdd-research)

1. **npx + plugin:** Does `npx -y -p eslint -p eslint-plugin-sonarjs eslint -c <shipped flat config> --format json <files>` load `eslint-plugin-sonarjs` when the target project has neither package? Plain `npx eslint` alone is expected to **fail** plugin resolve.
2. **TypeScript:** With only `eslint` + `eslint-plugin-sonarjs`, can `.ts`/`.tsx` be parsed, or must `typescript-eslint` (and/or `typescript`) be declared in `tools` / `-p` list?
3. **Ignore files:** Confirm whether ESLint flat `ignores` + default ignore behavior satisfy “respect ignore files”, or whether `.gitignore` must be wired explicitly.

## Risks

- **Undefined #144 output contract:** Hotspots (#148) will couple to whatever #145 ships — lock schema early; avoid silent field renames.
- **npx nondeterminism / plugin resolve:** Doctor only checks local `.bin` for each tool name; `eslint-plugin-sonarjs` is a **library**, not a bin — declaring it in `tools` may always warn unless a bin exists; document that the script’s `npx -p` covers the plugin.
- **TS parser gap vs acceptance criteria** (“JS and TS files”).
- **Empty-scripts tests/specs/docs** must flip together or CI/`docs:catalog:check` fails.
- **Cognitive score join:** name-less sonar messages require location-based merge; anonymous/arrow functions need stable `name` strings.
- **400-line budget:** Catalog files + fixtures + tests + docs can exceed one PR; delivery_strategy is `auto-chain` / stacked-to-main — forecast in tasks.
- **Strict TDD:** Script behavior tests should spawn the real `index.mjs` (not only domain mocks).

## Ready for Proposal

**Yes, after optional research** on npx multi-package + TS parser (questions above). Orchestrator should tell the user:

1. Exploration recommends Approach 1 (ESLint + sonarjs) as the first concrete catalog script.
2. #144 did not ship a shared JSON envelope — #145 must define the complexity JSON contract for #148.
3. Offer `sdd-research` for npx/plugin/TS before or in parallel with `sdd-propose`; if skipped, proposal must treat those as explicit open decisions with fail-closed defaults.

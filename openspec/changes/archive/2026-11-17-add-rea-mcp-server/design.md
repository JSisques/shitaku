# Design: Add REA MCP Server to the Catalog

## Technical Approach

Catalog-data-only change (proposal "Approach", spec `rea-mcp-server`), following CONTRIBUTING "Adding to the catalog" and the shape of `catalog/mcps/playwright.json`. One new `catalog/mcps/rea.json` stdio entry, registered in `catalog/catalog.json`, guarded by `test/adapters/catalog/bundled-catalog.test.ts`, and surfaced through the two existing docs generators. No `src/` change: `FolderCatalogSource` loads the file, `McpItemSchema` (`src/domain/catalog/schema.ts`) validates it (name pattern, stdio `command`/`args`, `env` defaults to `[]`), and install, manifest, undo and status reuse the existing mcp-install flow.

## Architecture Decisions

### Decision: Exact version pin with the `mcp` subcommand

**Choice**: `"command": "npx"`, `"args": ["-y", "rea-agents@6.9.0", "mcp"]`.
**Alternatives considered**: `rea-agents@latest` (matches `playwright.json`); `rea-agents@6.5.0` (issue text); invoking the `rea` bin via `npx -p`.
**Rationale**: An exact pin makes installs reproducible and upgrades reviewable as explicit catalog PRs. `6.9.0` is npm `latest` at proposal time (user decision); the deviation from the issue is recorded in the PR body. The package name doubles as the default bin (`rea-agents`), so plain `npx -y rea-agents@6.9.0 mcp` resolves without `-p`.

### Decision: No `env` block, no placeholders

**Choice**: Omit both `server.env` and top-level `env`.
**Alternatives considered**: Declaring optional env refs for Hopper/Ghidra/IDA paths.
**Rationale**: REA needs no secret or configuration to start; tool discovery is upstream's concern. An empty surface avoids placeholder validation rules (`Templated`, declared `env`) and keeps the website page free of an Environment section.

### Decision: Prerequisite stated in the description only

**Choice**: Description (one line, no `|`):
`REA (Reverse Engineer Anything) reverse-engineering tools for binaries and apps; native analysis requires Hopper, Ghidra or IDA already installed`
**Alternatives considered**: Detecting or installing the tools; a separate docs section.
**Rationale**: The description flows into the README table, the website pages and `shitaku list`, which is where users choose MCPs. Detection or installation is out of scope (proposal). No `|` keeps README and website table cells unescaped; no `"` keeps the YAML frontmatter simple (the generator escapes it anyway). Exact wording may be tuned at apply time as long as the test tokens below still match.

### Decision: Append to `items.mcps`, insert alphabetically in the README sample

**Choice**: Append `rea` last in `catalog/catalog.json` `items.mcps` and in the test's exact list; insert `rea` between `playwright` and `sqlite` in the hand-kept `shitaku list` sample (README, "List" section).
**Alternatives considered**: Re-sorting `items.mcps`.
**Rationale**: `items.mcps` order is free-form and the test asserts load order, so appending is the minimal diff. The generated README table and the `list` output sort by name, so the sample must be alphabetical. The sample's 26-character name column (`cloudflare-observability` + 2 spaces) is kept.

### Decision: Test guards registration plus the spec contract

**Choice**: Extend the exact MCP name list in the first `it`, and add one new `it('ships rea as a pinned stdio MCP without env, outside every profile')` that asserts the server definition, absent env, description tokens and profile exclusion.
**Alternatives considered**: Registration-only (proposal minimum); a full-file snapshot of `rea.json`.
**Rationale**: Registration alone does not prove the spec's pin, no-env, description and profile requirements. A snapshot would duplicate the JSON file and churn on wording edits. Targeted assertions mirror the skill content-contract tests already in this file.

## Data Flow

    catalog/catalog.json ──→ FolderCatalogSource ──→ McpItemSchema ──→ Catalog.mcps
            │                                                              │
            ├──→ scripts/generate-catalog-table.mjs ──→ README MCP table   │
            └──→ scripts/generate-website-catalog.mjs ──→ website en/es    │
                                                                           ▼
                          shitaku init --mcps rea ──→ plan ──→ merge + manifest (undo/status)

At user run time the agent spawns `npx -y rea-agents@6.9.0 mcp` over stdio; shitaku itself never runs it.

## File Changes

| File                                              | Action | Description                                                         |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts`   | Modify | Append `'rea'` to the exact MCP list; new `rea` contract `it`       |
| `catalog/mcps/rea.json`                           | Create | Stdio entry per Interfaces below                                    |
| `catalog/catalog.json`                            | Modify | Append `"rea"` to `items.mcps`                                      |
| `README.md`                                       | Modify | MCP table (generated by `docs:catalog`); `shitaku list` sample line |
| `website/src/content/docs/en/catalog/mcps/rea.md` | Create | Generated by `pnpm run docs:website-catalog`                        |
| `website/src/content/docs/es/catalog/mcps/rea.md` | Create | Generated by `pnpm run docs:website-catalog`                        |

Unchanged: `src/`, `catalog/profiles/*`, the existing profile assertions in the test file. If the website generator also rewrites an index or sidebar file, commit whatever it emits; never hand-edit generated output.

## Interfaces / Contracts

No TypeScript changes. Data contract:

```json
{
  "name": "rea",
  "description": "REA (Reverse Engineer Anything) reverse-engineering tools for binaries and apps; native analysis requires Hopper, Ghidra or IDA already installed",
  "server": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "rea-agents@6.9.0", "mcp"]
  }
}
```

Loaded item (existing `McpItem` shape): `{ name: 'rea', description, server: { type: 'stdio', command: 'npx', args: [...] }, env: [] }`.

## Testing Strategy

Strict TDD, runner `pnpm test` (Vitest).

- **Unit (RED), registration**: append `'rea'` to the exact `catalog.mcps` name list in the first `it`; `catalog.issues` stays empty. Expected failure: list mismatch.
- **Unit (RED), contract**: new `it` loads the bundled catalog via `FolderCatalogSource`; expected failure: `rea` is undefined. It asserts:
  - `rea.server` `toEqual({ type: 'stdio', command: 'npx', args: ['-y', 'rea-agents@6.9.0', 'mcp'] })` (no `env` key);
  - `rea.env` `toEqual([])`, and the raw `catalog/mcps/rea.json` (`readFileSync`) contains no `${`;
  - no `args` entry contains `@latest`;
  - `description` has no newline, matches `/reverse/i` and matches `/Hopper|Ghidra|IDA/`;
  - `resolveProfile` for `base`, `web` and `backend` returns `mcps` without `rea`.
- **Integration (manual, at verify)**: `pnpm run build`, then `node dist/main.js init --mcps rea --scope project --dry-run` plans the MCP and writes nothing.
- **Docs**: `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check` pass.

Existing `web` and `backend` exact profile assertions stay untouched and double as the "profiles unchanged" proof. `test/generators.test.ts` uses a sandboxed catalog and is unaffected.

## Task Ordering and Commit Plan

1. RED: update `bundled-catalog.test.ts` (list + new `it`); run `pnpm test`; record both failures.
2. GREEN: create `catalog/mcps/rea.json`; append `rea` to `catalog/catalog.json`; `pnpm test` passes.
3. `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck` (fix touched files only).
4. Commit 1: `feat(catalog): add rea mcp server` (test, `rea.json`, `catalog.json`).
5. `pnpm run docs:catalog`, then `pnpm run docs:website-catalog`; add the `rea` line to the README `shitaku list` sample between `playwright` and `sqlite`; run both `:check` scripts and `pnpm run format:check`.
6. Commit 2: `docs: list rea mcp server in README and website` (README, two website pages, any other generator output).
7. Verify: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run build`, dry-run from the Integration item; confirm `git diff --stat main -- src catalog/profiles` is empty.

Single PR. Authored lines: about 10 (`rea.json`) + 1 (`catalog.json`) + about 30 (test) + 1 (README sample); generated docs excluded. Well under 400. PR body records the official-source check (npm `rea-agents`, MIT, `morluto/rea`) and the `6.9.0` versus `6.5.0` deviation.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in shitaku code. The entry declares a command the user's agent spawns later; shitaku only merges configuration. Supply-chain exposure of `npx -y` is mitigated by the exact pin and source verification (proposal Risks).

## Migration / Rollout

No migration required. Existing installs are unaffected; users opt in with `shitaku init --mcps rea`. Rollback is a revert of the two commits.

## Open Questions

- [ ] Upstream `mcp` subcommand and package contents for `6.9.0` were not verified from this environment (no shell access during exploration); re-confirm at apply or in the PR body check. Non-blocking.

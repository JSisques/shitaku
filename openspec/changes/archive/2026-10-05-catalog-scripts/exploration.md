# Exploration: catalog-scripts (issue #144)

**Verdict:** Add `scripts` as a **parallel directory kind** modeled on skills (tree hash, plan/apply/undo/status), with install roots under shitaku’s own `.shitaku/scripts/` (not `AgentTarget.skillsDir`), plus a new `shitaku run` path behind a `ProcessRunner` port. Do not ship concrete scripts. Ready for proposal.

## Quick path

1. Extend catalog schema + `FolderCatalogSource` for `catalog/scripts/<name>/` + `items.scripts`.
2. Reuse skill-style tree install into project `.shitaku/scripts/<name>/` and user `stateDir()/scripts/<name>/`.
3. Add `shitaku run` (list / resolve / spawn via `process.execPath`) and doctor tool warnings.
4. Wire profiles, list, init, status, undo, uninstall; leave JSON envelope and agent/hooks as open questions.

## Current state

### Catalog kinds today

| Kind    | On disk in catalog            | Validation                             | Install target                                                   |
| ------- | ----------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| MCP     | `mcps/<name>.json`            | Zod `McpItemSchema`                    | Merge into `.mcp.json` / `~/.claude.json` via `AgentTarget`      |
| Skill   | `skills/<name>/` + `SKILL.md` | `parseSkill` + tree of files           | `<cwd\|home>/.claude/skills/<name>/` via `AgentTarget.skillsDir` |
| Profile | `profiles/<name>.json`        | Zod `ProfileSchema` + `resolveProfile` | Not installed; selects MCP/skill names                           |
| Agent   | —                             | —                                      | **Not implemented** (#42); README mentions aspirationally        |
| Script  | —                             | —                                      | **Missing** (#144)                                               |

Index: `catalog/catalog.json` → `CatalogIndexSchema` (`mcps`, `skills`, `profiles`). `Catalog` / `LoadedCatalog` aggregate those three only.

### Lifecycle wiring (skills = closest analog for scripts)

| Concern          | Where it lives                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Schema / parse   | `src/domain/catalog/schema.ts`, `skill.ts`, `profile.ts`, `listing.ts`                                                    |
| Load             | `src/adapters/catalog/folder-source.ts` (`loadSkills` walks trees; MCP/profile JSON via Zod)                              |
| Plan             | `skill-plan.ts` (tree hash + create/skip/update/conflict); `change-plan.ts` (MCP merge)                                   |
| Apply / journal  | `init-mcps.ts` + `install-transaction.ts` + `journal.ts` (`stateDir` = `~/.claude/.shitaku`)                              |
| Manifest kinds   | `manifest.ts` discriminated union `mcp` \| `skill` (skill carries `root`)                                                 |
| Status / doctor  | `installed-state.ts`, `status-plan.ts`, `doctor-plan.ts` — branch on `item.kind`                                          |
| Undo / uninstall | Treat skill files as byte trees; LIFO per skill `root`                                                                    |
| CLI              | `program.ts`: `init` (`--mcps`/`--skills`), `list` (`LIST_KINDS`), `status`, `doctor`, `undo`, `uninstall` — **no `run`** |
| Prompter         | `selectMcps` / `selectSkills` / conflict kinds `'mcp' \| 'skill'`                                                         |
| Docs generators  | `scripts/generate-catalog-table.mjs` sections `mcps`, `skills` only                                                       |
| Process spawn    | **None in `src/`**; architecture test forbids `child_process` / `process.` in `domain/`                                   |

### Scope model (critical difference vs skills)

- Skills: agent dirs under `.claude/skills/`.
- Issue #144 scripts: **shitaku-owned** dirs:
  - project: `<cwd>/.shitaku/scripts/<name>/`
  - user: `stateDir(home)/scripts/<name>/` → `~/.claude/.shitaku/scripts/<name>/`
- Project wins on name clash at **run** time (dual-scope lookup). Init still installs into one chosen `--scope`.
- Repo root `scripts/` is tooling only; catalog uses `catalog/scripts/` — no path collision.

### Specs already covering related domains

`openspec/specs/catalog`, `skills-install`, `mcp-install`, `install-safety`, `install-status`, `catalog-list`, `item-uninstall`. Scripts will need delta specs (new domain and/or MODIFIED catalog/list/status/doctor).

## Affected areas

| Area                                            | Why                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/domain/catalog/*`                          | New script schema; extend index, `Catalog`, `LIST_KINDS`, profiles                            |
| `src/domain/plan/*`                             | Script plan (mirror `skill-plan`) + doctor codes for missing tools                            |
| `src/domain/manifest.ts`                        | New `kind: 'script'` (same shape as skill: name, root, entryHash)                             |
| `src/ports/`                                    | New `ProcessRunner`; optional `scriptsDir` helper (prefer journal/`Paths`, not `AgentTarget`) |
| `src/application/`                              | init, apply, status, doctor, undo, uninstall, list; **new run use case**                      |
| `src/adapters/catalog/folder-source.ts`         | Load `scripts/` like skills                                                                   |
| `src/adapters/cli/*`                            | `--scripts`, `list scripts`, prompts, **`run` command**                                       |
| `src/adapters/fs` or new process adapter        | Spawn implementation                                                                          |
| `src/main.ts`                                   | Wire `ProcessRunner` / `execPath`                                                             |
| `catalog/catalog.json`, `catalog/scripts/`      | Empty structure (no concrete scripts)                                                         |
| `CONTRIBUTING.md`, `README.md`, docs generators | Contributor + user docs                                                                       |
| `test/**` mirroring above                       | Strict TDD (`openspec/config.yaml`)                                                           |
| `openspec/specs/*`                              | Delta requirements                                                                            |

## Approaches

| #   | Approach                                                                                                                        | Pros                                                                                           | Cons                                                                                    | Effort      |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------- |
| 1   | **Parallel directory kind** (mirror skills: `ScriptItem`, `ScriptChange`, `kind:'script'`, separate `scripts:` on `ChangePlan`) | Matches existing patterns; clear install roots under `.shitaku`; isolates risk from skill code | Some duplication with skill-plan/apply/undo                                             | Medium–High |
| 2   | **Generalize tree installs** (shared “directory kind” for skill + script)                                                       | Less long-term duplication                                                                     | Refactors hot path (skills) in same change; larger review blast radius                  | High        |
| 3   | **Hang scripts on `AgentTarget.scriptsDir`** like skills                                                                        | Reuses target API                                                                              | Contradicts #144 (roots are shitaku state, not `.claude/`); couples run to agent target | Reject      |

### Recommendation

**Approach 1.** Treat scripts like skills for install safety (tree hash, backup, force, undo), but resolve install roots from `Paths` + `stateDir` (same family as the manifest), not `AgentTarget`. Add `ProcessRunner` for `run` only in adapters/application. Defer generalizing skill/script trees unless duplication becomes painful after apply.

Metadata shape (JSON vs frontmatter) is a **design** detail; catalog layout should stay `catalog/scripts/<name>/index.mjs` + a validated metadata file, listed under `items.scripts`.

## Extension map (proposal checklist)

Confirmed by #144 (do not reopen):

1. Install scopes: project `.shitaku/scripts/`, user `stateDir()/scripts/`; project wins on run clash.
2. `shitaku run <name> [args]`; name-only; exit passthrough; never edit `package.json`; bare `run` lists.
3. Runtime: ESM `.mjs` via `process.execPath` (Node ≥22.13); no Bash/Python/TS.
4. Tools in metadata; resolve `node_modules/.bin` then `npx`; doctor warns.
5. Profiles can reference scripts; dry-run/force/backup/undo/status like other kinds.
6. New `ProcessRunner` port; hexagonal layers.
7. Out of scope: concrete scripts (#145–149).

Open for proposal (optional product Qs):

1. Shared JSON stdout envelope across scripts?
2. Skills/agents/hooks invoking `shitaku run`?

## Risks

- **Wide kind blast radius:** every `mcp | skill` union (manifest, status, doctor, uninstall, undo, CLI, prompter, profiles, listing) must grow a third arm.
- **Dual-scope run vs single-scope init:** listing/resolution semantics for installed-only vs catalog-only need explicit rules in design.
- **Windows PATH / `.cmd` shims / spaces:** acceptance asks for Windows coverage; CI is `ubuntu-latest` only today.
- **`npx` network / nondeterminism:** run fallback may hit registry; doctor “warn” severity vs exit codes must be specified.
- **400-line review budget:** structure alone likely needs chained PRs under `ask-on-risk`.
- **Docs generators & website catalog:** empty `scripts` still needs schema/markers so future scripts do not break `--check`.
- **Trust model:** `--source` scripts become executable local code (same trust class as MCP commands / skill instructions).
- **Architecture guard:** spawn/`process.execPath` must stay out of `domain/`; composition root or process adapter owns `execPath`.

## Ready for proposal

**Yes.** Decisions in #144 are enough to draft proposal/design. Clarifications that can wait for design: exact metadata filename/fields, doctor severity for missing tools, and whether `run` lists only installed scripts or also catalog-available ones.

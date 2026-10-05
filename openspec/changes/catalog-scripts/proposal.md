# Proposal: Installable catalog scripts

Add installable `scripts` catalog kind (structure only; no concrete scripts) so shitaku can list, install, status, undo, and run deterministic tools via `shitaku run`.

## Intent

Catalog covers MCPs, skills, and profiles, but not reproducible developer scripts for terminal/CI. #144 needs name-runnable installs with plan/backup/undo safety under shitaku-owned roots (not agent skill dirs).

## Scope

### In Scope

- `catalog/scripts/<name>/` (`index.mjs` + validated metadata); `items.scripts`
- Scopes: project `.shitaku/scripts/`, user `stateDir()/scripts/`; project wins on run clash
- Plan/apply/undo/status/uninstall/list/init/doctor for `kind: 'script'`
- `shitaku run` (list, name-only resolve, args passthrough, exit passthrough) via `ProcessRunner` + `process.execPath`
- Tools: `node_modules/.bin` then `npx`; doctor warns; profiles may reference scripts
- Docs/generators for empty scripts section; TDD + Windows path tests

### Out of Scope

- Concrete scripts (#145–149); shared JSON envelope; skills/agents/hooks → `run`
- Bash/Python/TS runtimes; `package.json` edits; Approach 2 tree generalization; CI OS matrix expansion

## Capabilities

### New Capabilities

- `scripts-install`: Load/plan/apply/undo/status/uninstall for script trees under shitaku roots
- `scripts-run`: Resolve/spawn/tools/`npx`/bare-run list/doctor tool warnings

### Modified Capabilities

- `catalog`, `catalog-list`, `install-status`, `install-safety`, `item-uninstall`: scripts kind + safety/uninstall deltas

## Approach

**Approach 1:** Parallel directory kind (mirror skills: tree hash, `kind:'script'`), roots from `Paths`/`stateDir` — not `AgentTarget`. `ProcessRunner` in ports; spawn/`execPath` only in adapters/`main.ts`. Metadata filename/fields deferred to design.

## Affected Areas

| Layer                 | Impact       | Description                                                             |
| --------------------- | ------------ | ----------------------------------------------------------------------- |
| domain                | Modified     | Schema, listing, profiles, plan, manifest `script`, doctor              |
| ports                 | New          | `ProcessRunner`; script roots via Paths/journal                         |
| application           | Modified/New | init/status/undo/uninstall/doctor; run use case                         |
| adapters + main       | Modified/New | folder-source, CLI `run`/`--scripts`, process adapter, wire execPath    |
| catalog / test / docs | Modified     | Empty scripts structure; mirrored tests; README/CONTRIBUTING/generators |

## Risks

| Risk                                       | Likelihood | Mitigation                                       |
| ------------------------------------------ | ---------- | ------------------------------------------------ |
| Wide kind-union blast radius               | High       | Parallel kind; chained PRs (ask-on-risk)         |
| Dual-scope run vs single-scope init        | Med        | Spec: installed-only list; project-first resolve |
| Windows paths; CI ubuntu-only              | Med        | Unit path tests now; matrix later                |
| `npx` nondeterminism / trust of `--source` | Med/Low    | Prefer local bin; document trust like MCP/skills |

## Rollback Plan

Revert branch/PR before release. No shipped scripts → no migration. Prefer undo/uninstall of script installs, then drop `run`/ProcessRunner. Orphan `kind:'script'` manifest rows become inert after revert.

## Dependencies

#144 decisions (confirmed); exploration Approach 1; existing skill safety + `stateDir` patterns.

## Success Criteria

- [ ] Schema + `list scripts` + profile refs; init/status/undo/dry-run/force (both scopes)
- [ ] `run` project→user, rejects paths, exit passthrough; bare run lists; tools + doctor
- [ ] Tests/lint/typecheck/build pass; README docs; zero concrete scripts shipped

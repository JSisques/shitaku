# Exploration: add-rules-catalog-kind (issue #237)

## Current State

- Kinds today: mcps, skills, scripts, commands, hooks, agents, plus profiles (being removed by #285). There is no `add` or `new` command; `program.ts` registers `init`, `undo`, `uninstall`, `status`, `list`, `doctor`, `run`, `upgrade`, `version`. No code touches `CLAUDE.md` or `.claude/rules`.
- Closest precedent: agents and commands, the "flat file" kinds.
  - One file per item at `catalog/<kind>/<name>.md`, loaded by `FolderCatalogSource.loadFileItems` (no symlinks; unlisted and ghost entries flagged).
  - Planned by `buildFlatFilePlan`, decided by `classifyOwned` (create / skip / update / conflict).
  - Manifest item is `TreeItemSchema.extend({ kind })`; `FlatFileKind` union plus `isFlatFileKind`; ownership derived from the manifest; undo is generic via byte backups.
- Hooks use a managed entry inside the shared `settings.json` (`hook-merge`, `hook-plan`); more complex and not needed here.
- The agent kind took 8 chained PRs (~2500 lines), including a one-off frontmatter nested mode and a dedupe refactor, both already merged. Kind code is still copy-per-kind: `ChangePlan.<kind>`, `planInit`, `applyPlan`, `uninstall-item`, `installed-state`, `doctor-plan`, `program.ts` flags/conflicts/kind choices, prompter, listing, docs generators, CONTRIBUTING, bundled-catalog test.
- Claude Code natively loads `.claude/rules/*.md` (project) and `~/.claude/rules/` (user), recursively; optional `paths:` frontmatter scopes a rule to matching files. Source: code.claude.com/docs/en/memory.

## Issue Scope vs Dependencies

| Issue item                                             | Status                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Rule item schema (md + frontmatter name/description)   | In scope now                                                            |
| Catalog loader, list/status/doctor/uninstall/undo      | In scope now                                                            |
| `init --rules` plus prompt, install to `.claude/rules` | In scope now                                                            |
| Docs and initial rule texts                            | In scope now                                                            |
| Deterministic `check` and severity `error              | warn`                                                                   | No consumer yet (`shitaku new` gates, #226) |
| Precedence catalog < team < project                    | Only catalog and project layers exist (team config, #181)               |
| Learned rules, router suggestions                      | Not existing (#228, #244)                                               |
| Rules in profiles                                      | Do not touch `ProfileSchema` / `resolveProfile` (#285 removes profiles) |
| `shitaku add rule <name>`                              | Needs a new `add` command (none exists)                                 |

## Approaches

| Approach                                                               | Pros                                                                                     | Cons                                                             | Effort  |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------- |
| A. Flat files in `.claude/rules/<name>.md` (new `FlatFileKind` `rule`) | Reuses flat-file plan, ownership, undo; native Claude Code loading; no shared-file merge | No `CLAUDE.md` injection; check/severity deferred                | Low-Med |
| B. Managed blocks inside `CLAUDE.md`                                   | Single visible file                                                                      | New text-merge mechanism, drift/undo/status on a user-owned file | High    |
| C. Full issue now (A + checks + severity + precedence + `add`)         | Complete issue                                                                           | Speculative, no runner/consumer; rework once #226/#181 land      | High    |

Recommendation: A, instruction-only slice. Frontmatter stays permissive (unknown keys pass through, as with agents) so `check` / `severity` can be added later without breaking. `add` becomes a separate change; checks a follow-up tied to #226.

## Proposed Slice 1

`catalog/rules/*.md` plus `items.rules` (default `[]`), `parseRule` (name equals stem, description, non-empty body; nested frontmatter allowed so `paths:` works), `Catalog.rules`, listing kind `rule`, `AgentTarget.rulesDir` (project `./.claude/rules`, user `~/.claude/rules`), manifest kind `rule` (plus `FlatFileKind`), `ChangePlan.rules`, `planInit` / `applyPlan`, `uninstall --kind rule`, status/doctor `rule-missing`, `init --rules` plus prompter selection, docs (README/website generators, CONTRIBUTING), seed rules. Strict TDD, chained PRs.

## Risks

- Per-kind copy-paste surface (~20 files); easy to miss a spot (the agent change used a grep checklist for `kind === 'command'`).
- 400-line review budget: chained PRs needed (delivery strategy ask-on-risk).
- Rule bytes copied verbatim into a directory the user may also hand-edit: conflict handling same as agents.
- Designing check/severity without a consumer risks the wrong shape; hence the deferral.
- Manifest downgrade: older versions throw `ManifestError` on unknown kind `rule` (same as hooks/agents); needs a doc note.
- Profile removal (#285) may collide with edits to `profile.ts` / loader; avoid touching profiles.
- Rule files without `paths` load every session: context cost, so seed set size matters.

## Product Decisions (resolved by the user)

1. Slice 1 is instruction-only: no deterministic checks, no severity.
2. Injection target: `.claude/rules/<name>.md` only; no `CLAUDE.md` managed block.
3. Install via `init --rules` plus interactive selection; no `add` command now (follow-up #289).
4. Ten seed rules (instruction text only); a recommended starting set of five selectable in init.
5. Precedence: existing conflict / `--force` semantics; team layer deferred (follow-up #288).

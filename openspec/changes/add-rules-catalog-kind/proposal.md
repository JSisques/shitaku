# Proposal: Installable rules in the catalog (issue #237)

## Intent

Teams want shared, versioned coding rules ("explain why", "conventional commits", "no secrets") available to the agent in every session. Today shitaku cannot ship them: there is no rule kind, and users copy text into `CLAUDE.md` by hand. Claude Code natively loads `.claude/rules/*.md` (project) and `~/.claude/rules/` (user), so a flat-file `rule` kind gives rules the same install, conflict, undo, and uninstall safety as agents and commands, with no new merge mechanism.

## Scope

### In Scope

- `rule` catalog kind: `catalog/rules/<name>.md`, `items.rules` in `catalog.json` (default `[]`). Frontmatter `name` (equals file stem) and `description` required, non-empty body, bytes verbatim; nested frontmatter allowed so Claude Code's `paths:` works; unknown keys pass through.
- Install to `<cwd>/.claude/rules/<name>.md` (project scope) or `~/.claude/rules/<name>.md` (user scope), flat, reusing the flat-file plan, ownership, backup, stale-file, and undo machinery.
- Existing conflict semantics: create / skip / update / conflict, `--force`, exit 2 on non-interactive conflict.
- `list`, `status`, `doctor` (`rule-missing`), `uninstall <name> --kind rule`, `undo`.
- `init --rules <names>` flag and interactive rule selection, with a recommended starting set (`module-readme`, `conventional-commits`, `tests-for-changes`, `no-secrets`, `ask-when-unsure`) offered as the preselected/easy choice.
- Ten seed rules, instruction text only: `naming`, `small-changes`, `explain-why`, `no-new-deps`, `error-handling`, `ask-when-unsure`, `module-readme`, `conventional-commits`, `tests-for-changes`, `no-secrets`.
- Docs: README (incl. manifest downgrade note), CONTRIBUTING "Adding to the catalog: rules", generated catalog docs and website.

### Out of Scope

- Deterministic checks, severity (`error|warn`), precedence layers (catalog < team < project), learned rules, and the six checked rules (`no-any`, `layer-boundaries`, `env-documented`, `no-stray-todos`, `changelog-or-docs`, `max-file-size`): follow-up #288.
- Generic `add <kind> <name>` command (including `add rule`): follow-up #289.
- `CLAUDE.md` managed blocks or any edit of `CLAUDE.md`.
- Rules in profiles: no change to `ProfileSchema` / `resolveProfile` (profiles are being removed by #285).
- Recursive rule subdirectories; non-Claude targets; a generic kind registry.

## Capabilities

### New Capabilities

- `rules-install`: install roots, plan classification, conflict/dry-run/backup/stale protection, selection (`--rules`, interactive, recommended set), undo, uninstall, and manifest compatibility for the `rule` kind.

### Modified Capabilities

- `catalog`: `items.rules`, rule validation (name/stem, description, body, nested frontmatter), bundled seed rules.
- `catalog-list`: `rule` kind in listings.
- `install-status`: rule status and `rule-missing` doctor finding.
- `item-uninstall`: `--kind rule` and name-collision behavior with other kinds.

## Approach

Exploration Approach A: a new `FlatFileKind` `rule` modeled on `agents`, which is the most recent and complete flat-file precedent.

- Domain: `parseRule` reuses the frontmatter reader in nested mode (as agents do), so `paths:` and future keys stay opaque and verbatim. Manifest gains `kind: 'rule'`; manifest version unchanged.
- Ports: `AgentTarget.rulesDir(scope)`; prompter gains rule selection.
- Application: `ChangePlan.rules` planned by `buildFlatFilePlan` and applied by the existing flat-file apply path; uninstall, installed-state, and doctor branches added via `isFlatFileKind`.
- Adapters: Claude Code target resolves `.claude/rules`; folder catalog source loads `rules`; CLI adds `--rules`, `--kind rule`, and the interactive step.
- How the recommended set is marked (catalog metadata vs. a constant in the CLI) is a design-phase decision; it must not touch profiles.
- Strict TDD throughout; the agent change's grep checklist (`kind === 'agent'`) is reused to catch every per-kind branch.

## Affected Areas

| Layer       | Area                                                                                                 | Impact       |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------ |
| Domain      | `src/domain/catalog/{rule (new),schema,listing}.ts`, `src/domain/manifest.ts`, `src/domain/plan/*`   | New/Modified |
| Ports       | `src/ports/agent-target.ts` (`rulesDir`), `src/ports/prompter.ts`                                    | Modified     |
| Application | `init-mcps`, `uninstall-item`, `installed-state`, `undo-install`, `status`                           | Modified     |
| Adapters    | `claude-code/target.ts`, `catalog/folder-source.ts`, `cli/{program,clack-prompter}.ts`               | Modified     |
| Data/docs   | `catalog/catalog.json`, `catalog/rules/*.md` (new), `scripts/generate-*.mjs`, README, CONTRIBUTING, website | New/Modified |
| Tests       | Mirrors of the above, bundled-catalog test, architecture/naming guards                               | New/Modified |

## Risks

| Risk                                                         | Likelihood | Mitigation                                                                 |
| ------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------- |
| Missed per-kind branch (~20 files of copy-per-kind code)     | Med        | `isFlatFileKind`, grep checklist, install/undo/uninstall round-trip test   |
| User hand-edits files in `.claude/rules/`                    | Med        | Existing conflict/`--force`/backup semantics; never silent overwrite       |
| Older shitaku versions reject `kind: 'rule'` manifests       | Low        | README downgrade note (same as agents/hooks)                               |
| Rules without `paths` load every session (context cost)      | Med        | Keep seed rules short; recommended set is five, not all ten                |
| Frontmatter shape blocks future `check`/`severity` (#288)    | Low        | Unknown keys pass through; no closed allow-list                            |
| Collision with profile removal (#285)                        | Low        | Do not touch `profile.ts` or profile wiring                                |
| `name`/`description` keys unused by Claude Code rule loading | Low        | Claude Code ignores unknown frontmatter; verify in design against docs     |

## Rollback Plan

Each PR slice is independently revertable. Reverting the CLI slice hides the feature (no `--rules`, no prompt) while domain code stays inert. A full revert removes the kind; installed rule files remain plain Markdown that Claude Code still loads, and users can delete them with `undo`/`uninstall` before downgrading. Manifests containing `rule` items need a version that knows the kind (documented downgrade note).

## Dependencies

- None blocking. Follow-ups: #288 (checks, severity, precedence, learned rules, checked rules), #289 (`add` command). Coordinate with #285 (profile removal) to avoid touching profiles.

## Success Criteria

- [ ] `init --rules no-secrets --scope project --yes` writes `.claude/rules/no-secrets.md` byte-identical to the catalog; user scope writes `~/.claude/rules/`.
- [ ] Conflict, `--force`, dry-run, stale-file, undo, and `uninstall --kind rule` behave as for agents (round-trip test).
- [ ] `list`, `status`, and `doctor` report rules; `rule-missing` fires for a deleted owned rule.
- [ ] Interactive init offers rules with the five-rule recommended set.
- [ ] Ten seed rules ship and pass the bundled-catalog test; a rule with `paths:` frontmatter loads.
- [ ] No change to `ProfileSchema` / `resolveProfile`; no `CLAUDE.md` writes.
- [ ] `pnpm test`, typecheck, lint, format, build, and architecture guard green.

## Review Workload Forecast

| PR  | Slice                                                                     | Est. lines |
| --- | ------------------------------------------------------------------------- | ---------- |
| 1   | Domain catalog: `rule.ts`, schema `items.rules`, listing, folder loader   | ~350       |
| 2   | Manifest kind, ownership, `ChangePlan.rules`, `rulesDir`, plan build      | ~350       |
| 3   | Apply, undo, uninstall, status, doctor                                    | ~380       |
| 4   | Seed rules (10) + bundled-catalog test + catalog docs generators          | ~350       |
| 5   | CLI `--rules`, interactive selection + recommended set, `--kind rule`, README/CONTRIBUTING/website | ~380 |

Total ~1800 authored lines; user-facing surface lands last.

Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High

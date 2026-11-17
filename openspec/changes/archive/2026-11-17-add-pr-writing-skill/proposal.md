# Proposal: Add pr-writing Catalog Skill

## Intent

Add a bundled **pr-writing** skill (#236) so agents write pull request titles and descriptions consistently: a Conventional Commits title that semantic-release can consume after squash merge, a concise structured body, and metadata suggestions (labels, reviewers, milestone) grounded in what the target repository actually has. Today agents improvise PR text, which risks titles that break release versioning and invented labels or reviewers.

## Scope

### In Scope

- `catalog/skills/pr-writing/SKILL.md`: English, generic (works in any repository), model-invocable (no `disable-model-invocation`), single-line `name` and Trigger-style `description` (<=250 chars). Layout mirrors `socratic-method`: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract (~40-60 lines).
- Skill behavior:
  - Title: Conventional Commits (`type(scope)?: subject`), commitlint `config-conventional` types, breaking changes marked with `!` and a `BREAKING CHANGE:` footer in the body.
  - Body: summary, changes, how to test, `Closes #<n>` when an issue is known.
  - Metadata is discovered, never invented: labels from the real repo (`gh label list` when available), reviewers from `CODEOWNERS` or git history, milestone from existing milestones. When not discoverable, omit or ask. All metadata is presented as a suggestion for the user to confirm.
  - Decision Gates: existing PR template (follow it), no `CODEOWNERS` (do not invent reviewers), breaking change (`!` + footer).
- Register `pr-writing` in `catalog/catalog.json` → `items.skills`.
- Update `test/adapters/catalog/bundled-catalog.test.ts` (hardcoded skill list, dir entries, length 2 → 3), RED first.
- Regenerate docs: `pnpm run docs:catalog` (README) and `pnpm run docs:website-catalog` (website en/es).

### Out of Scope

- **Topics**: dropped. GitHub PRs have no topics. Issue #236's acceptance criterion mentioning topics should be corrected/updated to remove it.
- Commit messages and squash-merge subjects other than the PR title itself.
- Creating or editing PRs automatically (the skill drafts; it does not run `gh pr create` without user confirmation).
- shitaku-specific hardcoding (label names, reviewers, milestones).
- Adding a PR template or `CODEOWNERS` to this repository.
- Any `src/` change (domain, ports, application, adapters) or install-time templating.

## Capabilities

Catalog-bundled skill content and installability acceptance. Install/list/validate behavior stays under existing `catalog` and `skills-install` (no deltas).

### New Capabilities

- `pr-writing-skill`: catalog-bundled PR writing skill content (Conventional Commits title, structured body, discovered-only metadata suggestions, decision gates) and installability acceptance.

### Modified Capabilities

None

## Approach

Exploration Approach 1: a single generic `SKILL.md` following CONTRIBUTING "Add a skill" and the `socratic-method` layout. The skill instructs the agent to inspect the diff/commits and repository conventions (PR template, commitlint config, `CODEOWNERS`, `gh` labels and milestones) before drafting, and to output a title, body and a clearly marked "suggested metadata" block for confirmation. Install remains a byte-identical copy. Strict TDD: update the bundled-catalog test first (RED), then add the skill and catalog entry (GREEN), then regenerate docs.

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and generated docs only.

| Area                                                            | Impact   | Description                        |
| --------------------------------------------------------------- | -------- | ---------------------------------- |
| `catalog/skills/pr-writing/SKILL.md`                            | New      | Skill content + frontmatter        |
| `catalog/catalog.json`                                          | Modified | Add `pr-writing` to `items.skills` |
| `test/adapters/catalog/bundled-catalog.test.ts`                 | Modified | Bundled list, dir entries, count 3 |
| `README.md`                                                     | Modified | Skills table (generated)           |
| `website/src/content/docs/{en,es}/catalog/skills/pr-writing.md` | New      | Website pages (generated)          |
| `src/`                                                          | None     | Catalog data only                  |

## Risks

| Risk                                                      | Likelihood | Mitigation                                                                  |
| --------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Frontmatter or website emitter parse failure              | Low        | Single-line `name`/`description`, <=250 chars; mirror `socratic-method`     |
| Docs CI drift (README/website out of sync)                | Med        | Run both docs scripts and their `:check` variants                           |
| Agent invents labels/reviewers despite instructions       | Med        | Hard Rule + Decision Gate: discover or omit/ask; mark all as suggestions    |
| `gh` unavailable or unauthenticated in target environment | Med        | Skill falls back to omitting metadata or asking the user                    |
| Issue #236 AC still lists topics                          | Low        | Note in PR/issue that the topics criterion is dropped and should be updated |
| Title type mismatch with semantic-release (wrong bump)    | Low        | Restrict to `config-conventional` types; explicit breaking-change gate      |

## Rollback Plan

Revert the single PR: remove `catalog/skills/pr-writing/`, the `catalog.json` entry, the test changes, and the regenerated README/website pages (or rerun the docs scripts after revert). No `src/`, manifest or migration impact. Users who already installed the skill can run `shitaku undo` or delete the installed skill directory.

## Dependencies

- Shipped skills-install capability (#15) and the existing catalog docs generators.
- No external dependency; `gh` is optional at skill run time, not at install time.

## Review Workload Forecast

Expected authored change well under 400 lines (~60-line SKILL.md, 1-line catalog entry, ~5-10 test lines; generated docs excluded). Single PR. 400-line budget risk: Low.

## Success Criteria

- [ ] `init --skills pr-writing --dry-run` plans a `create` for the skill from the bundled catalog
- [ ] Bundled-catalog test lists 3 skills including `pr-writing` and passes (observed RED first)
- [ ] `docs:catalog:check` and website catalog check pass
- [ ] SKILL.md has single-line `name: pr-writing`, Trigger-style one-line `description`, no `disable-model-invocation`
- [ ] SKILL.md requires Conventional Commits title, `!` + `BREAKING CHANGE:` for breaking changes, body with summary/changes/how to test/`Closes #`
- [ ] SKILL.md forbids invented metadata and presents labels/reviewers/milestone as discovered suggestions only
- [ ] No topics, no commit-message scope, no `src/` changes
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass

# Proposal: Add commit-writing Catalog Skill

## Intent

Add a bundled **commit-writing** skill (#276) so agents draft clear, consistent commit messages and split work into atomic commits. Today agents improvise: vague subjects, mixed concerns in one commit, missing rationale in the body, unmarked breaking changes and attribution trailers. The existing `catalog/rules/conventional-commits.md` rule is a 6-line format reminder; the skill goes deeper (type and scope choice, subject and body quality, breaking-change footers, atomic split proposals). Every existing skill already excludes commit messages, so this fills an explicit gap without overlap.

## Scope

### In Scope

- `catalog/skills/commit-writing/SKILL.md`: English, generic and tool-agnostic, model-invocable (no `disable-model-invocation`), exactly two frontmatter keys: `name: commit-writing` and a single-quoted, single-line `Trigger:`-style `description` (<=250 chars, no apostrophes, double quotes or pipes). Layout mirrors `test-writing`, `docs-writing` and `refactoring`: Activation Contract (ending with a "Not for ..." sentence), Hard Rules, Decision Gates (Condition | Action table), Execution Steps (numbered), Output Contract.
- Skill behavior:
  - **Draft-only by default**: the skill drafts commit messages and proposes an atomic split; it runs `git commit` only when the user explicitly asks.
  - **Repository conventions first**: inspect existing history, commitlint or similar config, allowed types and scopes; they win over the skill defaults.
  - **Conventional Commits**: type, optional scope, imperative lowercase subject without trailing period, concise subject length.
  - **Body explains why**: motivation and context rather than restating the diff; wrap lines; reference issues in the footer.
  - **Breaking changes**: `!` marker and a `BREAKING CHANGE:` footer describing the migration.
  - **Atomic commits**: one logical change per commit; propose a split (with file or hunk grouping and order) when the staged or working changes mix concerns; tests and docs travel with the behavior they cover.
  - **No attribution trailers**: never add co-author or AI attribution trailers (worded without the literal forbidden token).
  - Activation boundary: "Not for" pull request titles or descriptions (owned by `pr-writing`), changelog or release notes, writing or changing code or tests.
- Register `commit-writing` in `catalog/catalog.json` -> `items.skills` in alphabetical order (first entry); run `pnpm run format`.
- Update `test/adapters/catalog/bundled-catalog.test.ts` RED first: both exact skill lists, count 7 -> 8, a `commit-writing` entry with `files: ['SKILL.md']`, and a content-contract test via `expectSkillContract` asserting a few load-bearing tokens (`Conventional Commits`, `BREAKING CHANGE:`, `atomic`, `why`, `Not for pull request`) and the forbidden tokens (`/shitaku/i`, `Co-Authored-By`).
- Regenerate docs: `pnpm run docs:catalog` (README) then `pnpm run docs:website-catalog` (website en/es); verify with the matching `:check` scripts.

### Out of Scope

- A `commit-writer` agent or any profile entry (separate issue).
- Changes to `catalog/rules/conventional-commits.md`, other skills, rules or agents.
- Running `git commit`, staging or rewriting history automatically (only on explicit user request).
- Tool-specific integrations (commitlint config generation, git hooks, interactive staging scripts).
- A `references/` folder or multi-file skill.
- Any `src/` change or install-time templating.
- Hand edits to generated README or website pages, or to `CHANGELOG.md` (release-generated).

## Capabilities

Install, list and validate behavior stays under the existing `catalog` and `skills-install` capabilities (no deltas).

### New Capabilities

- `commit-writing-skill`: catalog-bundled commit-writing skill content (draft-only default with explicit-request commit, repository conventions first, Conventional Commits format, why-focused body, breaking-change footer, atomic split proposals, no attribution trailers), activation boundary versus `pr-writing`, decision gates, and installability acceptance.

### Modified Capabilities

None

## Approach

Single generic `SKILL.md` mirroring the archived `add-test-writing-skill` change (exploration recommendation). The skill tells the agent to inspect repository conventions and the pending changes, decide whether a split is needed, draft one message per atomic commit, and report the drafts (committing only on explicit request). Install remains a byte-identical copy.

Strict TDD (`pnpm test`): update the bundled-catalog test and add the content-contract test first and observe RED, then add the skill and catalog entry (GREEN), then format, regenerate docs, run gates, and dry-run `init --skills commit-writing`.

Delivery: one PR with two Conventional Commits:

1. `feat(catalog): add commit-writing skill` (SKILL.md, catalog.json, test).
2. `docs: list commit-writing skill in README and website` (generated README and website pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and generated docs only.

| Area                                                                | Impact   | Description                                                       |
| ------------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `catalog/skills/commit-writing/SKILL.md`                            | New      | Skill content and frontmatter                                     |
| `catalog/catalog.json`                                              | Modified | Add `commit-writing` as first `items.skills` entry (alphabetical) |
| `test/adapters/catalog/bundled-catalog.test.ts`                     | Modified | Skill lists, count 8, `byName` entry, content-contract test       |
| `README.md`                                                         | Modified | Skills table (generated by `docs:catalog`)                        |
| `website/src/content/docs/{en,es}/catalog/skills/commit-writing.md` | New      | Website pages (generated by `docs:website-catalog`)               |
| `src/`                                                              | None     | Catalog data only                                                 |

## Risks

| Risk                                                               | Likelihood | Mitigation                                                                                               |
| ------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| Description breaks the 250-char or no-apostrophe/quote/pipe rule   | Med        | Count characters; avoid contractions; `expectSkillContract` enforces it                                  |
| Literal `Co-Authored-By` needed to explain the no-attribution rule | Med        | Phrase as "co-author or AI attribution trailers"; forbidden-token guard enforces it                      |
| Overlap with `pr-writing` or the `conventional-commits` rule       | Low        | Explicit "Not for pull request ..." boundary; skill defers to repository config and complements the rule |
| Agent commits without consent                                      | Low        | Hard rule and decision gate: draft only, commit only on explicit request                                 |
| Docs CI drift or Prettier reformatting (catalog.json, tables)      | Med        | Run `pnpm run format`, both docs scripts in order and their `:check` variants                            |
| Brittle content guard                                              | Low        | Assert only a few load-bearing tokens                                                                    |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/skills/commit-writing/`, the `catalog.json` entry, the test changes and the regenerated README and website pages (or rerun the docs scripts after the revert). No `src/`, manifest or migration impact. Users who already installed the skill can run `shitaku undo` or delete the installed skill directory. No agent or profile depends on the skill.

## Dependencies

- Existing `skills-install` capability and catalog docs generators.
- No external dependency.

## Review Workload Forecast

Expected authored change ~110-150 lines: ~60-90-line SKILL.md, a few catalog.json lines, ~20-40 test lines; generated README and website pages excluded. Single PR, two commits. 400-line budget risk: Low. Decision needed before apply: No. Chained PRs recommended: No.

## Success Criteria

- [ ] Bundled-catalog test lists 8 skills including `commit-writing` and passes (observed RED first)
- [ ] Content-contract test for `commit-writing` passes via `expectSkillContract`
- [ ] `pnpm run build` then `node dist/main.js init --skills commit-writing --scope project --dry-run` plans a `create` for the skill
- [ ] `docs:catalog:check` and the website catalog check pass
- [ ] SKILL.md has `name: commit-writing`, Trigger-style one-line `description` (<=250 chars), no `disable-model-invocation`
- [ ] SKILL.md states draft-only by default and `git commit` only on explicit user request
- [ ] SKILL.md covers conventions first, Conventional Commits format, why-focused body, `BREAKING CHANGE:` footer, atomic split proposals and no attribution trailers
- [ ] SKILL.md excludes pull request text, changelog or release notes, and code or test changes
- [ ] No `src/` changes; `CHANGELOG.md` untouched
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass

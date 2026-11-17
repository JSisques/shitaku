## Exploration: add-pr-writing-skill (issue #236)

**Verdict:** Catalog-only change. The bundled skill install path (byte-identical copy, `socratic-method` / `example-skill` pattern) already supports this. No `src/` changes required.

### Current State

#### Touch points

- New skill: `catalog/skills/pr-writing/SKILL.md`.
- Index: `catalog/catalog.json` → `items.skills` (today: `["example-skill", "socratic-method"]`).
- Guard test: `test/adapters/catalog/bundled-catalog.test.ts`: hardcoded list `['example-skill', 'socratic-method']`, dir entries, `toHaveLength(2)` (~lines 133-158).
- README: skills table (~lines 103-104), regenerated via `pnpm run docs:catalog`.
- Website: `website/src/content/docs/{en,es}/catalog/skills/pr-writing.md`, regenerated via `pnpm run docs:website-catalog`.

#### Repository conventions relevant to the skill content

- No `.github` PR template, no `CODEOWNERS`, and no docs-writing skill exist in this repository.
- commitlint uses `config-conventional`; types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- semantic-release uses the `conventionalcommits` preset on branch `main`; the squash-merge title is what drives the release, so the PR title matters.
- Issue templates auto-apply the `enhancement` label.
- CONTRIBUTING PR rules: target `main`, include `Closes #n`, keep PRs small, include tests and README updates.

#### Frontmatter constraints

- Single-line `name` (must match directory) and single-line `description` only; multi-line scalars are rejected.
- Omit `disable-model-invocation` so the skill stays model-invocable.

#### Reference layout

`socratic-method` uses: Activation Contract / Hard Rules / Decision Gates / Execution Steps / Output Contract, about 37 lines, with a `description` starting `Trigger: ...`.

### Approaches

1. **Single generic SKILL.md in the socratic-method layout** — one file, discovers repo metadata at run time, no shitaku-specific hardcoding.
   - Pros: minimal surface; reusable in any repository; matches existing catalog pattern.
   - Cons: quality of label/reviewer suggestions depends on what the target repo exposes.
   - Effort: Low.
2. **Skill plus bundled reference files** (e.g. a PR body template resource) — more structure, more files to maintain; not needed for the issue scope.

### Recommendation

Approach 1.

### Open Questions (at exploration time)

- Source of label vocabulary; reviewer/milestone handling when no CODEOWNERS exists; breaking-change `!` rule in the title; generic vs shitaku-specific scope. All were later settled by the user (see proposal).

### Limitations

`gh`/`git` could not be run during exploration, so the repository's real labels, milestones and reviewers were not verified.

### Ready for Proposal

Yes.

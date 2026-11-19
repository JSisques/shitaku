# Design: Add commit-writing Catalog Skill

## Technical Approach

Mirror the archived `add-test-writing-skill` change: one generic, tool-agnostic `catalog/skills/commit-writing/SKILL.md` with the same contract as `pr-writing`, `docs-writing`, `refactoring` and `test-writing` (two-key frontmatter, five fixed sections, Condition | Action Decision Gates table, numbered Execution Steps). No `src/` change: `FolderCatalogSource` and the `skills-install` byte-copy path already handle a new single-file skill once it is registered in `catalog/catalog.json`. Correctness is pinned by `test/adapters/catalog/bundled-catalog.test.ts` (registration, loadability, `files: ['SKILL.md']`, count 8) and by `expectSkillContract` (frontmatter shape, headings, load-bearing tokens, forbidden tokens). README and website pages are regenerated, never hand-edited.

Strict TDD order: RED (test edits only) -> GREEN (SKILL.md + catalog.json) -> format -> docs generators -> full gates -> build and dry-run install.

## Architecture Decisions

### Decision: Draft-only by default; commit only on explicit request

**Choice**: The skill drafts messages and proposes atomic splits. It stages, commits, amends or rewrites history only when the user explicitly asks. When a commit is requested and a split was proposed, the agent confirms the split before committing, then commits each atomic commit in order and never bypasses hooks.
**Alternatives considered**: Always commit after drafting (removes user control, conflicts with the user-owned delivery rule used across the catalog); never commit at all (forces a manual copy step even when the user asks).
**Rationale**: Matches `pr-writing` ("never create or edit the PR without explicit confirmation") and the spec requirement "Draft-only by default". Committing is a VCS side effect; it must be an explicit user decision.

### Decision: Single-file skill mirroring test-writing

**Choice**: Only `SKILL.md` in `catalog/skills/commit-writing/`, about 60-70 lines, same five sections.
**Alternatives considered**: A `references/` folder with type tables and message templates.
**Rationale**: Every bundled skill asserts `files: ['SKILL.md']`; the type list and message template are short enough to inline in Hard Rules.

### Decision: Description text (225 characters)

**Choice**:

```
Trigger: commit message, write a commit, split into atomic commits, conventional commit, breaking change. Draft Conventional Commits messages with a why-focused body and propose atomic splits; commit only on explicit request.
```

Manual count: `Trigger: ` 9, `commit message, ` 16 (25), `write a commit, ` 16 (41), `split into atomic commits, ` 27 (68), `conventional commit, ` 21 (89), `breaking change. ` 17 (106), `Draft ` 6 (112), `Conventional Commits ` 21 (133), `messages ` 9 (142), `with a ` 7 (149), `why-focused ` 12 (161), `body and ` 9 (170), `propose atomic splits; ` 23 (193), `commit only on explicit request.` 32 (225). No `'`, `"` or `|`; no contractions. Margin 25 characters; apply still rechecks via the contract test.
**Alternatives considered**: A `commit my changes` trigger (reads as an explicit commit request and blurs the draft-only default); listing every type in the description (exceeds the budget).
**Rationale**: Trigger phrases drive model invocation; the draft-only promise is stated in the description so the model does not expect the skill to commit silently.

### Decision: Attribution rule worded without the forbidden literal

**Choice**: Hard Rule `Never add co-author or AI attribution trailers.` No exception clause.
**Alternatives considered**: Allow human co-author trailers when supplied by the user (the `conventional-commits` rule allows them when the project asks); naming the trailer literally.
**Rationale**: The spec requirement "No attribution trailers" is unconditional, and the forbidden-token guard rejects the literal trailer name. A user who wants a human trailer can add it themselves; the skill stays simple and testable.

### Decision: Boundary with pr-writing and the conventional-commits rule

**Choice**: Activation Contract ends with `Not for pull request titles or descriptions, changelogs or release notes, or writing or changing code or tests.` A Decision Gate row redirects those requests. `catalog/rules/conventional-commits.md` is untouched; the skill complements it with depth (type choice, body, footers, split proposals).
**Alternatives considered**: Naming `pr-writing` by catalog name in the skill (couples skills; the test-writing design rejected the same coupling); editing the rule to point at the skill (out of scope).
**Rationale**: Mirrors `pr-writing`'s own `Not for commit messages, ...` line, so the two skills partition the space symmetrically.

### Decision: Contract-test tokens

**Choice**: Required tokens (exact substrings of `raw`): the spec's five (`Conventional Commits`, `BREAKING CHANGE:`, `atomic`, `why`, `Not for pull request`) plus three that pin the riskiest behaviors: `Repository conventions first`, `only on explicit request`, `attribution trailers`. Forbidden: `/shitaku/i`, `'Co-Authored-By'`.
**Alternatives considered**: Only the spec's five (leaves the draft-only and no-attribution rules unguarded; `why` alone is a weak substring); many prose fragments (brittle).
**Rationale**: The spec sets a minimum set; the extra three guard the consent and attribution rules, which carry the highest consequence if wording drifts. No tool-name guard (like test-writing's runner regex) because the skill legitimately names `git` and commit lint configuration generically.

### Decision: Two commits in one PR

**Choice**: `feat(catalog): add commit-writing skill` (SKILL.md, catalog.json, test) then `docs: list commit-writing skill in README and website` (generated files only).
**Alternatives considered**: One commit; chained PRs.
**Rationale**: Mirrors the archived `add-test-writing-skill`; authored diff ~110-150 lines, well under the 400-line budget, so `auto-chain` does not slice. `docs:catalog:check` runs in CI, not in hooks, so commit 1 passes `pre-push` alone; the PR is pushed after commit 2.

## Data Flow

    catalog/skills/commit-writing/SKILL.md ──┐
    catalog/catalog.json (items.skills) ─────┼──→ FolderCatalogSource.load() ──→ init --skills commit-writing (byte copy)
                                             │
                                             ├──→ scripts/generate-catalog-table.mjs ──→ README.md skills table
                                             └──→ scripts/generate-website-catalog.mjs ──→ website/.../{en,es}/catalog/skills/commit-writing.md

## File Changes

| File                                                           | Action             | Description                                                                           |
| -------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts`                | Modify             | Test name, both skill lists, count 8, `byName` block, new contract test (RED first)   |
| `catalog/skills/commit-writing/SKILL.md`                       | Create             | Skill content (outline below)                                                         |
| `catalog/catalog.json`                                         | Modify             | Insert `"commit-writing"` as the first `items.skills` entry (before `"docs-writing"`) |
| `README.md`                                                    | Modify (generated) | Skills table row via `pnpm run docs:catalog`                                          |
| `website/src/content/docs/en/catalog/skills/commit-writing.md` | Create (generated) | `pnpm run docs:website-catalog`                                                       |
| `website/src/content/docs/es/catalog/skills/commit-writing.md` | Create (generated) | Same generator                                                                        |

No `src/`, profile, agent, rule, CONTRIBUTING or CHANGELOG change.

## Interfaces / Contracts

### SKILL.md outline (target text; apply may polish wording but must keep every required token)

```markdown
---
name: commit-writing
description: '<225-char description above>'
---

## Activation Contract

Use when asked to write, draft, or improve a commit message, choose a commit type or scope, mark a breaking change, or split pending changes into atomic commits. Not for pull request titles or descriptions, changelogs or release notes, or writing or changing code or tests.

## Hard Rules

- Draft only: present messages and split proposals; stage, commit, amend, or rewrite history only on explicit request from the user.
- Repository conventions first: inspect recent history, commit lint configuration, contributing guides, and allowed types and scopes; they win over the defaults in this skill.
- Use Conventional Commits: `type(scope)?: subject`. Default types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- Choose the type by intent, not by the files touched; omit the scope rather than invent one.
- Subject: imperative mood, lowercase, no trailing period, within the header limit (default 100, aim for 72).
- Body explains why: motivation, context, and tradeoffs, not a restatement of the diff. Wrap lines at 72 characters; omit the body when the subject says it all.
- Footers: reference issues (for example `Closes #<n>`); for a breaking change add `!` before the colon and a `BREAKING CHANGE: <what breaks and how to migrate>` footer.
- Keep commits atomic: one logical change per commit, with its tests and docs. Every commit should build and pass on its own.
- Never add co-author or AI attribution trailers.
- Never skip or bypass commit hooks; fix the cause of a failing hook.
- Stay generic: do not assume any repository-specific type, scope, or tool.

## Decision Gates

| Condition                                                        | Action                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The repository has a commit lint config or documented convention | Follow it over the defaults in this skill                                      |
| No convention is found                                           | Use the Conventional Commits defaults above                                    |
| Pending changes mix unrelated concerns                           | Propose an atomic split: files or hunks per commit, in order, one message each |
| Pending changes form one logical change                          | Draft a single message; keep tests and docs in it                              |
| Both staged and unstaged changes exist                           | Draft for the staged changes; list the unstaged ones separately                |
| There are no pending changes                                     | Stop and report that there is nothing to commit                                |
| A public behavior is removed or changed incompatibly             | Add `!` and a `BREAKING CHANGE:` footer; ask when unsure                       |
| The user explicitly asks to commit                               | Confirm any split, then commit each atomic commit in order                     |
| A commit hook fails                                              | Report it and fix the cause; never bypass the hook                             |
| The request is pull request text, a changelog, or release notes  | Out of scope; leave it to the matching workflow                                |

## Execution Steps

1. Read the conventions: commit lint config, contributing guide, and recent `git log --oneline`.
2. Inspect the pending changes: `git status`, `git diff --staged`, and `git diff`.
3. Group the changes into logical units and decide whether an atomic split is needed.
4. For each commit, choose the type and scope, then write the subject.
5. Write the body (why) and footers (issues, breaking change) when they add information.
6. Check every draft against the hard rules and the repository conventions.
7. Present the drafts and the split; commit only on explicit request, then report the result.

## Output Contract

Return each drafted message in a code block, in commit order, with the files or hunks it covers; the conventions applied and their source; any breaking change and its migration note; unstaged or excluded changes; and open questions. When committing was requested, also return the created commit identifiers and any hook output.
```

Body ~60 lines, within the spec's 60-90. The Decision Gates table is shown unaligned; `pnpm run format` aligns it. Token check against the outline: `Repository conventions first` (Hard Rules), `Conventional Commits` (description and Hard Rules), `why` (description, `Body explains why`), `BREAKING CHANGE:` (Hard Rules and gates), `atomic` (multiple), `only on explicit request` (description, Hard Rules, step 7), `attribution trailers` (Hard Rules), `Not for pull request` (Activation Contract). Neither `shitaku` nor the literal trailer name appears.

### Test edits (`test/adapters/catalog/bundled-catalog.test.ts`)

1. Rename the registration test to `ships commit-writing, docs-writing, example-skill, pr-writing, product-owner, refactoring, socratic-method and test-writing as registered loadable bundled skills`.
2. Prepend `'commit-writing'` to both exact lists (`index.items.skills` and the sorted `readdirSync` entries).
3. `expect(catalog.skills).toHaveLength(8);`
4. Before the `docs-writing` `byName` block:

```ts
expect(byName['commit-writing']).toMatchObject({ name: 'commit-writing' });
expect(byName['commit-writing']?.description.length).toBeGreaterThan(0);
expect(byName['commit-writing']?.files.map((f) => f.path)).toEqual(['SKILL.md']);
```

5. New test after `keeps the test-writing skill content contract`:

```ts
it('keeps the commit-writing skill content contract', () => {
  expectSkillContract('commit-writing', {
    required: [
      'Repository conventions first',
      'Conventional Commits',
      'why',
      'BREAKING CHANGE:',
      'atomic',
      'only on explicit request',
      'attribution trailers',
      'Not for pull request',
    ],
    forbidden: [/shitaku/i, 'Co-Authored-By'],
  });
});
```

Expected RED: list and count assertions fail (7 skills, missing entry) and `expectSkillContract` throws ENOENT on the missing SKILL.md.

### catalog.json edit

Insert `"commit-writing"` before `"docs-writing"` in `items.skills` (alphabetical, first entry); the array is already multi-line. Run `pnpm run format`. No other key changes.

### Command sequence

```sh
pnpm test                          # RED observed after test edits
# add SKILL.md + catalog.json entry
pnpm run format
pnpm test                          # GREEN
# commit 1: feat(catalog): add commit-writing skill
pnpm run docs:catalog
pnpm run docs:website-catalog
pnpm run docs:catalog:check
pnpm run docs:website-catalog:check
pnpm run typecheck && pnpm run lint && pnpm run format:check
pnpm run build && node dist/main.js init --skills commit-writing --scope project --dry-run   # expect a create
# commit 2: docs: list commit-writing skill in README and website
```

## Testing Strategy

| Layer            | What to Test                                                                           | Approach                                                           |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Unit / adapter   | Registration, loadability, `files: ['SKILL.md']`, count 8                              | Extend existing bundled-catalog test (RED first)                   |
| Content contract | Frontmatter shape, 250-char description, headings, 8 required tokens, forbidden tokens | `expectSkillContract('commit-writing', ...)`                       |
| Repo checks      | README and website drift                                                               | `docs:catalog:check`, `docs:website-catalog:check`                 |
| Smoke            | Install plan                                                                           | Built CLI `init --skills commit-writing --scope project --dry-run` |
| E2E              | N/A                                                                                    | Not configured in this project                                     |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in shitaku code. The change adds static catalog data and a test. The skill text tells an agent how to use `git`, but that behavior is guarded by the draft-only Hard Rule, the explicit-request Decision Gate and the `only on explicit request` contract token, not by product code.

## Migration / Rollout

No migration required. Skill is opt-in via `init --skills commit-writing`; not added to any profile or agent.

## Open Questions

None blocking.

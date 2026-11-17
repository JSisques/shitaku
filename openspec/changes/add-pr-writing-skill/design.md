# Design: Add pr-writing Catalog Skill

## Technical Approach

Catalog-only change (exploration Approach 1, proposal "Approach"). One generic `catalog/skills/pr-writing/SKILL.md` in the `socratic-method` layout, registered in `catalog/catalog.json`, guarded by `test/adapters/catalog/bundled-catalog.test.ts`, and surfaced through the two existing docs generators. No `src/` change: the bundled skill path is already a byte-identical copy (`FolderCatalogSource` loads it, `parseSkill` in `src/domain/catalog/skill.ts` validates `name` against the directory and a non-empty `description`).

The skill is the product. Its design is a contract the agent follows at run time in any repository: inspect the change, discover repository conventions, draft a Conventional Commits title plus a structured body, and present labels, reviewers and milestone only as discovered suggestions for the user to confirm.

## Architecture Decisions

### Decision: Single file, socratic-method section layout

**Choice**: One `SKILL.md` with sections Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract (target 45-65 lines).
**Alternatives considered**: Skill plus a bundled body-template resource (exploration Approach 2); a free-form prose skill.
**Rationale**: Matches the only real catalog precedent, keeps the install a one-file copy (`files: ['SKILL.md']`, already asserted for the other skills), and keeps review surface small. A separate template file would duplicate the body outline and would be ignored whenever the target repo has its own PR template.

### Decision: Frontmatter is two single-line, single-quoted scalars

**Choice**:

```yaml
---
name: pr-writing
description: 'Trigger: write PR, pull request title, PR description, open a PR. Draft a Conventional Commits PR title and body; suggest only labels, reviewers and milestone discovered in the repository.'
---
```

(about 190 characters, under the 250 limit). No `disable-model-invocation`, no other keys.
**Alternatives considered**: Unquoted value; double quotes; multi-line `>` scalar; extra keys (`license`, `metadata`).
**Rationale**: `readFrontmatter` rejects multi-line and empty values. Both `unquote` (domain) and the generators' `frontmatterDescription` strip one matching outer quote pair but do NOT unescape `''` or `\"`, so the description MUST contain no apostrophe, no double quote and no `|` (README table cell). Single quotes match `socratic-method` and survive Prettier. Commas and colons inside a quoted scalar are safe. Omitting `disable-model-invocation` is a settled decision so the agent can auto-activate on PR requests.

### Decision: Discover, never invent; every metadata item carries its source

**Choice**: Labels, reviewers, milestone and linked issue are emitted only when backed by a concrete source (command output or file). Each suggestion names its source. Anything not discoverable is listed under "Not discovered" and either omitted or asked about. Nothing is applied without explicit user confirmation.
**Alternatives considered**: Heuristic defaults (for example `enhancement` for every `feat`); shitaku-specific label lists.
**Rationale**: Settled decision; invented labels or reviewers are the main failure mode the issue targets, and a generic skill cannot know any repository's vocabulary.

### Decision: Discovery order with `gh`-optional fallbacks

**Choice**: Discovery sources and fallbacks the skill prescribes:

| Item              | Primary source                                                                                    | Fallback when unavailable                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Base branch       | `gh repo view --json defaultBranchRef`, else `git symbolic-ref refs/remotes/origin/HEAD`          | Ask the user                                                                |
| Change content    | `git log --oneline <base>..HEAD`, `git diff --stat <base>...HEAD`                                 | Ask the user to describe the change                                         |
| PR template       | `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/`, root or `docs/` (any case)  | Default body outline                                                        |
| Commit convention | commitlint config (`commitlint.config.*`, `.commitlintrc*`, `package.json#commitlint`), `git log` | `config-conventional` types; scope only if recent history uses scopes       |
| Linked issue      | Branch name, commit messages, user statement; `gh issue view <n> --json labels,milestone`         | Omit `Closes #`; ask if an issue is expected                                |
| Labels            | `gh label list --limit 200 --json name,description`; labels on the linked issue                   | Omit; report "labels not discovered (gh unavailable)"                       |
| Reviewers         | `CODEOWNERS` (`.github/`, root, `docs/`) matched against changed paths, last match wins           | Recent authors of touched files from `git log`, shown as names, not handles |
| Milestone         | Linked issue milestone; open milestones via `gh api repos/{owner}/{repo}/milestones`              | Omit; never create or guess a milestone                                     |

**Alternatives considered**: Require `gh`; use the GitHub MCP server.
**Rationale**: `gh` may be missing or unauthenticated (proposal risk). `git` and files cover title, body and CODEOWNERS without network. The skill stays tool-agnostic by naming `gh` as the primary probe while permitting any equivalent authenticated GitHub tool already available to the agent. Git history yields names and emails, not GitHub handles, so the skill must never convert an email into a handle; it presents candidates and asks.

### Decision: Breaking changes use both `!` and a `BREAKING CHANGE:` footer

**Choice**: When commits contain `!` or a `BREAKING CHANGE` footer, or the diff removes or renames public behavior, the title becomes `type(scope)!: subject` and the body ends with `BREAKING CHANGE: <what breaks and how to migrate>`. If breaking status is uncertain, ask; never silently downgrade.
**Alternatives considered**: Footer only; `!` only.
**Rationale**: With squash merge the PR title becomes the commit header, so `!` reliably reaches semantic-release (`conventionalcommits` preset). Whether the PR body reaches the squash commit body depends on repository settings, so the footer is complementary documentation, not the sole signal.

### Decision: Title rules derive from the repository, defaulting to config-conventional

**Choice**: `type(scope)?: subject`, lowercase type from the discovered commitlint types (default: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert), imperative lowercase subject, no trailing period, within the configured header max length (default 100; aim for 72). For mixed changes pick the type with the highest release impact (breaking, then feat, then fix, then others).
**Alternatives considered**: Free-form titles; always `feat`.
**Rationale**: The squash title drives versioning; a wrong type means a wrong release bump.

### Decision: Draft only; PR creation needs explicit confirmation

**Choice**: The skill outputs title, body and suggestions. It may offer a `gh pr create --title ... --body-file ...` (or `gh pr edit`) command, run only after the user confirms the final text and metadata.
**Alternatives considered**: Auto-create the PR.
**Rationale**: Proposal out-of-scope item; creating PRs is a remote mutation that requires user authorization.

### Decision: Test assertions guard registration and the content contract

**Choice**: Extend the existing skill test in `bundled-catalog.test.ts` (rename to cover three skills) and add one focused test reading `catalog/skills/pr-writing/SKILL.md` raw.
**Alternatives considered**: Registration-only assertions; snapshot of the whole file.
**Rationale**: Registration alone does not prove the success criteria about frontmatter and required rules. A snapshot would make every wording tweak a test churn. Targeted substring and frontmatter assertions are stable and fail meaningfully.

## SKILL.md Section Outline

| Section             | Content                                                                                                                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activation Contract | Use when asked to write, draft, improve or open a pull request title or description. Not for commit messages, changelogs or release notes.                                                                                                                                                      |
| Hard Rules          | Conventional Commits title; breaking = `!` plus `BREAKING CHANGE:` footer; follow an existing PR template; never invent labels, reviewers, milestones or issue numbers; cite the source of each suggestion; never apply metadata or create/edit the PR without confirmation; stay repo-generic. |
| Decision Gates      | Table (below).                                                                                                                                                                                                                                                                                  |
| Execution Steps     | 1 find base and inspect commits/diff; 2 read PR template and commit convention; 3 detect breaking change and linked issue; 4 draft title; 5 draft body; 6 discover metadata; 7 present and wait for confirmation.                                                                               |
| Output Contract     | Title (code block), body (Markdown), "Suggested metadata" with source per item, "Not discovered" list, open questions; optional create command only after confirmation.                                                                                                                         |

Decision Gates table content:

| Condition                           | Action                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Repository has a PR template        | Fill its sections in order; do not replace it with the default outline       |
| No PR template                      | Use Summary, Changes, How to test, then `Closes #<n>` when an issue is known |
| Change is breaking or uncertain     | Add `!` and the `BREAKING CHANGE:` footer; ask if uncertain                  |
| No `CODEOWNERS` match               | Do not invent reviewers; offer git-history candidates by name or ask         |
| `gh` unavailable or unauthenticated | Skip labels and milestones; list them under "Not discovered"                 |
| No linked issue found               | Omit `Closes #`; ask whether one exists                                      |
| User asks to open the PR            | Show the final command and run it only after explicit confirmation           |

Topics are not mentioned (GitHub PRs have none; settled).

## Data Flow

    user request ──→ agent activates pr-writing
                          │
        git log/diff ─────┼──→ type, scope, breaking?, subject
        PR template ──────┼──→ body structure
        commitlint cfg ───┼──→ allowed types / scopes / max length
        gh / CODEOWNERS ──┼──→ labels, reviewers, milestone (sourced) or "Not discovered"
                          ▼
             draft title + body + suggestions ──→ user confirms ──→ (optional) gh pr create/edit

Install-time flow is unchanged: `catalog.json` → `FolderCatalogSource` → `parseSkill` → byte copy to the agent skills dir.

## File Changes

| File                                                       | Action | Description                                                            |
| ---------------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts`            | Modify | Three skills in index, dir entries and load; new content-contract test |
| `catalog/skills/pr-writing/SKILL.md`                       | Create | Skill frontmatter and body per outline above                           |
| `catalog/catalog.json`                                     | Modify | `items.skills`: `["example-skill", "pr-writing", "socratic-method"]`   |
| `README.md`                                                | Modify | Skills table, generated by `pnpm run docs:catalog`                     |
| `website/src/content/docs/en/catalog/skills/pr-writing.md` | Create | Generated by `pnpm run docs:website-catalog`                           |
| `website/src/content/docs/es/catalog/skills/pr-writing.md` | Create | Generated by `pnpm run docs:website-catalog`                           |

`items.skills` keeps alphabetical order, matching the sorted `readdirSync` assertion and the README generator, which sorts anyway.

## Interfaces / Contracts

No TypeScript interface changes. The contract is the skill frontmatter (above) and the loaded catalog entry:

```ts
// existing shape from src/domain/catalog/skill.ts
{ name: 'pr-writing', description: '<Trigger: ...>', files: [{ path: 'SKILL.md', ... }] }
```

## Testing Strategy

Strict TDD, runner `pnpm test` (Vitest).

| Layer       | What to test                                                                                                                                                                                                                                                                               | Approach                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Unit (RED)  | `items.skills` equals `['example-skill', 'pr-writing', 'socratic-method']`; skills dir entries equal the same; `catalog.skills` length 3; `pr-writing` loads with `files` `['SKILL.md']` and no issues                                                                                     | Edit existing test in `bundled-catalog.test.ts`; observe failure                                     |
| Unit (RED)  | Raw SKILL.md: frontmatter lines are exactly `name: pr-writing` and a single-line `description:` starting `'Trigger:`; unquoted length <= 250; no `disable-model-invocation`; contains the five section headings, `BREAKING CHANGE:`, `Closes #`, `CODEOWNERS`, `gh label list`; no `topic` | New `it` in the same file, `readFileSync` on the skill                                               |
| Integration | `init --skills pr-writing --dry-run` plans `create`                                                                                                                                                                                                                                        | Manual check at verify time; existing `program.test.ts` covers the generic path with `example-skill` |
| Docs        | README and website in sync                                                                                                                                                                                                                                                                 | `pnpm run docs:catalog:check`, `pnpm run docs:website-catalog:check`                                 |

Full gate: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`. Generator drift is CI-only (`ci.yml` runs `docs:catalog:check`; `website.yml` the website check); `test/generators.test.ts` uses a sandboxed catalog, so it is unaffected.

## Task Ordering and Commit Slicing

1. RED: update `bundled-catalog.test.ts` (both tests); run `pnpm test`, record failure.
2. GREEN: create `SKILL.md`, add the `catalog.json` entry; `pnpm test` passes.
3. Run `pnpm run format`/`format:check` and `lint` on touched files.
4. Commit `feat(catalog): add pr-writing skill` (test, skill, index).
5. Regenerate docs (`docs:catalog`, `docs:website-catalog`), run both `:check` scripts, commit `docs: list pr-writing skill in README and website`.

Single PR, well under 400 authored lines (generated docs excluded).

## Threat Matrix

The skill text tells an agent to run `git` and `gh` commands at run time, but this change adds no shitaku code that routes, spawns processes or automates VCS/PR operations. Mitigation for the PR-command boundary lives in the skill's Hard Rules (draft only, confirm before `gh pr create`/`edit`) and is guarded by the content-contract test, not by process tests.

| Boundary                 | Applicability                                     | Design response                         | Planned RED tests |
| ------------------------ | ------------------------------------------------- | --------------------------------------- | ----------------- |
| Documentation-like paths | N/A: no file classification or execution added    | None                                    | None              |
| Git repository selection | N/A: shitaku runs no git commands for this change | None                                    | None              |
| Commit state             | N/A: no commit automation                         | None                                    | None              |
| Push state               | N/A: no push automation                           | None                                    | None              |
| PR commands              | N/A for code: no command composition in shitaku   | Skill Hard Rule: confirm before running | None              |

## Migration / Rollout

No migration required. Existing installs are unaffected; users opt in with `shitaku init --skills pr-writing`.

## Open Questions

- [ ] Issue #236 acceptance criteria still mention topics; update the issue when opening the PR (non-blocking).

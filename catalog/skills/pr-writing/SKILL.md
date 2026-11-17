---
name: pr-writing
description: 'Trigger: write PR, pull request title, PR description, open a PR. Draft a Conventional Commits PR title and body; suggest only labels, reviewers and milestone discovered in the repository.'
---

## Activation Contract

Use when asked to write, draft, improve, or open a pull request title or description. Not for commit messages, changelogs, or release notes.

## Hard Rules

- Title is Conventional Commits: `type(scope)?: subject`. Take the allowed types from the repository commitlint config; default to feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- Breaking change: put `!` before the colon and end the body with a `BREAKING CHANGE: <what breaks and how to migrate>` footer.
- If the repository has a PR template, follow its structure instead of the default outline.
- Never invent labels, reviewers, milestones, or issue numbers. Suggest only values discovered from a concrete source, and name that source for each one.
- Present all metadata as suggestions for the user to confirm. Never apply it, and never create or edit the PR without explicit confirmation.
- Stay generic: do not assume any repository-specific label, reviewer, or milestone names.

## Decision Gates

| Condition                           | Action                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Repository has a PR template        | Fill its sections in order; do not replace it with the default outline       |
| No PR template                      | Use Summary, Changes, How to test, then `Closes #<n>` when an issue is known |
| Change is breaking or uncertain     | Add `!` and the `BREAKING CHANGE:` footer; ask if uncertain                  |
| No `CODEOWNERS` match               | Do not invent reviewers; offer git-history candidates by name or ask         |
| `gh` unavailable or unauthenticated | Skip labels and milestone; list them under "Not discovered"                  |
| No linked issue found               | Omit `Closes #`; ask whether one exists                                      |
| User asks to open the PR            | Show the final command and run it only after explicit confirmation           |

## Execution Steps

1. Find the base branch (`gh repo view --json defaultBranchRef`, else `git symbolic-ref refs/remotes/origin/HEAD`) and inspect `git log --oneline <base>..HEAD` and `git diff --stat <base>...HEAD`.
2. Read the PR template (`.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/`, root or `docs/`) and the commit convention (commitlint config, recent `git log`).
3. Detect a breaking change (`!`, `BREAKING CHANGE`, removed or renamed public behavior) and a linked issue (branch name, commits, user statement).
4. Draft the title: lowercase type, imperative lowercase subject, no trailing period, within the header length limit (default 100, aim for 72). For mixed changes use the highest release impact: breaking, then feat, then fix, then others.
5. Draft a concise body: Summary, Changes, How to test, and `Closes #<n>` only when the issue is known.
6. Discover metadata: labels via `gh label list --limit 200 --json name,description` or the linked issue; reviewers via `CODEOWNERS` (`.github/`, root, `docs/`; last matching rule wins), else recent authors of touched files as names, never converted into handles; milestone from the linked issue or open milestones. Never create or guess one.
7. Present the draft and wait for the user to confirm or edit before any `gh pr create` or `gh pr edit`.

## Output Contract

Return: the title in a code block, the body in Markdown, a "Suggested metadata" block with the source of each item, a "Not discovered" list, and any open questions. Offer the create or edit command only after the user confirms the final text and metadata.

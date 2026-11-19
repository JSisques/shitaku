---
name: commit-writing
description: 'Trigger: commit message, write a commit, split into atomic commits, conventional commit, breaking change. Draft Conventional Commits messages with a why-focused body and propose atomic splits; commit only on explicit request.'
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

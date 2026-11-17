# Archive Report: add-pr-writing-skill

## Summary

Change `add-pr-writing-skill` (issue #236, PR #254) adds the bundled catalog skill `pr-writing`: a single generic English skill that drafts a pull request title (Conventional Commits, with `!` and a `BREAKING CHANGE:` footer for breaking changes) and a concise structured body (summary, changes, how to test, `Closes #<n>` only when the issue is known), and suggests metadata (labels, reviewers, milestone) discovered from the target repository and never invented. It is model-invocable, installable through the existing skills-install, and touches only catalog data, tests and regenerated docs; `src/` is unchanged.

## Final State at Close

Final-state facts from the orchestrator launch prompt outrank the intermediate snapshots `apply-progress.md` and `verify-report.md`.

| Field    | Value                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verdict  | PASS at verification time (0 CRITICAL, 0 WARNING, 2 SUGGESTION), per `verify-report.md`                                                              |
| Suggestions | Both resolved: (1) spec "Bundled load succeeds" order aligned to alphabetical in commit `b7423e7`; (2) intermediate commit `5e0b285` fails the website drift test until `64acdb7` lands; harmless because the PR is squash-merged |
| Tasks    | 15/15 complete in `tasks.md` (archived byte-for-byte). Task 5.3 is done: the issue #236 body no longer mentions topics                                |
| Tests    | 1460 tests passed at verification time (`pnpm test`, per `verify-report.md`); no later test-count change was reported                                  |
| Commits  | `5e0b285` (feat catalog skill), `64acdb7` (docs: README and website), `7c410ca` (openspec change artifacts), `b7423e7` (spec order and task 5.3)        |
| Delivery | PR #254 open, not yet merged. Push and PR are owned by the orchestrator and ordinary repository policy                                             |
| Unfinished | None observed in `tasks.md`                                                                                                                         |

## Artifacts Read

Hybrid mode: artifacts were read from their openspec locators. No Engram observation was retrieved, so no observation IDs are recorded for this archive.

- `openspec/changes/add-pr-writing-skill/proposal.md`: present
- `openspec/changes/add-pr-writing-skill/specs/pr-writing-skill/spec.md`: present (delta, full spec, 15 requirements)
- `openspec/changes/add-pr-writing-skill/design.md`: present
- `openspec/changes/add-pr-writing-skill/tasks.md`: present, 15/15 complete
- `openspec/changes/add-pr-writing-skill/verify-report.md`: present (intermediate snapshot)
- `openspec/changes/add-pr-writing-skill/apply-progress.md` and `exploration.md`: present (archived with the change, not used as final-state source)

## Specs Synced

No main spec existed for this capability, so the delta was a full spec and was copied mechanically with `cp` (no merge needed).

| Domain             | Action  | Details                                                                                       |
| ------------------ | ------- | --------------------------------------------------------------------------------------------- |
| `pr-writing-skill` | Created | New main spec `openspec/specs/pr-writing-skill/spec.md` (Purpose plus 15 requirements, identical to the delta) |

## Archive Move

- Source: `openspec/changes/add-pr-writing-skill`
- Destination: `openspec/changes/archive/2026-11-17-add-pr-writing-skill`
- Method: `git mv` (whole folder, including exploration, proposal, specs, design, tasks, apply-progress, verify-report and this report)
- Naming: date prefix is the archive day, as in earlier archives

## Mechanical Readback (diff -r)

Verbatim output of the mandatory readbacks. An empty diff is the only passing evidence.

- Spec sync (`openspec/changes/add-pr-writing-skill/specs/pr-writing-skill/spec.md` vs `openspec/specs/pr-writing-skill/spec.md`): `diff_status=0`, no output
- Archive move (pre-move recursive snapshot vs `openspec/changes/archive/2026-11-17-add-pr-writing-skill`): `diff_status=0`, no output
- Staged move confirmed by `git diff --cached -M --summary`: seven renames, each `(100%)`, from `openspec/changes/add-pr-writing-skill/` to `openspec/changes/archive/2026-11-17-add-pr-writing-skill/`

This archive-report is additive and excluded from the comparison because it did not exist in the source change folder.

## Active Changes

`openspec/changes/add-pr-writing-skill` no longer exists; the change is closed.

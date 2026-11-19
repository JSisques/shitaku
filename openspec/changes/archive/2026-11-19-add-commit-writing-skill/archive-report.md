# Archive Report: add-commit-writing-skill

**Date**: 2026-11-19
**Store**: hybrid (openspec + Engram project `shitaku`)
**Archived to**: `openspec/changes/archive/2026-11-19-add-commit-writing-skill/`

## Final State at Close

The change is closed. Implementation is committed on branch `worktree-feat-commit-writing-skill` (not pushed):

- `8ee76e0` `feat(catalog): add commit-writing skill`
- `8d67f7d` `docs: list commit-writing skill in README and website`

Tasks: 21 of 21 checked in `tasks.md` (the persisted tasks artifact, the highest-ranked source). 0 unfinished.

Verification: the `verify-report` snapshot (Engram observation #1785, written at verification time) reported PASS with 0 CRITICAL, 0 WARNING, 2 SUGGESTION. Per the explicit final-state facts in the archive launch prompt, no finding is open as a blocker.

- SUGGESTION (SKILL.md length): the verify snapshot records 51 lines, below the spec's SHOULD of about 60-90 lines. Re-counted at archive time: still 51 lines. Open, non-blocking. The spec uses SHOULD, not MUST.
- SUGGESTION (contract test tokens): the contract test requires 3 tokens beyond the spec's minimum list (`Repository conventions first`, `only on explicit request`, `attribution trailers`). Accepted as stricter than the spec, not a defect.

Final numbers (launch prompt, consistent with the verify snapshot): `pnpm test` 2572 passed, 1 skipped. Verify snapshot also recorded `docs:catalog:check` and `docs:website-catalog:check` passing.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `commit-writing-skill` | Created | `openspec/specs/commit-writing-skill/spec.md`, 11 requirements (no main spec existed; the delta was copied as the full spec, matching the `test-writing-skill` and `refactoring-skill` precedent) |

## Artifact Traceability (Engram observation IDs)

| Artifact | Engram topic key | Observation ID | File locator |
|----------|------------------|----------------|--------------|
| proposal | `sdd/add-commit-writing-skill/proposal` | not retrieved from Engram (hybrid: file locator read) | `proposal.md` |
| spec | `sdd/add-commit-writing-skill/spec` | not retrieved from Engram (hybrid: file locator read) | `specs/commit-writing-skill/spec.md` |
| design | `sdd/add-commit-writing-skill/design` | not retrieved from Engram (hybrid: file locator read) | `design.md` |
| tasks | `sdd/add-commit-writing-skill/tasks` | not retrieved from Engram (hybrid: file locator read) | `tasks.md` |
| verify-report | `sdd/add-commit-writing-skill/verify-report` | #1785 (read via `mem_get_observation`) | not written to openspec (Engram-only snapshot) |

## Archive Contents

- proposal.md: present
- specs/: present (`specs/commit-writing-skill/spec.md`)
- design.md: present
- tasks.md: present, 21/21 complete, 0 unfinished
- explore.md: present (not listed in the archive launch prompt; preserved as part of the folder)
- verify-report.md: not present in the change folder (verify report exists in Engram only, observation #1785)
- archive-report.md: this file (additive, not part of the pre-move snapshot)

## Unresolved Findings

- SUGGESTION from verify: SKILL.md is 51 lines, below the spec's SHOULD of about 60-90 lines. Open, non-blocking.
- SUGGESTION from verify: contract test requires tokens stricter than the spec's list. Accepted.
- No CRITICAL or WARNING findings.
- Metadata discrepancy: Engram observation #1785 carries `Project: dotagent` in its metadata while its `project_path` is the shitaku repository. The content refers to this change only; recorded for traceability, not treated as a finding about the change.

## Delivery

Commits are not pushed. The archive phase did not stage or commit anything; the orchestrator commits the new main spec, the archived folder and this report. Delivery follows ordinary repository policy and remains a separate decision.

## Readback Evidence

Main spec sync (mechanical `cp` of the delta into a temporary file, `diff -r`, then `mv` into place), followed by a readback of the promoted file:

```
(empty output, exit 0)
```

Archive move: the change folder is untracked, so `git mv` refused (exit 128, "source directory is empty") and a plain `mv` was used after a recursive pre-move snapshot and a source-unchanged check. Readback `diff -r <pre-move snapshot> openspec/changes/archive/2026-11-19-add-commit-writing-skill`:

```
(empty output, exit 0)
```

The active `openspec/changes/add-commit-writing-skill/` no longer exists.

## Risks

- The new main spec, the archived folder and this report are untracked files. The orchestrator commits them.
- The SKILL.md length SUGGESTION remains open as a SHOULD-level deviation.

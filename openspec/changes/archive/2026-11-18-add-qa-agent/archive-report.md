# Archive Report: add-qa-agent

**Change**: add-qa-agent (issue #44; PR #323 uses `Refs #44`, does not close the issue)
**Date archived**: 2026-11-18
**Archived to**: `openspec/changes/archive/2026-11-18-add-qa-agent/`
**Store**: hybrid (OpenSpec files + Engram, project `shitaku`)
**Branch**: `docs/archive-add-qa-agent`, stacked on `feat/qa-agent` (PR #323)

## Artifact Lineage (Engram Observation IDs)

| Artifact | Engram topic | Observation ID | Read in full this phase | Archived file |
| --- | --- | --- | --- | --- |
| Proposal | `sdd/add-qa-agent/proposal` | 1723 | Yes (observation) | `proposal.md` |
| Specs | `sdd/add-qa-agent/spec` | 1725 | Yes (observation and file) | `specs/qa-agent/spec.md` |
| Design | `sdd/add-qa-agent/design` | 1727 | Yes (observation; file archived byte-identical, not read in this phase) | `design.md` |
| Tasks | `sdd/add-qa-agent/tasks` | 1729 | Yes (observation and file) | `tasks.md` |
| Verify-report | `sdd/add-qa-agent/verify-report` | 1737 | Yes (observation and file) | `verify-report.md` |
| Apply-progress | `sdd/add-qa-agent/apply-progress` | 1734 | No (search preview only) | not present in folder |
| Exploration | `sdd/add-qa-agent/explore` | 1715 | No (not in the archive locator set) | `exploration.md` |

Other related observations, not read: `sdd/add-qa-agent/state` (1717, "apply done, 2 commits", written before the verify step; superseded by the final-state facts below), `sdd/add-qa-agent/product-decisions` (1720).

## Specs Synced

| Domain | Action | Details |
| --- | --- | --- |
| `qa-agent` | Created (mechanical `cp`, no prior main spec) | Full capability: 16 requirements, 34 scenarios (file count; observation 1725 estimated 38) |

No existing main spec was modified, so no `sdd-archive-compose` run was needed. The delta spec was copied byte-for-byte to `openspec/specs/qa-agent/spec.md` and the copy was not normalized.

## Archive Contents

- `proposal.md`: present
- `specs/qa-agent/spec.md`: present
- `design.md`: present
- `exploration.md`: present
- `tasks.md`: present, 20 of 21 checkboxes checked; 1 unchecked (5.4, optional manual Playwright runtime check, not automated)
- `verify-report.md`: present (written at verification time)
- `apply-progress.md`: missing (apply progress lives only in Engram, observation 1734)
- `archive-report.md`: this file (additive; not part of the source snapshot)

## Final-State Facts

Per the orchestrator launch prompt (rank 2 in the Final-State Authority hierarchy). Repository evidence was checked where possible.

- Commits on the branch: `e71de09` `feat(catalog): add qa agent`; `e256c40` `docs: list qa agent in README and website`; `ef413d6` `docs(openspec): add add-qa-agent change`. Repository evidence: `git log` shows all three.
- PR #323 is open with `Refs #44`, not `Closes`. Not re-verified against GitHub in this phase.
- Verify-report SUGGESTION findings (stale `browser_run_code` wording in spec, design and proposal) were fixed in `ef413d6`. Repository evidence: `rg` shows `browser_run_code_unsafe` now listed next to `browser_run_code` in `openspec/changes/archive/2026-11-18-add-qa-agent/specs/qa-agent/spec.md` (line 48), `design.md` (lines 21 and 281), and `proposal.md` (line 61). The forbidden list in `test/adapters/catalog/bundled-catalog.test.ts` (lines 490-491) names both.
- Task 5.4 (optional manual Playwright MCP runtime check) was not run. It is the only unchecked task.
- Full gates: 1959 tests pass (launch prompt). This phase did not re-run `pnpm test`.

## Verification Status

Source: verify-report, Engram observation 1737 and file `verify-report.md`, written at verification time. Statements below are historical unless the final-state facts above say otherwise.

- At verification time: Verdict PASS. CRITICAL 0, WARNING 0, SUGGESTION 2. Typecheck, lint, format:check, build, docs:catalog:check and docs:website-catalog:check passed; tests 1959 passed (67 files).
- At verification time the two SUGGESTION findings were open. Final state: fixed in `ef413d6` (see Final-State Facts). Attributed to `verify-report`, observation 1737.
- Verification was not blocking archive.

## Unfinished Work (not ticked, not repaired)

The archived `tasks.md` is byte-identical to the source. Its checkboxes were not edited.

- **5.4 UNCHECKED, NOT RUN**: optional manual runtime check in a scratch project with the `playwright` MCP installed. The nine Playwright tools' grant at runtime and the stop-and-ask behavior with no file written were not observed.

## Deferred Follow-ups (out of scope for this change)

- test-map and impact-radius scripts.
- `shitaku new` QA phase with the retry rule (3 retries).
- Router integration (#244).
- Profile inclusion (#285); `qa` is not in any profile.
- Real snapshot-baseline infrastructure.
- Running tests from the agent.
- Hard enforcement of the test-files-only write rule (residual risk: instruction-level only, because tools are granted per tool, not per path).

## Contradictions and Decisions

- Tasks observation 1729 says "6 phases, 22 tasks". The persisted `tasks.md` (rank 1) has 21 checkboxes (20 checked, 5.4 unchecked). The persisted file is reported.
- Spec observation 1725 says "16 requirements, 38 scenarios". The persisted spec file (rank 1) has 16 requirements and 34 scenarios. The file count is reported.
- Verify-report (rank 3, observation 1737) states the `browser_run_code` wording as open. The launch prompt (rank 2) and repository evidence show it fixed in `ef413d6`. The final state is reported as fixed; the snapshot's claim is attributed to 1737 and its verification time.
- Engram observation 1717 (state, written before verify) says "Not pushed, no PR". The launch prompt (rank 2) states PR #323 is open. The launch prompt is reported; the observation is historical.
- Engram topic `sdd/add-qa-agent/tasks` is stored in project `shitaku`; `mem_get_observation` reports project `dotagent` with project path under `shitaku`. This is a metadata artifact of the store, not a content conflict.
- No unranked contradiction remains.

## Checks Run

- `git mv openspec/changes/add-qa-agent openspec/changes/archive/2026-11-18-add-qa-agent`: status 0.
- Main spec `qa-agent` (new): `cp` to a temp file in `openspec/specs/qa-agent/`, `diff -r` against the delta spec: empty. Then `mv` into `openspec/specs/qa-agent/spec.md`; `diff -r` after the move: empty.
- Change folder move: snapshot `cp -R` to the session scratchpad before the move; source confirmed absent after `git mv`; `diff -r` snapshot against archived folder: empty.
- Prettier and format:check: see the result of this phase (`prettier --write` on the touched files, then `pnpm run format:check`).

## Mechanical Readback

- Main spec `openspec/specs/qa-agent/spec.md` (new, copied from `openspec/changes/add-qa-agent/specs/qa-agent/spec.md`): `diff -r` output empty (status 0), before and after the move.
- Change folder: `diff -r` of the pre-move snapshot against `openspec/changes/archive/2026-11-18-add-qa-agent`: empty output (status 0).
- `archive-report.md` is additive and excluded from the comparison; it did not exist in the source snapshot.

## SDD Cycle Complete

Implementation: catalog agent `qa` (`catalog/agents/qa.md`), catalog registration, CONTRIBUTING sentence, and regenerated README and website en/es pages, in commits `e71de09` and `e256c40`. Spec and change artifacts in `ef413d6`. Verification: PASS at verification time with two SUGGESTION findings, fixed in `ef413d6`; final gates as listed above. Unfinished tasks and unresolved findings: 5.4 (optional manual Playwright runtime check, not run); deferred follow-ups listed above. Issue #44 remains open (PR uses `Refs #44`).

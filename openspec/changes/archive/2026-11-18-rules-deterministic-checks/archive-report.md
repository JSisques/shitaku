# Archive Report: rules-deterministic-checks

**Change**: rules-deterministic-checks (issue #288; #288 stays open, PRs use `Refs #288`)
**Date archived**: 2026-11-18
**Archived to**: `openspec/changes/archive/2026-11-18-rules-deterministic-checks/`
**Store**: hybrid (OpenSpec files + Engram, project `shitaku`)
**Branch**: `docs/archive-rules-deterministic-checks`, stacked on `feat/rules-checks-3-evaluators` (PR #314 branch)

## Artifact Lineage (Engram Observation IDs)

| Artifact | Engram topic | Observation ID | Read in full this phase | Archived file |
| --- | --- | --- | --- | --- |
| Proposal | `sdd/rules-deterministic-checks/proposal` | 1690 | Yes | `proposal.md` |
| Specs | `sdd/rules-deterministic-checks/spec` | 1696 | Yes | `specs/` (`catalog`, `rule-checks`) |
| Design | `sdd/rules-deterministic-checks/design` | 1698 | Yes (condensed mirror; file is authoritative) | `design.md` |
| Tasks | `sdd/rules-deterministic-checks/tasks` | 1700 | Yes | `tasks.md` |
| Verify-report | `sdd/rules-deterministic-checks/verify-report` | 1711 | Yes | `verify-report.md` |
| Apply-progress | `sdd/rules-deterministic-checks/apply-progress` | not read | No | not present in folder |

Other related observations, not read: exploration (not in the archive locator set); apply-progress holds the TDD Cycle Evidence table referenced by the verify-report (see Verification Status).

## Specs Synced

| Domain | Action | Details |
| --- | --- | --- |
| `rule-checks` | Created (mechanical `cp`, no prior main spec) | Full capability: check and severity keys, five check types, glob and pattern validation, invalid check isolation, evaluation |
| `catalog` | Updated (`gentle-ai sdd-archive-compose`, exit 0) | 0 ADDED, 2 MODIFIED: "Opt-in nested frontmatter reader", "Rule catalog entries" |

Requirement-name presence was checked after composition: `Opt-in nested frontmatter reader` (line 266) and `Rule catalog entries` (line 432) are present in `openspec/specs/catalog/spec.md`; the requirement count is 12 before and after, as expected for a MODIFIED-only delta.

Composed files are not byte-identical to the delta by design. The composed `catalog` spec and the copied `rule-checks` spec were both normalized with `pnpm exec prettier --write`; both were already Prettier-clean, so the write changed no bytes.

## Archive Contents

- `proposal.md`: present
- `specs/`: present (`catalog`, `rule-checks`)
- `design.md`: present
- `exploration.md`: present
- `tasks.md`: present, 27 of 28 checkboxes checked; 1 unchecked (5.1)
- `verify-report.md`: present (written at verification time)
- `apply-progress.md`: missing (apply progress lives only in Engram)
- `archive-report.md`: this file (additive; not part of the source snapshot)

## Final-State Facts

Per the orchestrator launch prompt (rank 2 in the Final-State Authority hierarchy). Repository evidence was checked where possible.

- Implemented as four stacked PRs, all open on GitHub and NOT merged at close: #311 (frontmatter mapping reader, `size:exception`), #312 (schemas), #313 (`parseRule` wiring and docs), #314 (evaluators, `size:exception`).
- Verify-corrective commits sit on the PR3 branch and are to be pushed to #314: `192eac3` (evaluator determinism, empty result and default severity tests), `7532bef` (docs guard for five types, default severity and limits, plus security pages en/es), `798a7fe` (evaluation helpers recorded in design), `a724780` (verify report). Repository evidence: `git show --stat` confirms each commit's file set.
- Final checks at close (this phase, see Mechanical Readback and Checks Run): typecheck, lint, format:check, build exit 0 per launch prompt; `pnpm test` 66 files, 1937 tests pass.

## Verification Status

Source: verify-report, Engram observation 1711, written at verification time. Statements below are historical unless the final-state facts above say otherwise.

- At verification time: verdict behaviorally compliant; 1 CRITICAL, 2 WARNING, 5 SUGGESTION. Verification was not blocking archive.
- At verification time the test count was 1905 (66 files). The final count is 1937 (66 files), recorded at close. Final numbers come from the launch prompt and this phase's `pnpm test` run, not from the snapshot.
- CRITICAL (strict-TDD evidence table missing from apply-progress, process-only): resolved per the verify-report's own corrective pass (line 61 of the archived `verify-report.md`) and the launch prompt. The TDD Cycle Evidence table lives in the Engram apply-progress observation, which this phase did not read. RED is not reconstructible for PR1, PR2a and PR2b because tests and source landed in the same commits. Fix recorded honestly: PR3 counts come from recorded facts; other slices are "not recorded". Nothing was fabricated.
- WARNING W1 (docs guard for five types, default severity, glob and regex limits): fixed in `7532bef`.
- WARNING W2 (evaluator determinism, empty tuple, default severity): fixed in `192eac3`.
- SUGGESTION S2 and S5: fixed. S1, S3 and S4: accepted as suggestions, not acted on.
- Final checks named by the launch prompt: typecheck, lint, format:check, build exit 0.

## Unfinished Work (not ticked, not repaired)

The archived `tasks.md` is byte-identical to the source. Its checkboxes were not edited.

- **5.1 UNCHECKED, NOT DONE**: run the full suite on the merged base after PR3 merges. Blocked on merge; PR #314 is open.
- PR bookkeeping tasks remain as recorded in `tasks.md`. Archive does not repair checkboxes.

## Deferred Follow-ups (out of scope for this change)

- Catalog data slice: six new rules (no-any, layer-boundaries, env-documented, no-stray-todos, changelog-or-docs, max-file-size) and checks on module-readme, conventional-commits, tests-for-changes, no-secrets.
- Gate runner and `shitaku new` (#226).
- Source precedence (#181).
- Learned rules (#228).
- Custom `.mjs` checks.
- `tool` check and `skipped` semantics, to fit #226.

## Contradictions and Decisions

- Verify-report (rank 3) states the CRITICAL and W1/W2 as open at verification time. The launch prompt (rank 2) states them fixed, and the corrective commits exist in the repository. The final state is reported as fixed; the snapshot's claims are attributed to 1711 and its time.
- Verify-report test count 1905 versus launch-prompt count 1937: the higher-ranked final count is reported. The difference reflects the corrective test additions.
- Tasks planning observation 1700 estimated "~38 tasks". The persisted `tasks.md` has 28 checkboxes and is the authority for completion.
- No unranked contradiction remains.

## Checks Run

- `pnpm exec prettier --write` on `openspec/specs/catalog/spec.md` and `openspec/specs/rule-checks/spec.md`: both unchanged.
- `pnpm run format:check`: "All matched files use Prettier code style!"
- `pnpm test`: Test Files 66 passed (66); Tests 1937 passed (1937).

## Mechanical Readback

- Main spec `rule-checks` (new): `cp` to a `mktemp` file, `diff -r` against the delta spec: empty. Then `mv` into `openspec/specs/rule-checks/spec.md`; `diff -r` after the move: empty.
- Main spec `catalog` (MODIFIED): `gentle-ai sdd-archive-compose --canonical openspec/specs/catalog/spec.md --delta openspec/changes/rules-deterministic-checks/specs/catalog/spec.md --output openspec/specs/catalog/spec.md.compose-tmp`, exit 0, then `mv`. Byte-identity does not apply to composed files; requirement-name presence was checked instead.
- Change folder move: snapshot `cp -R` to a temp root before the move, `git mv` from `openspec/changes/rules-deterministic-checks` to `openspec/changes/archive/2026-11-18-rules-deterministic-checks`, source confirmed absent, then `diff -r` snapshot against archived folder: empty.

## SDD Cycle Complete

Implementation: four stacked PRs (#311, #312, #313, #314), all open and not merged at close. Verification: verify-report at verification time, with the CRITICAL and W1/W2 fixed afterwards; final checks as listed above. Unfinished tasks and unresolved findings: 5.1 (full-suite run after PR3 merges, not done); PR bookkeeping checkboxes as recorded in `tasks.md`; the deferred follow-ups listed above. Issue #288 remains open.

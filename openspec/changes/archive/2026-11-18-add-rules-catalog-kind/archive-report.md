# Archive Report: add-rules-catalog-kind

**Change**: add-rules-catalog-kind (issue #237)
**Date archived**: 2026-11-18
**Archived to**: `openspec/changes/archive/2026-11-18-add-rules-catalog-kind/`
**Store**: hybrid (OpenSpec files + Engram, project `shitaku`)
**Branch**: `docs/archive-add-rules-catalog-kind`, stacked on `feat/rules-5-cli-user-docs` (PR #305)

## Artifact Lineage (Engram Observation IDs)

| Artifact | Engram topic | Observation ID | Read in full this phase | Archived file |
| --- | --- | --- | --- | --- |
| Proposal | `sdd/add-rules-catalog-kind/proposal` | 1659 | No (search preview only) | `proposal.md` |
| Specs | `sdd/add-rules-catalog-kind/spec` | 1661 | Yes | `specs/` (5 delta files) |
| Design | `sdd/add-rules-catalog-kind/design` | 1663 | No (search preview only) | `design.md` |
| Tasks | `sdd/add-rules-catalog-kind/tasks` | 1665 | Yes | `tasks.md` |
| Apply-progress | `sdd/add-rules-catalog-kind/apply-progress` | 1670 | No (search preview only) | not present in folder |
| Verify-report | `sdd/add-rules-catalog-kind/verify-report` | 1681 | Yes | `verify-report.md` (reconstructed, see below) |

Other related observations (not read in full): exploration 1650; planning decisions 1666; slice-1 delivery decision 1673; delivery state 1680.

## Specs Synced

| Domain | Action | Details |
| --- | --- | --- |
| `rules-install` | Created (mechanical `cp`, no prior main spec) | 9 requirements |
| `catalog` | Updated (`gentle-ai sdd-archive-compose`) | 1 ADDED, 2 MODIFIED |
| `catalog-list` | Updated (`gentle-ai sdd-archive-compose`) | 1 ADDED, 1 MODIFIED |
| `install-status` | Updated (`gentle-ai sdd-archive-compose`) | 1 ADDED, 2 MODIFIED |
| `item-uninstall` | Updated (`gentle-ai sdd-archive-compose`) | 1 ADDED, 2 MODIFIED |

Each requirement header from the delta specs was confirmed present in its main spec by a name match after composition.

## Archive Contents

- `proposal.md`: present
- `specs/`: present (`catalog`, `catalog-list`, `install-status`, `item-uninstall`, `rules-install`)
- `design.md`: present
- `exploration.md`: present
- `tasks.md`: present, 55/61 tasks checked; 6 unchecked (see Unfinished Items)
- `verify-report.md`: present, but created during archive from Engram observation 1681 because the verifier did not write the file
- `apply-progress.md`: missing (apply progress lives only in Engram observation 1670)

## Unfinished Items (not ticked, not repaired)

The archived `tasks.md` is byte-identical to the source. Its checkboxes were not edited.

- **1.11, 2.9, 3.12, 4.7, 5.10**: PR bookkeeping. Per the orchestrator's final-state facts, PRs #297, #302, #303, #304 and #305 exist. The launch prompt asked for these to be ticked. The archive rules forbid repairing checkboxes, so they were left unchecked. The orchestrator can decide whether to amend.
- **5.8 PENDING**: user-owned manual Claude Code `/memory` check of `name`/`description` frontmatter in `.claude/rules`, plus a quoted `paths:` rule. It does not gate archive. If Claude Code rejects `name`/`description`, the design fallback (metadata only in `catalog.json`) applies before release.

## Final-State Facts

Per the orchestrator launch prompt (not independently verified in this phase):

- Implemented as a 5-PR stacked-to-main chain: #297 (domain and loader), #302 (manifest and plan), #303 (apply and lifecycle), #304 (seed rules and generators), #305 (CLI and docs, Closes #237).
- Labels `size:exception` on #297, #303 and #305. Those slices are about 627, 423 and 665 changed lines against the 400-line budget. #302 is about 248 and #304 about 317.
- Follow-up issues, out of scope: #288 (deterministic checks, severity, precedence, learned rules, six checked rules) and #289 (generic `add` command).

## Verification Status

Source: verify-report, Engram observation 1681, written at verification time. Statements below are historical unless the final-state facts above say otherwise.

- At verification time: 0 CRITICAL, 3 WARNING, 3 SUGGESTION.
- At verification time: typecheck, lint, format:check, build, docs:catalog:check and docs:website-catalog:check were clean. `pnpm test` reported 1619 passing tests in 61 files. The orchestrator did not supply a later count, so 1619 is the last recorded figure.
- Design grep checklist passed at verification time.
- W1 (size): handled by `size:exception` labels, per final-state facts.
- W2 (bookkeeping): see Unfinished Items. The unchecked PR tasks remain unchecked in `tasks.md`.
- W3 (TDD evidence): apply-progress evidence for slices 1 to 4 is prose only. It cannot be reconstructed and was not fabricated.
- S1 (CONTRIBUTING heading): resolved in commit `d7ec915` (heading renamed to "Adding catalog items: rules").
- S2 and S3: informational only.

## Contradictions and Decisions

- No unranked contradiction was found between the launch prompt and repository evidence.
- The launch prompt asked for checkboxes to be ticked. The archive skill forbids repairing checkboxes. The skill rule was applied and the request is recorded here instead of being silently resolved either way.

## Mechanical Readback

- Main spec `rules-install` (new): `cp` to temp file, then `diff -r` against the delta spec: empty.
- Change folder move: `git mv` from `openspec/changes/add-rules-catalog-kind` to `openspec/changes/archive/2026-11-18-add-rules-catalog-kind`. Snapshot taken before the move, then `diff -r` snapshot against archived folder: empty. Source directory confirmed absent.
- Composed main specs (`catalog`, `catalog-list`, `install-status`, `item-uninstall`): written by `gentle-ai sdd-archive-compose` with exit 0. Byte-identity does not apply to composed files. Requirement-name presence was checked instead.

## SDD Cycle Complete

Implementation: 5 stacked PRs (#297, #302, #303, #304, #305) per final-state facts. Verification: partial, 0 CRITICAL, 3 WARNING, 3 SUGGESTION at verification time. Unfinished tasks and unresolved findings: 1.11, 2.9, 3.12, 4.7, 5.10 (unchecked PR bookkeeping); 5.8 (pending manual user check); W3 (TDD evidence not reconstructable).

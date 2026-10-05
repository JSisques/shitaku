# Archive Report: catalog-scripts

## Summary

Change `catalog-scripts` (issue https://github.com/JSisques/shitaku/issues/144) is archived and closed. All 24 tasks are complete on tip branch `feat/catalog-scripts-docs`. Verify **PASS** (22/22 requirements, 50/50 scenarios, 838 tests green). Stacked PRs remain open for delivery: #170 (PR1→main), #172 (PR2→feat/catalog-scripts), #173 (PR3→feat/catalog-scripts-install), #174 (PR4→feat/catalog-scripts-run, Closes #144). Main specs now include new capabilities `scripts-install` and `scripts-run`, plus ADDED/MODIFIED requirements on `catalog`, `catalog-list`, `install-safety`, `install-status`, and `item-uninstall`. Active change folder moved to `openspec/changes/archive/2026-10-05-catalog-scripts/`.

## Final State at Close

| Field | Value |
|-------|-------|
| Verdict | PASS (0 CRITICAL, 0 blockers) |
| Tasks | 24/24 complete (Task Completion Gate passed; 0 unchecked) |
| Spec compliance | 22/22 requirements, 50/50 scenarios COMPLIANT |
| Tests on tip | **838 passed / 43 files** (`pnpm test` exit 0) |
| Quality gates | typecheck, lint, format:check, build — all exit 0 |
| Delivery | Stacked PRs open: #170, #172, #173, #174 (not merged at archive time) |
| Tip commits after PR4 open (verify fixes) | `4242dc7`, `4173125`, `d6a384c` |
| Shipped behavior (on tip) | Installable `scripts` catalog kind; dual-scope roots; init/status/undo/uninstall; `shitaku run`; empty `catalog/scripts/` (no concrete scripts) |

### Acceptable remaining warnings at close (non-blocking)

1. CI OS matrix still `ubuntu-latest` only — Windows deferred (unit path/`.cmd` fixtures only); do not expand matrix in this change.
2. Admission of verify-report was manual because gentle-ai 3.7.0 lacks `sdd-verify-validate` (orchestrator-authorized).
3. Tip `apply-progress` historically referenced Phase 1–3 TDD tables by prior revision; evidence lives in Engram history / tests — not a product blocker.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `catalog` | Updated | Native compose: ADDED "Script catalog entries"; MODIFIED "Catalog layout and schema", "Profile extends" |
| `catalog-list` | Updated | Native compose: MODIFIED "Kind filter"; ADDED "Scripts list shape" |
| `install-safety` | Updated | Native compose: MODIFIED "Manifest", "Undo"; ADDED "Multi-file script write failure" |
| `install-status` | Updated | Native compose: MODIFIED "Manifest-driven read-only report", "Item states"; ADDED "Unsafe and unreadable script trees" |
| `item-uninstall` | Updated | Native compose: MODIFIED "Command surface", "Kind collision"; ADDED "Modified script uninstall" |
| `scripts-install` | Created | Mechanical `cp` of full change spec (4 requirements). Empty `diff -r` source vs temp before `mv`. |
| `scripts-run` | Created | Mechanical `cp` of full change spec (4 requirements). Empty `diff -r` source vs temp before `mv`. |

Compose invocations (existing domains):

```bash
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/{domain}/spec.md" \
  --delta "openspec/changes/catalog-scripts/specs/{domain}/spec.md" \
  --output "openspec/specs/{domain}/spec.md.compose-tmp"
&& mv "openspec/specs/{domain}/spec.md.compose-tmp" "openspec/specs/{domain}/spec.md"
```

Domains composed: `catalog`, `catalog-list`, `install-safety`, `install-status`, `item-uninstall` — all exit 0.

New-domain mechanical copy diff readback (verbatim empty):

```text
diff_new_scripts-install:
diff_new_scripts-run:
```

## Archive Move

- Source: `openspec/changes/catalog-scripts`
- Destination: `openspec/changes/archive/2026-10-05-catalog-scripts`
- Method: `git mv` (tracked)
- Pre-move snapshot vs destination `diff -r`: empty (byte-identical)
- Archive date: 2026-10-05

### Verbatim `diff -r` (snapshot vs destination)

```text
(empty — no differences)
```

`diff_exit=0`

### Archive Contents

- proposal.md
- exploration.md
- design.md
- tasks.md (24/24 complete)
- verify-report.md (PASS; admission manual)
- apply-progress.md
- specs/catalog/spec.md
- specs/catalog-list/spec.md
- specs/install-safety/spec.md
- specs/install-status/spec.md
- specs/item-uninstall/spec.md
- specs/scripts-install/spec.md
- specs/scripts-run/spec.md
- archive-report.md (this file; additive)

## Observation IDs (Engram traceability)

| Artifact | Observation ID | Topic key |
|----------|----------------|-----------|
| proposal | #1219 | `sdd/catalog-scripts/proposal` |
| spec | #1223 | `sdd/catalog-scripts/spec` |
| design | #1222 | `sdd/catalog-scripts/design` |
| tasks | #1227 | `sdd/catalog-scripts/tasks` |
| apply-progress | #1234 | `sdd/catalog-scripts/apply-progress` |
| verify-report | #1253 | `sdd/catalog-scripts/verify-report` |
| archive-report | #1257 | `sdd/catalog-scripts/archive-report` |

Related session notes (not required phase artifacts): design-validate #1224; gates/launches #1218, #1220, #1221, #1225, #1226, #1228; PR/size notes #1240–#1245, #1249–#1250; verify launch #1252.

OpenSpec paths (hybrid filesystem audit trail):

- Archived folder: `openspec/changes/archive/2026-10-05-catalog-scripts/`
- Main specs: `openspec/specs/{catalog,catalog-list,install-safety,install-status,item-uninstall,scripts-install,scripts-run}/spec.md`

## Final-State Authority Notes

- Orchestrator final-state facts outrank intermediate `apply-progress` / earlier verify snapshots: all 24 tasks complete; verify PASS after closing 3 PARTIAL coverage gaps (dual-scope status, multi-kind status, package.json non-mutation); 838 tests green; admission manual due to missing `sdd-verify-validate`.
- Do **not** echo stale PARTIAL claims as current state — they were closed in tip commits `4242dc7`, `4173125`, `d6a384c` before archive.
- Proposal success-criteria checkboxes may remain unchecked in archived `proposal.md` (cosmetic only; `tasks.md` is authoritative for completion).
- Delivery PRs are still open at archive time; archive closes the SDD cycle, not GitHub merge.

## config.yaml archive rules

Applied: "Merge delta specs into openspec/specs before archiving" — completed before move.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change (orchestrator owns push / PR updates for the archive commit on `feat/catalog-scripts-docs`).

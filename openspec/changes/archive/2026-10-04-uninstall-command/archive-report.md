# Archive Report: uninstall-command

## Summary

Change `uninstall-command` (issue #55) is archived and closed. Implementation shipped via merged PR https://github.com/JSisques/shitaku/pull/107 (Closes #55; issue closed 2026-10-03). Related groundwork PR https://github.com/JSisques/shitaku/pull/97 also merged. Main specs now include new capability `item-uninstall` plus ADDED/MODIFIED requirements on `install-safety` and `install-status`. Active change folder moved to `openspec/changes/archive/2026-10-04-uninstall-command/`. Sibling archive `openspec/changes/archive/2026-10-04-version-command/` was left untouched.

## Final State at Close

| Field | Value |
|-------|-------|
| Verdict | ARCHIVED WITHOUT VERIFY (verify optional; missing report does not block) |
| Tasks | 15/15 complete (Task Completion Gate passed; 0 unchecked) |
| Verify | Not run / `verify-report` missing at close — do not invent a verify pass |
| Delivery | PR https://github.com/JSisques/shitaku/pull/107 MERGED; issue #55 CLOSED (closedAt 2026-10-03); groundwork PR #97 MERGED |
| Shipped behavior | `shitaku uninstall <name>` with `--scope`, `--kind`, `--dry-run`, `--force`; journaled `remove` action; undoable; status hides uninstalled items |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `install-safety` | Updated | Native `gentle-ai sdd-archive-compose`: MODIFIED "Manifest" (records `remove`); ADDED "Remove as ownership deletion" (3 scenarios). Prior requirements preserved. |
| `install-status` | Updated | Native `gentle-ai sdd-archive-compose`: ADDED "Uninstalled items not reported" (2 scenarios). Prior requirements preserved. |
| `item-uninstall` | Created | Mechanical `cp` of full change spec into `openspec/specs/item-uninstall/spec.md` (7 requirements). Empty `diff -r` source vs destination. |

Compose invocations:

```bash
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/install-safety/spec.md" \
  --delta "openspec/changes/uninstall-command/specs/install-safety/spec.md" \
  --output "openspec/specs/install-safety/spec.md.compose-tmp"
&& mv "openspec/specs/install-safety/spec.md.compose-tmp" "openspec/specs/install-safety/spec.md"

gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/install-status/spec.md" \
  --delta "openspec/changes/uninstall-command/specs/install-status/spec.md" \
  --output "openspec/specs/install-status/spec.md.compose-tmp"
&& mv "openspec/specs/install-status/spec.md.compose-tmp" "openspec/specs/install-status/spec.md"
```

## Archive Move

- Source: `openspec/changes/uninstall-command`
- Destination: `openspec/changes/archive/2026-10-04-uninstall-command`
- Method: `git mv` (tracked)
- Pre-move snapshot vs destination `diff -r`: empty (byte-identical)
- Archive date: 2026-10-04 (archive day; feature merged 2026-10-03)

### Archive Contents

- proposal.md
- specs/install-safety/spec.md
- specs/install-status/spec.md
- specs/item-uninstall/spec.md
- design.md
- tasks.md (15/15 complete)
- archive-report.md (this file; additive)
- verify-report.md: **absent** (never produced)

## Observation IDs (Engram traceability)

No prior Engram phase artifacts existed for `uninstall-command` at archive time (`mem_search` for `sdd/uninstall-command` returned none). Native artifact store for this change was OpenSpec filesystem under `openspec/changes/uninstall-command/`.

| Artifact | Observation ID | Topic key / path |
|----------|----------------|------------------|
| proposal | n/a (openspec-only) | `openspec/changes/archive/2026-10-04-uninstall-command/proposal.md` |
| specs | n/a (openspec-only) | `openspec/changes/archive/2026-10-04-uninstall-command/specs/**` |
| design | n/a (openspec-only) | `openspec/changes/archive/2026-10-04-uninstall-command/design.md` |
| tasks | n/a (openspec-only) | `openspec/changes/archive/2026-10-04-uninstall-command/tasks.md` |
| verify-report | missing | — |
| archive-report | #1172 | `sdd/uninstall-command/archive-report` |

## Final-State Authority Notes

- Explicit final-state facts: feature already on main via PRs #107 and #97; issue #55 closed; tasks 15/15; verify-report never existed.
- Do not invent a verify pass. Archive proceeded because verification is optional and Task Completion Gate + `dependencies.archive: ready` were satisfied.
- Proposal success-criteria checkboxes remain unchecked in archived `proposal.md` (cosmetic only; tasks artifact is authoritative for completion).
- Sibling `version-command` archive on this branch was not modified by this archive step.

## SDD Cycle Complete

The change has been planned, implemented (shipped on main), and archived. Ready for the next change.

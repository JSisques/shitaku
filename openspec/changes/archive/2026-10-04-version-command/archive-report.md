# Archive Report: version-command

## Summary

Change `version-command` (issue #111) is archived and closed. Implementation shipped via PR #130 (merged to main; merge commit `9e7a9c8777f8e429092037ec32190d49691048ed`; issue #111 closed 2026-10-04). Main specs now include new capability `cli-version` and an ADDED requirement on `update-notifier`. Active change folder moved to `openspec/changes/archive/2026-10-04-version-command/`. Sibling `uninstall-command` was left active and untouched.

## Final State at Close

| Field | Value |
|-------|-------|
| Verdict | PASS WITH WARNINGS (0 CRITICAL) |
| Tasks | 18/18 complete (Task Completion Gate passed; 0 unchecked) |
| Spec compliance | 7/7 requirements, 12/12 scenarios |
| Tests on main after merge | 612 passed (authoritative final-state fact; do not use apply-progress intermediate counts) |
| Delivery | PR https://github.com/JSisques/shitaku/pull/130 MERGED; issue #111 CLOSED |
| Shipped behavior | `shitaku version` / `-v` / `--version`; unreadable → exact stderr + exit 1; notifier skipped on those paths; README docs |

### Acceptable remaining warnings at close

1. gentle-ai 3.7.0 missing `sdd-verify-validate` command.
2. Unrelated `test:coverage` flake in `tooling.test.ts` (suite without coverage is green).

Mechanical verify fixes that landed in the merged PR: prettier openspec markdown, `.pnpm-store` ignore, naming.test README assertion.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `cli-version` | Created | Mechanical `cp` of full change spec into `openspec/specs/cli-version/spec.md` (6 requirements). Empty `diff -r` source vs destination. |
| `update-notifier` | Updated | Native `gentle-ai sdd-archive-compose` ADDED requirement "Version reporting skips update check" (2 scenarios). Prior requirements preserved (now 10 requirements total). |

Compose invocation:

```bash
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/update-notifier/spec.md" \
  --delta "openspec/changes/version-command/specs/update-notifier/spec.md" \
  --output "openspec/specs/update-notifier/spec.md.compose-tmp"
&& mv "openspec/specs/update-notifier/spec.md.compose-tmp" "openspec/specs/update-notifier/spec.md"
```

## Archive Move

- Source: `openspec/changes/version-command`
- Destination: `openspec/changes/archive/2026-10-04-version-command`
- Method: `git mv` (tracked)
- Pre-move snapshot vs destination `diff -r`: empty (byte-identical)

### Archive Contents

- proposal.md
- specs/cli-version/spec.md
- specs/update-notifier/spec.md
- design.md
- tasks.md (18/18 complete)
- verify-report.md
- apply-progress.md
- exploration.md
- archive-report.md (this file; additive)

## Observation IDs (Engram traceability)

| Artifact | Observation ID | Topic key |
|----------|----------------|-----------|
| proposal | #1160 | `sdd/version-command/proposal` |
| spec | #1162 | `sdd/version-command/spec` |
| design | #1163 | `sdd/version-command/design` |
| tasks | #1165 | `sdd/version-command/tasks` |
| apply-progress | #1167 | `sdd/version-command/apply-progress` |
| verify-report | #1169 | `sdd/version-command/verify-report` |

Related session notes (not required phase artifacts): explore #1159, proposal-session #1161, planning-progress #1164, tasks-session #1166, apply-session #1168, pr #1170.

## Final-State Authority Notes

- Intermediate `apply-progress` test count (611) is superseded by verify-report / final-state fact of **612 passed**.
- Proposal success-criteria checkboxes remain unchecked in archived `proposal.md` (cosmetic only; tasks artifact is authoritative for completion).
- No CRITICAL findings; archive proceeded under PASS WITH WARNINGS.

## SDD Cycle Complete

Planned, implemented, verified, merged (PR #130), and archived. Ready for the next change (`uninstall-command` archive is a separate run).

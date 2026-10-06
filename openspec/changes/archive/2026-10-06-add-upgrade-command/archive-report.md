# Archive Report: add-upgrade-command

**Change**: `add-upgrade-command`
**Archived**: 2026-10-06
**Destination**: `openspec/changes/archive/2026-10-06-add-upgrade-command/`
**Artifact store**: hybrid (OpenSpec filesystem + Engram project `dotagent`)
**Status at close**: success — SDD cycle complete

## Final-State Authority

This report describes the change **at close**, not intermediate snapshots.

| Source rank | Fact used |
|-------------|-----------|
| Tasks artifact (filesystem + Engram `#1405`) | 13/13 implementation tasks checked (`- [x]`); 0 unchecked |
| Orchestrator explicit final-state facts | Verify PASS after remediations; full CI-equivalent local verify green; GitHub CI green on PR #192; stacked PRs #193/#194 open; no CRITICAL findings open; notifier wording OUT OF SCOPE; #46 `update` not implemented |
| `verify-report` (`openspec/.../verify-report.md`, Engram `#1428`) | Intermediate PASS snapshot (7/7 requirements, 13/13 scenarios); CRITICAL: none — consistent with final state |
| `apply-progress` (Engram `#1411`) | Intermediate: 13/13 complete + README remediation notes — "pending" claims superseded by final-state facts |

## Lineage (Engram observation IDs read)

| Artifact | Observation ID | Topic |
|----------|----------------|-------|
| explore | `#1394` | `sdd/add-upgrade-command/explore` |
| proposal | `#1397` | `sdd/add-upgrade-command/proposal` |
| spec | `#1398` | `sdd/add-upgrade-command/spec` |
| design | `#1399` | `sdd/add-upgrade-command/design` |
| tasks | `#1405` | `sdd/add-upgrade-command/tasks` |
| apply-progress | `#1411` | `sdd/add-upgrade-command/apply-progress` |
| verify-report | `#1428` | `sdd/add-upgrade-command/verify-report` |
| archive-report | (this write) | `sdd/add-upgrade-command/archive-report` |

## Archive Readiness Gate

- Task Completion Gate: **PASS** — archived `tasks.md` has 13/13 `[x]`, 0 unchecked
- CRITICAL in verify-report: **none**
- Native status (orchestrator): `nextRecommended: archive`, `applyState: all_done`

## Specs Synced (before move)

| Domain | Action | Details |
|--------|--------|---------|
| `cli-upgrade` | Created | Mechanical `cp` of delta → `openspec/specs/cli-upgrade/spec.md`. 6 requirements promoted (full new capability). `diff -r` source vs destination: empty (pass). |
| `update-notifier` | Updated | Native `gentle-ai sdd-archive-compose` MODIFIED requirement **Version reporting skips update check** — adds `upgrade` to skip list + Upgrade skips notifier scenario; notice wording unchanged. Exit 0. |

### Mechanical readback evidence

**cli-upgrade promote (`diff -r` change delta vs main spec):** empty output, exit 0.

**Archive folder move (`diff -r` pre-move snapshot vs `openspec/changes/archive/2026-10-06-add-upgrade-command/`):** empty output, exit 0. Move via `git mv`. Active `openspec/changes/add-upgrade-command/` absent after move.

## What Shipped (final state)

- `shitaku upgrade` CLI self-update: fresh latest fetch, current→target display, spawn for `npm-global`/`pnpm-global` (`shell: false`), print-only for `npx`/`unknown`, already-latest and PM-failure messaging.
- Notifier skip extended to `upgrade` (like `version`); **notice wording not changed** (out of scope).
- Issue #46 `shitaku update` **not** implemented.
- Stacked delivery: `feat/upgrade-command-core` → `feat/upgrade-command-cli` → `docs/upgrade-command-sdd`.
- PR #192 CI green; #193/#194 open (CI runs only for PRs targeting main).
- Local CI-equivalent verify green at close: lint, format, typecheck, test:coverage (~889+ tests), build, smoke:pack, docs:catalog:check.
- Remediations after intermediate verify: README `naming.test` coverage + format fix + `.vitest/` ignore.

## Archive Contents

- proposal.md ✅
- exploration.md ✅
- specs/cli-upgrade/spec.md ✅
- specs/update-notifier/spec.md ✅
- design.md ✅
- tasks.md ✅ (13/13 complete)
- apply-progress.md ✅
- verify-report.md ✅
- archive-report.md ✅ (this file; additive after move)

## Source of Truth Updated

- `openspec/specs/cli-upgrade/spec.md` (new)
- `openspec/specs/update-notifier/spec.md` (modified skip requirement)

## Out of Scope (unchanged)

- Notifier wording change → `shitaku upgrade` (separate issue)
- Issue #46 `shitaku update` (catalog sync)

## SDD Cycle Complete

Planned, implemented, verified, and archived. Ready for the next change. Orchestrator will commit on a new stacked branch (archive agent does not create git commits).

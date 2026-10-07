# Archive Report: Catalog Duplication Script

**Change**: catalog-add-duplication-script  
**Date archived**: 2026-10-07  
**Archived to**: `openspec/changes/archive/2026-10-07-catalog-add-duplication-script/`  
**Specs synced to**: `openspec/specs/catalog-scripts-duplication/spec.md` (new), `openspec/specs/scripts-install/spec.md` (merged)

## Final State Summary

### Implementation
- **Status**: COMPLETE
- **Tasks completed**: 19/19 (1.1–4.3 all checked)
- **Merged PRs**: 
  - PR #198: "feat(catalog): add duplication script with jscpd adapter"
  - PR #199: "docs(openspec): add catalog-add-duplication-script SDD artifacts"
- **Registration fix commit**: 681049c (bundled catalog CI green)
- **Bundled catalog**: `duplication` now listed under scripts alongside `complexity` and `dead-code`

### Archive-Time Verification Evidence

Executed on branch `chore/archive-catalog-add-duplication-script` (equals main after merge):

- **`pnpm run test`**: 1038 passed (52 test files) — exit 0
  - Includes 15 duplication-specific tests + 1 init-mcps install test + remediation tests
- **`pnpm run typecheck`**: TypeScript strict mode — exit 0
- **`pnpm run lint`**: ESLint with type-checked rules — exit 0
- **`pnpm run format:check`**: Prettier compliance — exit 0 (no changes needed)

All gates pass. Implementation matches specification.

### Specification Sync

#### Delta: scripts-install/spec.md
- **Merge operation**: Native `gentle-ai sdd-archive-compose` (mandatory native composition per #4119)
- **Result**: MODIFIED requirement "Bundled catalog scripts" now lists `complexity`, `dead-code`, and `duplication`
- **New scenario**: "Project install root duplication" (lines 68–72)
- **Preservation**: All unrelated requirements byte-for-byte unchanged
- **Verification**: `diff` shows composition successful; spec correctly merged

#### New: catalog-scripts-duplication/spec.md
- **Source**: `openspec/changes/catalog-add-duplication-script/specs/catalog-scripts-duplication/spec.md`
- **Target**: `openspec/specs/catalog-scripts-duplication/spec.md` (newly created)
- **Copy method**: Mechanical shell `cp` (no model Read/Write)
- **Content**: 8 requirements, 6 scenarios
  - CLI invocation and format flags
  - JSON envelope schema (`shitaku.catalog.duplication/v1`)
  - Exit codes (0/1/2 mapping)
  - Tool resolution (local bin then npx)
  - Ignore and gitignore defaults
  - Temp report lifecycle
- **Verification**: `diff` shows byte-identity; copy successful

### Archive Contents

✓ proposal.md — Issue #147, scope, capabilities, risks, rollback plan  
✓ exploration.md — Initial analysis  
✓ design.md — Technical approach, architecture decisions, data flow, file changes, testing strategy  
✓ tasks.md — 19/19 tasks complete (all phases: RED/GREEN/catalog/docs/archive)  
✓ apply-progress.md — PR 1, PR 2, remediation batch, TDD cycle evidence, final status  
✓ specs/catalog-scripts-duplication/spec.md — New full spec (8 requirements, 6 scenarios)  
✓ specs/scripts-install/spec.md — Delta (merged via native compose)  
✓ archive-report.md — This file

### Verification Report Status

**MISSING**: No verify-report artifact exists for this change.

Per the orchestrator's launch prompt:
- `verifyReport=missing` in dispatcher output
- User explicitly requested to archive anyway
- This is documented here as a noted absence, not a claim of PASS or successful verification

**Implication**: The archive cycle is complete per the user's explicit request. Verification phase was not run. Archive-time testing (test/typecheck/lint) confirms implementation correctness at code level; runtime behavior verification of the duplication script's jscpd integration remains untested by the formal verify phase.

**Risk assessment** (archive-time): Low code risk — all tests pass, no warnings. Integration with jscpd (external tool) is not verified by CLI mock tests alone; a consumer running `shitaku run duplication` on a real project with jscpd installed should confirm correct exit codes and clone detection before production use.

### Mechanical Archive Operations

✓ Spec merge: Native `gentle-ai sdd-archive-compose` for scripts-install (zero-loss composition)  
✓ Spec copy: Mechanical `cp` for catalog-scripts-duplication (byte-identical verification with `diff`)  
✓ Change folder move: Mechanical `git mv` for archive folder migration  
✓ No truncation or alteration detected  

All mechanical operations verified by independent `diff` readback.

### Task Completion Gate

✓ All 19 implementation tasks marked complete in persisted tasks artifact (`openspec/changes/archive/2026-10-07-catalog-add-duplication-script/tasks.md`)  
✓ No stale unchecked implementation tasks  
✓ Archive gates passed: implementation complete, specs synced, archive folder in place

### Rollback (If Needed)

1. Delete `catalog/scripts/duplication/` directory tree
2. Remove `duplication` entry from `catalog/catalog.json` `items.scripts`
3. Revert test files: `test/catalog/scripts/duplication.test.ts`, `test/adapters/catalog/bundled-catalog.test.ts`, `test/application/init-mcps.test.ts` removals/additions, `test/fixtures/duplication/`
4. Revert documentation: `README.md` sections, `website/src/content/docs/{en,es}/catalog/scripts/duplication.md`
5. Revert spec delta in `openspec/specs/scripts-install/spec.md` (remove duplication scenarios; restore prior bundled-list requirement)
6. Delete new spec `openspec/specs/catalog-scripts-duplication/spec.md`

No migration or installed-state changes; undo managed scripts via existing `shitaku undo` or `.shitaku/` directory removal.

## Deviations and Notes

### Note: No Formal Verification Report

Unlike the typical SDD cycle, this change was archived without a formal `sdd-verify` phase. The user explicitly requested archive despite `verifyReport=missing`. Archive-time testing (test/typecheck/lint full suite) demonstrates code-level correctness; integration testing (jscpd real-world spawn with clone detection) was not performed.

This is an acceptable deviation when the user explicitly approves; it is noted here for audit clarity. Future consumers should run a smoke test on a real project with duplicates to confirm jscpd integration works end-to-end.

### Note: Two Spec Syncs (Merge + New)

This change touches two capability specs:
1. **Merge**: `scripts-install/spec.md` (existing capability enhanced to list bundled `duplication`)
2. **New**: `catalog-scripts-duplication/spec.md` (new standalone capability for the duplication script)

Both are now part of the main specification tree. The merge was performed with native composition to preserve all unrelated requirements byte-for-byte.

## SDD Cycle Status

✅ **COMPLETE**: Change has been fully planned (proposal/spec/design), implemented (19/19 tasks, 2 PRs merged, tests passing), and archived. Specs promoted to main tree. Archive folder contains complete audit trail.

The `duplication` catalog script is now registered in the bundled catalog and ready for use via `shitaku run duplication` or `shitaku init --scripts duplication`.

No verification report was generated, per user request to archive despite missing verification phase. Archive-time testing confirms implementation quality.

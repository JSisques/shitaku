# Archive Report: catalog-complexity-script

## Summary

Change `catalog-complexity-script` (issue https://github.com/JSisques/shitaku/issues/145) is archived and closed. All **19/19** tasks are complete across stacked PR1–PR3 plus install-root remediation. Verify **PASS** (9/9 requirements, 14/14 scenarios) after adding `initMcps (bundled complexity script)` for Project install root. Main specs now include capability `catalog-scripts-complexity` and an updated `scripts-install` (Empty structure removed; Bundled complexity script added). Active change folder moved to `openspec/changes/archive/2026-10-05-catalog-complexity-script/`.

## Final State at Close

| Field | Value |
|-------|-------|
| Verdict | PASS (0 CRITICAL blockers at close) |
| Tasks | 19/19 complete (Task Completion Gate passed; 0 unchecked) |
| Spec compliance | 9/9 requirements, 14/14 scenarios COMPLIANT |
| Tests at verify | **852 passed / 44 files** (`pnpm test` exit 0); tip also has install-root remediation (+1) |
| Quality gates | typecheck, lint, format:check, build, docs:catalog:check, docs:website-catalog:check — all exit 0 |
| CI | PR #176 foundation CI green (README scripts table + website complexity pages) |
| Delivery | Stacked PRs open: #176 foundation → #177 behavior → #178 docs; archive PR targets #178 head `feat/catalog-complexity-docs` |
| Shipped behavior (on tip) | Bundled `complexity` script under `catalog/scripts/complexity/`; D1A–D4A CLI/JSON/thresholds/ignore; ADR-2 script-root `node_modules` skip/rm; docs/tables list `complexity` |

### Final-state authority notes

- Explicit orchestrator final-state facts outrank intermediate `apply-progress` / early verify snapshots.
- Earlier verify FAIL for UNTESTED Project install root was remediated before archive (vitest `initMcps (bundled complexity script)`); do not treat that snapshot as current.
- `gentle-ai sdd-verify-validate` unavailable on gentle-ai 3.7.0; verify-report was persisted by orchestrator after evidence review — **not** a CRITICAL archive blocker.

### Accepted design deviations (product reality — do not reopen)

| Deviation | Why accepted |
|-----------|--------------|
| ESLint **10** + eslint-plugin-sonarjs **4** (design ranges were ^9/^3) | ESLint 10 exports `includeIgnoreFile`; sonar peer range |
| Shipped config named `complexity.eslint.config.mjs` (not `eslint.config.mjs`) | Avoids lint-staged auto-loading scoring rules against script sources |
| Per-run temp eslint config under script root | ESM module cache would freeze first consumer `.gitignore` if only static URL used |

### Acceptable remaining warnings at close (non-blocking)

1. Admission of verify-report was manual because gentle-ai 3.7.0 lacks `sdd-verify-validate` (orchestrator-authorized).
2. Node engines field may warn on nearby majors (warnings only).

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `scripts-install` | Updated | Native compose: REMOVED "Empty structure"; ADDED "Bundled complexity script" (2 scenarios). Unrelated requirements preserved. |
| `catalog-scripts-complexity` | Created | Mechanical `cp` of full change spec (7 requirements / 12 scenarios). Empty `diff -r` source vs temp before `mv`. |

Compose invocation (existing domain):

```bash
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/scripts-install/spec.md" \
  --delta "openspec/changes/catalog-complexity-script/specs/scripts-install/spec.md" \
  --output "openspec/specs/scripts-install/spec.md.compose-tmp" \
&& mv "openspec/specs/scripts-install/spec.md.compose-tmp" "openspec/specs/scripts-install/spec.md"
```

Compose exit: 0.

New-domain mechanical copy diff readback (verbatim empty):

```text
(empty — no differences)
```

`DIFF_EXIT=0`

Note: `scripts-install` Purpose prose still says “Structure only; no concrete scripts.” Requirement body correctly allows `complexity`; Purpose is non-requirement narrative left unchanged by native compose.

## Archive Move

- Source: `openspec/changes/catalog-complexity-script`
- Destination: `openspec/changes/archive/2026-10-05-catalog-complexity-script`
- Method: `git mv` when tracked, else `mv` (skill fallback path)
- Pre-move snapshot vs destination `diff -r`: empty (byte-identical)
- Archive date: 2026-10-05

### Verbatim `diff -r` (snapshot vs destination)

```text
(empty — no differences)
```

`DIFF_EXIT=0`

### Archive Contents

- proposal.md
- exploration.md
- research.md
- preproposal.md
- design.md
- tasks.md (19/19 complete)
- verify-report.md (PASS; admission manual)
- apply-progress.md
- specs/catalog-scripts-complexity/spec.md
- specs/scripts-install/spec.md
- archive-report.md (this file; additive)

## Observation IDs (Engram traceability)

| Artifact | Observation ID | Topic key |
|----------|----------------|-----------|
| proposal | #1277 | `sdd/catalog-complexity-script/proposal` |
| spec | #1283 | `sdd/catalog-complexity-script/spec` |
| design | #1284 | `sdd/catalog-complexity-script/design` |
| tasks | #1294 | `sdd/catalog-complexity-script/tasks` |
| apply-progress | #1299 | `sdd/catalog-complexity-script/apply-progress` |
| verify-report | #1320 | `sdd/catalog-complexity-script/verify-report` |
| verify-pass (decision) | #1321 | `sdd/catalog-complexity-script/verify-pass` |
| archive-report | #1322 | `sdd/catalog-complexity-script/archive-report` |

Filesystem locators (hybrid):

- `openspec/changes/archive/2026-10-05-catalog-complexity-script/`
- `openspec/specs/scripts-install/spec.md`
- `openspec/specs/catalog-scripts-complexity/spec.md`

## Stacked delivery at archive time

| PR | Role | Notes |
|----|------|-------|
| [#176](https://github.com/JSisques/shitaku/pull/176) | Foundation | CI pass |
| [#177](https://github.com/JSisques/shitaku/pull/177) | Behavior | Stacked on #176 |
| [#178](https://github.com/JSisques/shitaku/pull/178) | Docs | Stacked on #177; archive PR targets this head |

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change (orchestrator opens archive PR).

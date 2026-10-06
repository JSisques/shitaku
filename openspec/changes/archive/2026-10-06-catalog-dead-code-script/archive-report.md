# Archive Report: catalog-dead-code-script

## Summary

Change `catalog-dead-code-script` (issue https://github.com/JSisques/shitaku/issues/146) is archived and closed. All **17/17** tasks are complete across stacked PR1–PR3 plus install-root remediation. Verify **PASS WITH WARNINGS** (11/11 requirements, 19/19 scenarios, 0 CRITICAL) after adding `initMcps (bundled dead-code script)` for Project install root dead-code. Main specs now include capability `catalog-scripts-dead-code` and an updated `scripts-install` (Bundled complexity script RENAMED → Bundled catalog scripts; MODIFIED to list/ship both `complexity` and `dead-code`). Active change folder moved to `openspec/changes/archive/2026-10-06-catalog-dead-code-script/`.

## Final State at Close

| Field | Value |
|-------|-------|
| Verdict | PASS WITH WARNINGS (0 CRITICAL blockers at close) |
| Tasks | 17/17 complete (Task Completion Gate passed; 0 unchecked) |
| Spec compliance | 11/11 requirements, 19/19 scenarios COMPLIANT |
| Tests at verify | **870 passed / 45 files** (`pnpm test` exit 0); tip `62337fb` has install-root remediation |
| Quality gates | typecheck, lint, format:check, build, docs:catalog:check, docs:website-catalog:check — all exit 0 |
| Delivery | Stacked PRs: #184 registration → #185 behavior → #186 docs; archive PR targets #186 head `feat/catalog-dead-code-docs` @ `62337fb` |
| Shipped behavior (on tip) | Bundled `dead-code` under `catalog/scripts/dead-code/`; knip via cwd `.bin` then `npx`; envelope `shitaku.catalog.dead-code/v1`; no script-root npm bootstrap; docs/tables list `complexity` and `dead-code` |

### Final-state authority notes

- Explicit orchestrator final-state facts outrank intermediate `apply-progress` / early verify snapshots.
- Install-root gap for Project install root dead-code was remediated in commit `62337fb` on `feat/catalog-dead-code-docs` (`initMcps (bundled dead-code script)`); do not treat pre-remediation UNTESTED claims as current.
- `gentle-ai sdd-verify-validate` unavailable on gentle-ai 3.7.0 (same as complexity archive) — **not** a CRITICAL archive blocker; verify-report present and verdict PASS WITH WARNINGS with 0 CRITICAL.

### Acceptable remaining warnings at close (non-blocking)

1. Admission of verify-report was without `sdd-verify-validate` because gentle-ai 3.7.0 lacks it (same precedent as complexity).
2. Node engines field may warn on nearby majors (warnings only).

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `scripts-install` | Updated | Native compose: RENAMED "Bundled complexity script" → "Bundled catalog scripts"; MODIFIED to require `complexity` and `dead-code` (3 scenarios). Unrelated requirements preserved. |
| `catalog-scripts-dead-code` | Created | Mechanical `cp` of full change spec (9 requirements / 16 scenarios). Empty `diff -r` source vs temp before `mv`. |

Compose invocation (existing domain):

```bash
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/scripts-install/spec.md" \
  --delta "openspec/changes/catalog-dead-code-script/specs/scripts-install/spec.md" \
  --output "openspec/specs/scripts-install/spec.md.compose-tmp" \
&& mv "openspec/specs/scripts-install/spec.md.compose-tmp" "openspec/specs/scripts-install/spec.md"
```

Compose exit: 0.

New-domain mechanical copy diff readback (verbatim empty):

```text
(empty — no differences)
```

`DIFF_EXIT=0`

Note: `scripts-install` Purpose prose still says “Structure only; no concrete scripts.” Requirement body correctly allows `complexity` and `dead-code`; Purpose is non-requirement narrative left unchanged by native compose (delta had no Purpose update).

## Archive Move

- Source: `openspec/changes/catalog-dead-code-script`
- Destination: `openspec/changes/archive/2026-10-06-catalog-dead-code-script`
- Method: `git mv`
- Pre-move snapshot vs destination `diff -r`: empty (byte-identical)
- Archive date: 2026-10-06

### Verbatim `diff -r` (snapshot vs destination)

```text
(empty — no differences)
```

`DIFF_EXIT=0`

### Archive Contents

- proposal.md
- exploration.md
- research.md
- design.md
- tasks.md (17/17 complete)
- verify-report.md (PASS WITH WARNINGS; 0 CRITICAL)
- apply-progress.md
- specs/catalog-scripts-dead-code/spec.md
- specs/scripts-install/spec.md
- archive-report.md (this file; additive)

## Observation IDs (Engram traceability)

| Artifact | Observation ID | Topic key |
|----------|----------------|-----------|
| explore | #1324 | `sdd/catalog-dead-code-script/explore` |
| proposal | #1326 | `sdd/catalog-dead-code-script/proposal` |
| research | #1327 | `sdd/catalog-dead-code-script/research` |
| specs | #1328 | `sdd/catalog-dead-code-script/specs` |
| spec | #1329 | `sdd/catalog-dead-code-script/spec` |
| design | #1330 | `sdd/catalog-dead-code-script/design` |
| tasks | #1331 | `sdd/catalog-dead-code-script/tasks` |
| apply-progress | #1332 | `sdd/catalog-dead-code-script/apply-progress` |
| verify-report | #1336 | `sdd/catalog-dead-code-script/verify-report` |
| verify-pass (decision) | #1337 | `sdd/catalog-dead-code-script/verify-pass` |
| archive-report | (this save) | `sdd/catalog-dead-code-script/archive-report` |

Filesystem locators (hybrid):

- `openspec/changes/archive/2026-10-06-catalog-dead-code-script/`
- `openspec/specs/scripts-install/spec.md`
- `openspec/specs/catalog-scripts-dead-code/spec.md`

## Stacked delivery at archive time

| PR | Role | Notes |
|----|------|-------|
| [#184](https://github.com/JSisques/shitaku/pull/184) | Registration | Foundation |
| [#185](https://github.com/JSisques/shitaku/pull/185) | Behavior | Stacked on #184 |
| [#186](https://github.com/JSisques/shitaku/pull/186) | Docs | Stacked on #185; tip `62337fb` includes install-root remediation; archive PR targets this head |

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change (orchestrator opens archive PR).

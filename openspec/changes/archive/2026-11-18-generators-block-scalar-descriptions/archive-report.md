# Archive Report: generators-block-scalar-descriptions

**Archived**: 2026-11-18
**Archive folder**: `openspec/changes/archive/2026-11-18-generators-block-scalar-descriptions/`
**Store**: hybrid (Engram `sdd/generators-block-scalar-descriptions/archive-report` plus filesystem)
**Branch**: `docs/archive-generators-block-scalar-descriptions` (chained on `chore/generators-block-scalar-descriptions-301`, PR #315)

## Summary

The change is archived and closed. Delta specs were merged into the main specs, and the change folder was moved to the archive with a git-tracked move and a verified byte-identical readback. Implementation and verification are complete. The one accepted open finding is recorded below.

## Artifacts Read

| Artifact | Locator | Observation / file | Notes |
|---|---|---|---|
| verify-report | Engram `sdd/generators-block-scalar-descriptions/verify-report` | observation #1710 | Intermediate snapshot. Copied to `verify-report.md` in the archive (additive, no source file existed). |
| tasks | `openspec/changes/generators-block-scalar-descriptions/tasks.md` | file | Checkbox state at close: 30 `[x]`, 0 `[ ]`. Archived unchanged. |
| specs | `openspec/changes/generators-block-scalar-descriptions/specs/` | files | Two delta specs: `catalog-docs-generators` (new capability), `website` (MODIFIED). |
| proposal, design | `openspec/changes/generators-block-scalar-descriptions/` | files | Present and archived unchanged. Not re-read in full during archive; the archive relied on the mechanical copy and readback. |

## Final State at Close

Ranked per the Final-State Authority hierarchy: persisted tasks artifact first, then the launch-prompt final-state facts, then the verify-report snapshot.

- **Tasks**: all 30 tasks (1.1 to 6.3) are checked. Source: tasks.md, at close.
- **Verification**: PASS at verification time, with 0 CRITICAL, 2 WARNING, 4 SUGGESTION (observation #1710). Post-verify commits resolved most findings, as listed below.
- **Tests**: 62 files / 1677 tests passing. Source: final-state facts from the orchestrator launch prompt. The 1670 count in #1710 was taken at verification time and is superseded. Not re-run by this archive phase.
- **Native review**: approved by the 4-lens review, with 3 non-blocking suggestions, all addressed.

### Findings disposition

| Finding (per #1710) | Final state | Where it landed |
|---|---|---|
| WARNING1: commit 9590ab7 body lacks the "22.13 -> 22.18" published-minimum statement | **Open, accepted.** The sandbox blocked the reword. The note was placed in the PR #315 body instead. | PR #315 body. Commit 9590ab7 unchanged. |
| WARNING2: `website/package.json` `engines.node` was invalid (`v26.10.0`) | **Resolved** | 3ed447f, set to `>=22.18` |
| SUGGESTION1: `BLOCK_CASES` duplicated literals in `test/generators.test.ts` | **Resolved** | 8e8e8b4 |
| SUGGESTION2: ENOENT error in `scripts/lib/frontmatter-description.mjs` lacked the label prefix | **Resolved** | 025b6ad |
| SUGGESTION3: no test for the missing or blank description path | **Resolved** | 8e8e8b4 |
| SUGGESTION4: README:598 pins 22.22.1; git-hooks spec pins 22.22.1; CONTRIBUTING pins 22.23.3 | **Follow-up, not fixed.** README and git-hooks spec left intentionally untouched. | Recorded as follow-up. |

Node was verified only on 22.18.0 and 22.23.3, and only for type stripping.

## Specs Synced

| Domain | Action | Details |
|---|---|---|
| `catalog-docs-generators` | Created | New capability. Full spec copied from the delta (7 requirements). |
| `website` | Updated | MODIFIED 2 requirements ("Catalog emitter and profiles", "Isolated website workflow and root gates") via `gentle-ai sdd-archive-compose`. 0 added, 0 removed. |

Composition evidence: `gentle-ai sdd-archive-compose --canonical openspec/specs/website/spec.md --delta openspec/changes/generators-block-scalar-descriptions/specs/website/spec.md --output openspec/specs/website/spec.md.compose-tmp && mv ...`, exit 0.

After composition, `prettier --check` flagged one missing trailing blank line in `openspec/specs/website/spec.md`. `prettier --write` added that line. The main spec is now prettier-clean. This edit is on the main spec only, not on an archived artifact.

## Archive Move

`git mv openspec/changes/generators-block-scalar-descriptions openspec/changes/archive/2026-11-18-generators-block-scalar-descriptions`, exit 0. The source directory is confirmed absent.

## Mechanical Readback (diff -r)

Verbatim outputs:

- Main spec copy `openspec/changes/generators-block-scalar-descriptions/specs/catalog-docs-generators/spec.md` vs `openspec/specs/catalog-docs-generators/spec.md`: empty output, exit 0.
- Archive move, source snapshot taken before the move vs `openspec/changes/archive/2026-11-18-generators-block-scalar-descriptions`: empty output, exit 0.

The website spec was produced by composition, not by a byte copy, so it is not part of a `diff -r` comparison. Its composition exit code is recorded above.

`verify-report.md` and `archive-report.md` are additive. They did not exist in the source snapshot and are excluded from the comparison.

## Active Changes

`openspec/changes/generators-block-scalar-descriptions/` no longer exists. The change is closed.

## Unfinished Tasks and Unresolved Findings

- Unfinished tasks: none. 30 of 30 checked.
- Open, accepted: WARNING1 (commit 9590ab7 body wording). The statement lives in the PR #315 body.
- Follow-up: SUGGESTION4 (differing Node version pins across README, git-hooks spec, and CONTRIBUTING).

## Delivery

Commit and push are separate decisions under ordinary repository policy. This phase committed the archive on the current branch and did not push.

## Risks

- Engram metadata: `mem_get_observation` returned `project: dotagent` for observation #1710, while `mem_search` reported `project: shitaku`. The content is the verify-report for this change. The discrepancy was not resolved in Engram.
- Proposal and design were not re-read in full during this phase. Their archive copy is covered by the `diff -r` readback.

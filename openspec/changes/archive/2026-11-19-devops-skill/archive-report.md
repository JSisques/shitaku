# Archive Report: add-devops-skill

**Issue**: GitHub #272
**Archived**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-devops-skill/`
**Main spec created**: `openspec/specs/devops-skill/spec.md`

## Final State at Close

Final-state facts from the orchestrator launch prompt outrank the intermediate snapshots below.

- **Tasks**: all tasks are complete. The persisted `tasks.md` has 23 checkboxes, all checked (0 unchecked). The launch prompt states 28/28. The file is the higher-ranked source for completion, so 23 is recorded as the checkbox total. The discrepancy is noted, not resolved by rewriting the file. Engram `sdd/add-devops-skill/tasks` (#1800) preview names 5 phases and no total.
- **Implementation commits**:
  - `9a81e4f` `feat(catalog): add devops skill`
  - `a9fb1ca` `docs: list devops skill in README and website` (generated docs)
  - `5381c68` `docs(openspec): add add-devops-skill change`
  - `2bf8304` `docs(openspec): mark add-devops-skill tasks complete`
  - `30960ac` `docs(catalog): clarify devops example health check is a placeholder`
- **Verification**: `verify-report` (#1802) recorded PASS with 0 CRITICAL, 0 WARNING, 2 SUGGESTION, at verify time.
  - Suggestion 1 (the `HEALTHCHECK` in the example references `dist/healthcheck.js`, which the example never creates) was fixed in `30960ac`. The fix is a placeholder note at `catalog/skills/devops/SKILL.md` line 81. The `HEALTHCHECK` line itself (line 98) is unchanged and remains illustrative. The stale open-gap wording in #1802 is not current state.
  - Suggestion 2 (the example does not show digest pinning) was intentionally not applied. The rule is covered in prose at `SKILL.md` line 20. This is an accepted, deliberate omission, not an open gap.
- **Test counts**: 2574 passed, 1 skipped, per `verify-report` #1802 at verify time. The launch prompt states all gates green at close. No later test count was supplied, so the verify-time count is recorded as such.
- **Spec size**: the delta spec file has 13 requirements and 29 scenarios. Engram `sdd/add-devops-skill/spec` (#1798) says 15 requirements and 31 scenarios. The file is the higher-ranked source for its own content, so 13/29 is recorded. The discrepancy is noted, not resolved by editing the spec.

## Observations Read (traceability)

| Artifact | Engram topic key | Observation ID | Read in full |
|---|---|---|---|
| proposal | `sdd/add-devops-skill/proposal` | #1797 | yes |
| spec (delta) | `sdd/add-devops-skill/spec` | #1798 | yes (mirror summary; full text read from file) |
| design | `sdd/add-devops-skill/design` | #1799 | yes (mirror summary; full text read from file) |
| tasks | `sdd/add-devops-skill/tasks` | #1800 | yes (mirror summary; full text read from file) |
| verify-report | `sdd/add-devops-skill/verify-report` | #1802 | yes |
| apply-progress | `sdd/add-devops-skill/apply-progress` | not located | not required by launch prompt; not searched |
| explore | `sdd/add-devops-skill/explore` | not read | filesystem copy `explore.md` archived |

The filesystem copies of these artifacts are in this archive folder: `proposal.md`, `explore.md`, `design.md`, `tasks.md`, `specs/devops-skill/spec.md`. No `verify-report.md` or `apply-progress.md` file exists in the change folder.

## Specs Synced

| Domain | Action | Details |
|---|---|---|
| devops-skill | Created | `openspec/specs/devops-skill/spec.md` did not exist. The delta spec was copied as the full spec (13 `ADDED` requirements, no `MODIFIED`, `REMOVED`, or `RENAMED` sections). `sdd-archive-compose` was not used because it merges into an existing canonical spec. Same procedure as the `api-design-skill` archive. |

## Mechanical Readback (verbatim `diff -r`, empty = pass)

Main spec creation (delta copied to temp file with `cp`, `diff -r` against the delta, then `mv` into place; readback after move):

```
(empty output, exit 0)
```

Archive move (pre-move snapshot of `openspec/changes/add-devops-skill/` taken with `cp -R` versus the archived folder after `git mv`):

```
(empty output, exit 0)
```

Source directory `openspec/changes/add-devops-skill/` confirmed absent after the move.

Main spec versus archived delta spec: empty output, exit 0.

Prettier: `pnpm exec prettier --check` on `openspec/specs/devops-skill/spec.md` passed. `openspec/changes/archive/` is in `.prettierignore`, so the archived files were not rewritten.

## Open Items and Risks

- **Unverified Dockerfile details**: the design's Dockerfile details (`node:22.13-bookworm-slim` tag, `RUN --mount` syntax, `USER node`) were not confirmed against primary sources. Tasks 0.1 and 0.2 are marked complete, but no primary-source evidence for them was found in the artifacts read. The shipped `SKILL.md` (lines 85 and 92) uses `node:22.13-bookworm-slim`, not the fallback `node:22-bookworm-slim`. The archive did not re-verify the tag.
- **Engram project label mismatch**: `mem_get_observation` returned `project: "dotagent"` with `project_path` set to the shitaku repository, while `mem_search` reported `project: "shitaku"`. The archive report is saved under `shitaku` as instructed.
- **Count discrepancies**: task total (23 in file vs 28 in launch prompt) and spec size (13 requirements / 29 scenarios in file vs 15 / 31 in Engram #1798). Recorded above; no artifact was edited to reconcile them.
- **Commit and push**: the archive commit is local only. No push and no PR, per the launch prompt.

## Key Learnings

1. A tracked change folder moves cleanly with `git mv`, so no plain `mv` fallback was needed.
2. A new domain spec is created by copying the delta with `cp` and verifying with `diff -r`, matching the `api-design-skill` archive.
3. Persisted `tasks.md` checkboxes and launch-prompt totals can disagree, so the file governs the recorded count.
4. Verify-time suggestions can be fixed in later commits, so the archive report cites the fix commit instead of the stale snapshot.

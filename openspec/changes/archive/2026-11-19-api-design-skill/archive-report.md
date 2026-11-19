# Archive Report: api-design-skill

**Issue**: GitHub #266
**Archived**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-api-design-skill/`
**Main spec created**: `openspec/specs/api-design-skill/spec.md`

## Final State at Close

Final-state facts from the orchestrator launch prompt outrank the intermediate snapshots below.

- **Tasks**: 23 of 23 checked in `tasks.md` (observed in the archived file; 0 unchecked). Engram `sdd/api-design-skill/tasks` (#1791) preview text says 26 tasks; the persisted file has 23 checkboxes. The file is the higher-ranked source, so 23 is recorded.
- **Implementation commits** (branch `docs/archive-api-design-skill`, stacked on `feat/api-design-skill`):
  - `574b1a5` `feat(catalog): add api-design skill`
  - `57bff90` `docs: list api-design skill in README and website`
  - `5af4c58` `fix(catalog): align api-design example with its hard rules`
- **Verification**: `verify-report` (#1794) recorded PASS with 0 CRITICAL, 0 WARNING, 3 SUGGESTION, at verify time. Per the launch prompt:
  - Suggestions 1 (add `security` scheme to the OpenAPI example) and 2 (add `Location` header to the 201 response) were fixed in `5af4c58`. The stale open-gap wording in #1794 is not current state.
  - Suggestion 3 (name `product-owner` and `docs-writing` in the Not-for sentence) was intentionally not applied, to avoid coupling the skill to catalog internals. This is an accepted, deliberate omission, not an open gap.
- **Test counts**: the 2573 passed / 1 skipped figure is from verify time (#1794). It was not re-run at archive, and the launch prompt gives no later count. Treat it as the verify-time result, not the final-state count.
- **Citations**: the launch prompt records that RFC 9457 (obsoletes 7807), RFC 9745, RFC 8594, and the Idempotency-Key IETF draft (rev 08) were checked against primary sources.

## Observations Read (traceability)

| Artifact | Engram topic key | Observation ID | Read in full |
|---|---|---|---|
| proposal | `sdd/api-design-skill/proposal` | #1788 | yes |
| spec (delta) | `sdd/api-design-skill/spec` | #1789 | yes |
| design | `sdd/api-design-skill/design` | #1790 | yes |
| tasks | `sdd/api-design-skill/tasks` | #1791 | yes |
| apply-progress | `sdd/api-design-skill/apply-progress` | #1793 | yes |
| verify-report | `sdd/api-design-skill/verify-report` | #1794 | yes |
| explore | `sdd/api-design-skill/explore` | #1787 | located only, not read in full |

The filesystem copies of these artifacts are in this archive folder (`proposal.md`, `explore.md`, `design.md`, `tasks.md`, `specs/api-design-skill/spec.md`). No `verify-report.md` or `apply-progress.md` file exists in the change folder.

## Specs Synced

| Domain | Action | Details |
|---|---|---|
| api-design-skill | Created | `openspec/specs/api-design-skill/spec.md` did not exist. The delta spec was copied as the full spec (14 `ADDED` requirements, no `MODIFIED`, `REMOVED`, or `RENAMED` sections). `sdd-archive-compose` was not used because it merges into an existing canonical spec. |

## Mechanical Readback (verbatim `diff -r`, empty = pass)

Main spec creation (delta copied with `cp`, then `diff -r` against the delta):

```
(empty output, exit 0)
```

Archive move (pre-move snapshot of `openspec/changes/api-design-skill/` versus archived folder):

```
(empty output, exit 0)
```

Re-verification after `pnpm run format` (archived folder versus snapshot, and main spec versus archived delta): both empty, exit 0.

## Open Items and Risks

- **Pending memory conflict flags**: Engram returned `conflict: contested by #obs-0d12be7d85decf1d (pending)` on #1788 (proposal), #1790 (design), and #1791 (tasks). The conflicting observation was not inspected, and no `mem_judge` verdict was recorded. Content was not altered on this basis.
- **Project label mismatch**: `mem_get_observation` returned `project: "dotagent"` with `project_path` set to the shitaku repository, while `mem_search` reported `project: "shitaku"`. The archive report is saved under `shitaku` as instructed.
- **Archive atomicity**: the mechanical move used the snapshot-verified `mv` fallback because the change folder was untracked (`git mv` refused with status 128 and made no change). The pre-move snapshot was taken and verified before the move.
- **Format pass**: `pnpm run format` reported every file unchanged. `openspec/changes/archive/` is in `.prettierignore`, so the archived files were not rewritten.
- **Commit and push**: none performed, per the launch prompt.

## Key Learnings

1. Untracked change folders cannot be moved with `git mv`, so the archive step falls back to a snapshot-verified `mv`.
2. `sdd-archive-compose` merges into an existing canonical spec, so a new domain spec is created by copying the delta with `cp` and verifying with `diff -r`.
3. Engram preview text for a tasks artifact can disagree with the persisted file; the persisted checkboxes are the authoritative count.
4. Archive report snapshots must be reconciled against later fix commits, because verify-time findings can be fixed after the report is written.

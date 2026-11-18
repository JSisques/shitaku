# Archive Report: add-pr-creator-agent

**Archived on**: 2026-11-18
**Archived to**: `openspec/changes/archive/2026-11-18-add-pr-creator-agent/`
**Artifact store**: hybrid (filesystem + Engram)
**Final state**: archived and closed. Implementation is complete except optional task 5.3, which was not run.

## Artifact Sources and Observation IDs

Files were read from their repository paths. Engram topic keys were recorded for traceability.

| Artifact | Locator | Observation ID | Present |
|----------|---------|----------------|---------|
| explore | `openspec/changes/add-pr-creator-agent/exploration.md` | 1648 (Engram `sdd/add-pr-creator-agent/explore`) | yes |
| proposal | `openspec/changes/add-pr-creator-agent/proposal.md` | 1654 | yes |
| spec (delta) | `openspec/changes/add-pr-creator-agent/specs/pr-creator-agent/spec.md` | 1656 | yes |
| design | `openspec/changes/add-pr-creator-agent/design.md` | 1658 | yes |
| tasks | `openspec/changes/add-pr-creator-agent/tasks.md` | 1664 | yes |
| apply-progress | `sdd/add-pr-creator-agent/apply-progress` | 1671 | Engram only; no `apply-progress.md` file in the change folder |
| verify-report | `openspec/changes/add-pr-creator-agent/verify-report.md` | 1674 | yes |

Related Engram records: `sdd/add-pr-creator-agent/state` (1667) recorded the authorization chain for verify, PR, archive, and the stacked follow-up PR. `sdd/add-pr-creator-agent/decisions` (1651) recorded the draft-flag default (`draft: false` unless the caller asks).

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `pr-creator-agent` | Created (new capability) | Delta spec is a full spec with only an `ADDED Requirements` section and no existing main spec. Copied mechanically to `openspec/specs/pr-creator-agent/spec.md`. 0 modified, 0 removed, 14 requirements added. |

Readback (`diff -r` of delta source vs. main spec), verbatim output:

```
(empty output)
```

## Archive Move

Source `openspec/changes/add-pr-creator-agent` was moved with `git mv` to `openspec/changes/archive/2026-11-18-add-pr-creator-agent`. The destination was verified free before the move.

Readback (`diff -r` of pre-move snapshot vs. archived folder), verbatim output:

```
(empty output)
```

The active `openspec/changes/add-pr-creator-agent` path no longer exists. This archive-report file is additive and was written after the move, so it is excluded from the comparison above.

## Archive Contents

- `proposal.md`: present
- `specs/pr-creator-agent/spec.md`: present
- `design.md`: present
- `tasks.md`: present. 20 of 21 checkboxes complete. 1 unfinished (5.3).
- `exploration.md`: present
- `verify-report.md`: present (intermediate snapshot, see Final State below)
- `apply-progress.md`: absent from the folder. Its content is in Engram observation 1671.

Archived files were not modified. Their checkboxes and historical reports are kept as written.

## Final State

Sources were ranked per the Final-State Authority hierarchy: the tasks file first, then explicit final-state facts from the orchestrator launch prompt, then the verify-report and apply-progress snapshots.

**Implementation**: four commits landed the change: `e9a16e3` (feat: add pr-creator agent), `c7ff283` (docs: list agent in README and website), `b697950` (test: account for bundled agent in interactive prompt tests), and `2bf1e00` (docs: add change). Verify-report commit `37fd862` followed.

**Verification findings** (verify-report, at verification time): 0 CRITICAL, 2 WARNING, 2 SUGGESTION.

- WARNING 1 (create mode did not re-check the pushed head): FIXED in `9354f73`. `catalog/agents/pr-creator.md` line 22 now requires `mcp__github__list_branches` confirmation before `create_pull_request`. Confirmed present in the current source.
- WARNING 2 (test assertions missing for draft rule, close/reopen refusal, and pushed-branch re-check): FIXED in `9354f73`. Three assertions added to `test/adapters/catalog/bundled-catalog.test.ts` (`list_branches`, `Change \`draft\` only if`, `not supported`). Confirmed present in the current source.
- SUGGESTION 1 (`reviewers` listed as editable but not set by `update_pull_request`): NOT APPLIED. Per the launch prompt, the GitHub MCP README lists `reviewers` as a parameter of `update_pull_request`, so the suggestion's premise is disputed. Recorded as an open, unapplied suggestion.
- SUGGESTION 2 (task 5.3 unchecked): DEFERRED. The manual live-runtime check was not run. It is noted in the PR notes.

**Tests and checks**: the final full suite reported 1463 passing, with typecheck, lint, format, and build clean. This figure comes from the launch prompt and the apply-progress snapshot (1461 baseline, 1463 final). It was not re-run during archive.

**Unfinished work**:
- Task 5.3 (optional manual runtime check: invoke the installed agent in draft mode and confirm it returns a draft plus the "Confirmation required" block without calling a write tool). Not run. Deferred.
- SUGGESTION 1 (reviewers wording). Not applied.

**Follow-up, not in this change**: catalog dependency resolution. Installing the `pr-creator` agent does not install its required `pr-writing` skill or the `github` MCP. Track as a separate change.

**Record discrepancy**: Engram tasks observation 1664 describes "22 tasks". The tasks file has 21 checkboxes (20 checked, 1 unchecked). The file is authoritative per the hierarchy.

## Traceability

- PR #295 (open against `main`) closes issue #235. This archive commit is stacked on `feat/pr-creator-agent-235`.
- Stacked archive branch: `docs/archive-add-pr-creator-agent`.

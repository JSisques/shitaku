# Archive Report: agent-block-scalars

**Change**: agent-block-scalars (issue #238)
**Project**: shitaku
**Artifact store**: hybrid
**Archived**: 2026-11-18
**Archive folder**: `openspec/changes/archive/2026-11-18-agent-block-scalars/`
**Branch**: `docs/archive-agent-block-scalars` (stacked on `feat/agent-block-scalars`; PR #293)

## Summary

The change is archived and closed. Agent `name` and `description` may now be YAML block scalars (`|` or `>`), decoded by the opt-in nested frontmatter reader, with the description collapsed to one line. The delta specs are synced into the main specs `openspec/specs/catalog/spec.md` (2 MODIFIED requirements) and `openspec/specs/agents-install/spec.md` (1 ADDED requirement). The tasks artifact records every checkbox as complete (27 of 27 checkbox items; see the count discrepancy below). Verification verdict PASS at verification time, with no CRITICAL or WARNING findings and 2 SUGGESTIONS, both recorded below.

## Final State at Close

Source ranking: (1) persisted tasks artifact, (2) explicit final-state facts from the launch prompt, (3) intermediate snapshots (`verify-report`, `apply-progress`).

- **Tasks** (rank 1, observed in `tasks.md` in this folder): 27 checkbox items, 27 `[x]`, 0 unchecked.
- **Task count discrepancy** (unresolved by ranking): the launch prompt and the verify observation both state 32 of 32 tasks. The persisted `tasks.md` contains 27 checkbox items, all checked. The file is the higher-ranked source, so this report uses 27/27. The difference of 5 is not explained by any observed source; it is recorded here and not resolved silently. The completion state itself is not in dispute: no unchecked item exists in either source.
- **Verification verdict** (rank 3, per `verify-report` #1669, at verification time, 2026-11-18 08:41:46): PASS, 0 CRITICAL, 0 WARNING, 2 SUGGESTION. Transcribed to `verify-report.md` in this folder.
- **SUGGESTION 1** (whitespace-only lines inside a block scalar are treated as empty by the decoder): documented deviation in the change; no later fix recorded. Open as documented behavior.
- **SUGGESTION 2** (`scripts/generate-catalog-table.mjs` and `scripts/generate-website-catalog.mjs` still read `description:` line by line): follow-up required before any bundled agent adopts block scalars. Not fixed in this change; the bundled catalog ships no agent (`"agents": []`), so no current output is affected.
- **Test suite** (rank 2, launch prompt): 1497 of 1497 tests pass across 59 files. This matches the verify-time count (#1669).
- **Checks** (rank 2 and rank 3): typecheck, lint, format:check clean; build OK, per `verify-report` #1669 at verification time. No later change to these results was reported.
- **Commits** (rank 2, launch prompt; both hashes exist on the current branch history): `8fab41b` `feat(catalog): decode block scalars in agent frontmatter`, and `54f4c2b` `docs: document block scalar support for agents`. Both are shipped in PR #293.

## Artifacts Read

Engram (hybrid mode, topic-key locator):

- `sdd/agent-block-scalars/verify-report`: #1669 (intermediate snapshot; read with `mem_get_observation`)

File locators read from the change folder (hybrid mode, path locators):

- `tasks.md`: read for the checkbox count and task list
- `specs/catalog/spec.md` and `specs/agents-install/spec.md`: read for the delta contents and reconciled against the composed main specs

Present in the folder and moved mechanically, not read in this phase: `proposal.md`, `design.md`, `exploration.md`. Their content is covered by the mechanical readback below. Engram observations for `proposal`, `spec`, `design`, `tasks` were not read in this phase because the file locators were the declared source for this hybrid archive.

## Specs Synced

| Domain          | Action  | Details                                                                                  |
| --------------- | ------- | ---------------------------------------------------------------------------------------- |
| catalog         | Updated | 2 MODIFIED requirements (Agent catalog entries; Opt-in nested frontmatter reader), in place |
| agents-install  | Updated | 1 ADDED requirement (Block-scalar agents install verbatim), appended                     |

Composition evidence: `gentle-ai sdd-archive-compose --canonical openspec/specs/catalog/spec.md --delta openspec/changes/agent-block-scalars/specs/catalog/spec.md --output openspec/specs/catalog/spec.md.compose-tmp` exited 0, then `mv` to `openspec/specs/catalog/spec.md`. The same command for `agents-install` exited 0 with the agents-install delta and main spec paths. No manual merge was performed.

Mechanical cross-check of the synced main specs against the deltas (not a byte diff, because composition changes the file by design). Command: `rg -v -x -F -f <main spec> <delta spec>`, which prints every delta line absent from the main spec as a whole line. Verbatim output:

```
catalog:
## MODIFIED Requirements
agents-install:
# Delta for Agents Install
## ADDED Requirements
```

Every requirement and scenario line of both deltas appears verbatim in the synced main specs. The only lines absent are the delta document headers, which are not requirements. The `(Previously: ...)` notes from the deltas are retained in the main specs, consistent with earlier archived syncs in this repository.

Main-spec line diff for `catalog` removed lines is limited to the superseded text of the two MODIFIED requirements and the one superseded `THEN` clause of the nested-agent scenario. Untouched requirements are preserved.

## Archive Move

- Pre-move snapshot: recursive copy of `openspec/changes/agent-block-scalars` taken in the session scratchpad before the move.
- Move: `git mv openspec/changes/agent-block-scalars openspec/changes/archive/2026-11-18-agent-block-scalars` (succeeded; no plain-`mv` fallback needed).
- `verify-report.md` was written in the source folder before the snapshot, so it is part of the snapshot and of this readback. `archive-report.md` is additive, written after the readback in the archived folder.

## Mechanical Readback (diff -r)

Archive move (pre-move snapshot vs. archived folder), verbatim output:

```
(empty diff, exit 0)
```

Spec sync: see the cross-check above. A byte-identity `diff -r` does not apply to composed main specs; the line cross-check is the readback for them.

## Active Changes

`openspec/changes/agent-block-scalars/` no longer exists. The active changes directory no longer contains this change.

## Unfinished Tasks and Unresolved Findings

- Unfinished tasks: none observed in `tasks.md` (27 of 27 checkbox items complete). The 32-task figure in the launch prompt and in #1669 is not corroborated by the file; recorded above.
- Unresolved findings: none at CRITICAL or WARNING level. Two SUGGESTIONS, both recorded above. SUGGESTION 2 is an open follow-up for any future bundled agent that uses block scalars.
- Unrun checks: none recorded as pending. Checks listed above were observed at verification time; the 1497-test count is the close-time figure from the launch prompt.
- Contradictions between sources: the 32-task count (launch prompt, #1669) versus 27 checkbox items (`tasks.md`). Not resolved by ranking beyond using the file; both statements are recorded.

## Delivery

Commit, push, and PR decisions remain with the user and the orchestrator under ordinary repository policy. Nothing was committed, pushed, or opened as a PR in this phase.

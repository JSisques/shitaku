# Archive Report: add-rea-mcp-server

**Change**: add-rea-mcp-server
**Project**: shitaku
**Artifact store**: hybrid
**Archived**: 2026-11-17
**Archive folder**: `openspec/changes/archive/2026-11-17-add-rea-mcp-server/`
**Branch**: `docs/archive-add-rea-mcp-server` (stacked on `feat/rea-mcp-server`; issue #225)

## Summary

The change is archived and closed. The `rea` MCP server is bundled in the catalog with the exact pin `rea-agents@6.9.0`, verified (PASS at verification time; its one WARNING was fixed afterwards in `83dd1b0`), and its delta spec is now the main spec `openspec/specs/rea-mcp-server/spec.md`. All 19 tasks are checked. No unfinished tasks and no open findings remain.

## Final State at Close

Source ranking: (1) persisted tasks artifact, (2) launch-prompt final-state facts, (3) intermediate snapshots (`verify-report`, `apply-progress`).

- **Tasks** (rank 1, observed in `tasks.md`): 19 of 19 complete, 0 unfinished.
- **Verification verdict** (rank 3, per `verify-report` #1646, at verification time): PASS, 0 CRITICAL, 1 WARNING, 1 SUGGESTION.
- **WARNING** (description lacked the upstream Node engine requirement): RESOLVED after verification in commit `83dd1b0`. npm `rea-agents@6.9.0` `engines` is `^22.23.4 || ^24.22.1 || >=26.12.1` (checked with `npm view`). The `apply-progress` note that it needed `>=26.12.1` only was incomplete. The `rea.json` description now ends with "; server needs Node 22.23.4+, 24.22.1+ or 26.12.1+", the bundled-catalog test asserts it (RED then GREEN observed), and the README and website pages were regenerated. The stale claim from #1646 is superseded; do not treat it as open.
- **SUGGESTION** (no rea-specific "entry name mismatch" test; the generic loader tests cover it): accepted, no action.
- **Test suite** (rank 2, launch prompt): 59 files, 1462 tests pass at close. Matches the count at verification time.
- **Checks at close** (rank 2, launch prompt, at `83dd1b0`): `pnpm test`, typecheck, lint, format:check, docs:catalog:check, and docs:website-catalog:check all pass.
- **Upstream source**: npm `rea-agents` (MIT, repository `morluto/rea`), verified. The pin `6.9.0` intentionally deviates from the `6.5.0` written in issue #225 (npm `latest` at proposal time; user decision, observation #1631).

## Commits on This Change

Squashed history on `feat/rea-mcp-server`, in order:

- `3016595` docs(openspec): add add-rea-mcp-server change
- `909875b` feat(catalog): add rea mcp server (rea.json, catalog.json, bundled-catalog test, README, website en/es)
- `cb34aaf` docs(openspec): mark add-rea-mcp-server tasks complete
- `83dd1b0` fix(catalog): note rea server node engine requirement

The apply-progress snapshot (#1641) lists earlier hashes (`b1f6f60`, `b743583`) that no longer exist after the squash; they are superseded by the list above.

## Addition Beyond the Delta Spec

- `catalog/mcps/rea.json` description includes the Node engine requirement ("server needs Node 22.23.4+, 24.22.1+ or 26.12.1+"), added in `83dd1b0`. The delta spec only requires a one-line description that names the purpose and the Hopper, Ghidra or IDA prerequisite; that requirement is still met. The addition is not a spec requirement, so the main spec was copied verbatim and the addition is recorded here instead.

## Artifacts Read

Engram observation IDs read (hybrid mode; `mem_get_observation` on each topic key):

- `sdd/add-rea-mcp-server/proposal`: #1632
- `sdd/add-rea-mcp-server/spec`: #1633
- `sdd/add-rea-mcp-server/design`: #1634
- `sdd/add-rea-mcp-server/tasks`: #1635
- `sdd/add-rea-mcp-server/apply-progress`: #1641 (intermediate snapshot)
- `sdd/add-rea-mcp-server/verify-report`: #1646 (intermediate snapshot)
- Related, for traceability only: `sdd/add-rea-mcp-server/explore` #1630, `sdd/add-rea-mcp-server/decisions` #1631 (pin decision; it carries pending conflict flags in Engram that were not judged in this phase).

File locators read from the change folder: `proposal.md`, `design.md`, `tasks.md`, `specs/rea-mcp-server/spec.md`. Files were read to reconcile content; they were copied to their destinations only by shell commands.

## Specs Synced

| Domain          | Action                  | Details                                                    |
| --------------- | ----------------------- | ---------------------------------------------------------- |
| rea-mcp-server  | Created (new capability) | 6 requirements, no prior main spec; delta copied verbatim  |

## Archive Move

- Pre-move recursive snapshot of `openspec/changes/add-rea-mcp-server`, then `git mv` to `openspec/changes/archive/2026-11-17-add-rea-mcp-server` (rename preserved; no plain-`mv` fallback needed).
- Added after the move, additive only: `verify-report.md` (transcribed from Engram #1646) and this `archive-report.md`.

## Mechanical Readback (diff -r)

Spec sync (delta `openspec/changes/add-rea-mcp-server/specs/rea-mcp-server/spec.md` vs. new main spec `openspec/specs/rea-mcp-server/spec.md`), verbatim output:

```
(empty diff, exit 0)
```

Archive move (pre-move recursive snapshot vs. archived folder), verbatim output:

```
(empty diff, exit 0)
```

`verify-report.md` has no source file (it existed only in Engram), so `diff -r` cannot verify it byte-for-byte. It is a transcription of observation #1646. `archive-report.md` is additive and excluded from comparison.

## Active Changes

`openspec/changes/add-rea-mcp-server/` no longer exists. The active changes directory no longer contains this change.

## Unfinished Tasks and Unresolved Findings

- Unfinished tasks: none observed (19/19).
- Unresolved findings: none. The verify WARNING was fixed in `83dd1b0`; the SUGGESTION was accepted with no action.
- Unrun checks: none recorded as pending. The final checks listed above were observed at `83dd1b0`.
- Known open items at close, outside this change: the `6.9.0` pin will drift behind upstream by design (explicit catalog PR to bump). Re-verify the `mcp` subcommand on any bump.
- Contradictions between sources: the `apply-progress` engine note (">=26.12.1 only") is superseded by the `npm view` result above; the verify-time WARNING is superseded by `83dd1b0`. No unresolved contradictions.

## Delivery

Commit, push, and PR decisions remain with the user under ordinary repository policy. The archive commit is local on `docs/archive-add-rea-mcp-server`; the orchestrator handles any PR.

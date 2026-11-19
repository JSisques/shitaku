# Archive Report: resolve-agent-skills (#280)

**Archived**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-resolve-agent-skills/`
**Store mode**: hybrid (filesystem + Engram `sdd/resolve-agent-skills/archive-report`)

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| catalog | Updated | 0 added, 2 modified (`Agent catalog entries`, `Opt-in nested frontmatter reader`), 0 removed; 12 requirements total |
| agents-install | Updated | 1 added (`Declared skill resolution`), 0 modified, 0 removed; 9 requirements total |
| skills-install | Updated | 1 added (`Skills required by agents`), 0 modified, 0 removed; 7 requirements total |

Composition ran through `gentle-ai sdd-archive-compose` for all three domains (exit 0 each), with `.compose-tmp` plus `mv`. Command form: `gentle-ai sdd-archive-compose --canonical openspec/specs/{domain}/spec.md --delta openspec/changes/resolve-agent-skills/specs/{domain}/spec.md --output openspec/specs/{domain}/spec.md.compose-tmp && mv ...`.

## Archive Contents

- proposal.md: present
- design.md: present
- exploration.md: present
- specs/ (catalog, agents-install, skills-install): present
- tasks.md: present; 30 of 30 checkboxes checked (1.1-1.9, 2.1-2.5, 3.1-3.9, 4.1-4.4, 5.1-5.3); 0 unfinished
- verify-report: no file in the change folder; Engram `sdd/resolve-agent-skills/verify-report` (#1764) present
- apply-progress: no file in the change folder; Engram `sdd/resolve-agent-skills/apply-progress` (#1763) present as a snapshot

## Final State at Close

Source precedence follows the sdd-archive Final-State Authority ranking: tasks artifact first, launch-prompt final-state facts second, verify-report and apply-progress last.

- **Tasks**: all 30 checkboxes in `tasks.md` are checked (matches Engram `sdd/resolve-agent-skills/tasks` #1757, which records 30 tasks). The launch prompt stated "31 apply tasks plus 5.1-5.3"; the persisted tasks artifact contains 27 apply tasks (1.1-4.4) plus 3 remediation tasks (5.1-5.3), total 30. The tasks artifact outranks the launch prompt for completion visibility, so the count recorded here is 30. Contradiction noted, not otherwise resolved.
- **Verify verdict at verification time** (per `verify-report` #1764): 0 CRITICAL, 2 WARNING, 4 SUGGESTION.
  - WARNING 2 (no end-to-end tests for "Declared catalog skill is already present" and "Force replace of an auto-added skill"): fixed in commit 25af437, which adds the tests in `test/adapters/cli/program.test.ts`. Launch-prompt fact, corroborated by the commit.
  - WARNING 1 (no per-task RED/GREEN evidence table in apply-progress): accepted as a documented gap. Tests were co-committed with code, the suite is green, and a mutation check was run during remediation. The RED/GREEN history is not verifiable from the artifacts.
  - SUGGESTION 1 (skip reason wording mismatch): fixed in commit 35de608 (task 5.2). The agents-install spec now reads `already installed; required by agent docs-writer`.
  - SUGGESTION 2 (stale chain-strategy header in tasks.md): fixed in commit 35de608 (task 5.3). The header now reads `stacked-to-main`.
  - SUGGESTION 3 (`skills: ~` / `null` rejected as malformed): intentionally not done. Open as a noted decision.
  - SUGGESTION 4 (`[a b]` read as one name): intentionally not done. Open as a noted decision.
- **Checks at close** (run on the archive branch after the merge): suite 2117 tests in 70 files (verify-time count was 2115; 25af437 added tests). Typecheck, lint, format:check, test, build, and docs:catalog:check all exit 0. Prettier reformatted the three merged main specs (one added line each).
- **Stacked PRs**: #341 (main) <- #342 <- #343 <- #344 <- #345 <- this archive PR (final slice). #341 (about 474 changed lines in src and tests) and #343 (482) exceed the 400-line budget and carry an accepted `size:exception` (launch-prompt fact, not re-measured here).
- **Deferred follow-up**: website agent-install documentation update (R10). Not done in this change.

## Unfinished Work and Unresolved Findings

- Deferred: website agent-install docs update (R10).
- Accepted gap: no per-task RED/GREEN table in apply-progress (verify WARNING 1).
- Not done by decision: verify SUGGESTION 3 and SUGGESTION 4.

## Source Observations Read

- Engram `sdd/resolve-agent-skills/tasks` #1757 (read in full)
- Engram `sdd/resolve-agent-skills/verify-report` #1764 (read in full)
- Located, not read in full (preview only): `apply-progress` #1763, `spec` #1751, `proposal` #1749, `design` #1753, `explore` #1748

The openspec artifacts were moved mechanically and not read as model input.

## Mechanical Readback

Archive move: `git mv openspec/changes/resolve-agent-skills openspec/changes/archive/2026-11-19-resolve-agent-skills`. Source was snapshotted with `cp -R` before the move. Readback:

```
$ diff -r <snapshot>/change openspec/changes/archive/2026-11-19-resolve-agent-skills
(no output)
diff_exit=0
```

The change folder no longer exists under `openspec/changes/`. This archive-report file was added after the readback and is excluded from the comparison.

Spec composition readback: `git diff --stat` on the three main specs showed `openspec/specs/agents-install/spec.md` +136, `openspec/specs/catalog/spec.md` +145/-5, `openspec/specs/skills-install/spec.md` +33 (309 insertions, 5 deletions). Requirement counts were 12 to 12 (catalog), 8 to 9 (agents-install), and 6 to 7 (skills-install), matching the delta operations.

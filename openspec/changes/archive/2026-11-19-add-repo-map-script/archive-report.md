# Archive Report: add-repo-map-script

**Change**: add-repo-map-script (GitHub issue JSisques/shitaku#227)
**Archived**: 2026-11-19
**Artifact store**: hybrid (openspec files + Engram)
**Branch**: docs/archive-add-repo-map-script (stacked on feat/repo-map-script-markdown, head f6ae890)

## Final State at Close

Final-state facts from the orchestrator launch prompt outrank the intermediate `verify-report` and `apply-progress` snapshots.

- **Tasks**: 33/33 complete across three stacked slices, all `size:exception`, stacked-to-main:
  - Slice 1: PR #330 (scanner foundation, JSON only)
  - Slice 2: PR #331 (tokenizer, extractor, import resolution, graph)
  - Slice 3: PR #332 (Markdown rendering, catalog registration, scripts-install delta, docs; Closes #227)
- **Verification**: `sdd-verify` reported 0 CRITICAL, 5 WARNING, 9 SUGGESTION at verification time (per `verify-report`, observation #1746). The five warnings (W1-W5) and suggestions S4, S6, S7 were fixed in seven remediation commits, `3913616..f6ae890`:
  - `3913616` anchor `--ignore` patterns with a leading slash
  - `b255f20` exclude an output directory reached through a symlink
  - `8049f06` follow tsconfig `extends` for path aliases and strict
  - `401765f` accept a package.json with a byte order mark
  - `9084d09` describe the import graph and exported symbols (script description)
  - `31b7cea` align repo-map specs with the final behavior
  - `f6ae890` refresh repo-map tasks and add the verify report
- **Results at `f6ae890`** (run during archive, 2026-11-19): `pnpm run format:check` passed; `pnpm run test` reported `Test Files 80 passed (80)` and `Tests 2414 passed | 1 skipped (2415)`. Per the orchestrator's final-state facts, typecheck, lint, build, and docs checks were also green at `f6ae890`; they were not re-run during archive.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `catalog-scripts-repo-map` | Created | Full spec copied from the delta (new capability; no main spec existed) |
| `scripts-install` | Updated (MODIFIED) | `Bundled catalog scripts` requirement replaced via `gentle-ai sdd-archive-compose`; exit 0 |

Consolidation note: the MODIFIED requirement replaced the three per-script install-root scenarios (complexity, dead-code, duplication) with one "Existing siblings unchanged" scenario plus a "Project install root repo-map" scenario. Requirement text and sibling behavior are preserved; the scenario wording is the delta's, not a line-by-line carry-over.

## Archive Contents

- `proposal.md`: present
- `specs/catalog-scripts-repo-map/spec.md`: present
- `specs/scripts-install/spec.md`: present
- `design.md`: present
- `tasks.md`: present, 33/33 tasks checked
- `exploration.md`: present
- `verify-report.md`: present (intermediate snapshot; see Final State)
- `apply-progress`: Engram only (no openspec file in the change folder)

## Engram Observations Referenced

- `sdd/add-repo-map-script/explore`: #1718
- `sdd/add-repo-map-script/proposal`: #1730
- `sdd/add-repo-map-script/spec`: #1732
- `sdd/add-repo-map-script/design`: #1735
- `sdd/add-repo-map-script/tasks`: #1739
- `sdd/add-repo-map-script/apply-progress`: #1744
- `sdd/add-repo-map-script/verify-report`: #1746
- Delivery and decisions: #1731 (chain strategy, stacked-to-main), #1736 (three registered slices), #1742 (size:exception accepted), #1745 (PRs 2 and 3 opened), #1722 and #1728 (output location, determinism, language scope, Markdown cap)

Observation IDs were recorded from search results; the artifact content used for this archive was read from the openspec files, which are canonical for hybrid mode.

## Mechanical Readback

- Spec sync (`catalog-scripts-repo-map`): `cp` + `mv`, then `diff -r` against the change spec: empty.
- Spec sync (`scripts-install`): `gentle-ai sdd-archive-compose` exit 0, then `mv`. Diff shown in the `git diff` of `openspec/specs/scripts-install/spec.md` (9 insertions, 15 deletions).
- Archive move: `git mv openspec/changes/add-repo-map-script openspec/changes/archive/2026-11-19-add-repo-map-script`. Pre-move snapshot taken from `git archive HEAD` (the change folder was clean and fully tracked; the staged rename is 0 insertions, 0 deletions). `diff -r` of the snapshot against the archived folder: empty.

## Unfinished Work and Open Findings

Deferred follow-ups recorded at close (not fixed in this change):

- First-declarator-only extraction for `export const a = 1, b = 2`
- Tokenizer residuals: regex literal after `)`, JSX `/*`
- Signature spacing artifacts
- Richer default Markdown budget
- Missing-git case ignores `.gitignore`
- `mkdir` failure stderr path

Out of scope (separate issues): `shitaku new` (#226, #292), incremental cache (#290), AI summaries (#291).

## Contradictions

None observed between the launch prompt and the repository state.

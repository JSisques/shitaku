# Verify report: add-repo-map-script (#227)

Verified branch: `feat/repo-map-script-markdown` at 6f7f246 (slices 1-3). Mode: strict TDD, read-only diagnostics before archive.

## Verdict

0 CRITICAL, 5 WARNING, 9 SUGGESTION. 33/33 tasks checked.

## Gates

- typecheck, lint, format:check, build, docs:catalog:check, docs:website-catalog:check: exit 0.
- `pnpm test`: Test Files 80 passed (80), Tests 2407 passed | 1 skipped (2408). The skip is the designed "without git installed" test.
- Repo-map subset: 14 files, 464 passed | 1 skipped.
- Script coverage (v8, unit only; `index.mjs` is not instrumentable): 95.3% lines, 90.2% branches.

## Findings

### Warnings

- **W1** (slice 1, `index.mjs` `outputRelative`, `scan.mjs` `inOutput`): `--out` reached through a symlinked path (for example `--out "$PWD/mm"` from a symlinked cwd, or macOS `/tmp` versus `/private/tmp`) is lexically outside the realpath root, so the output directory was not excluded and run 2 listed `mm` in the tree. Violated "Own output excluded" and "Two runs identical".
- **W2** (slice 1, `glob.mjs` `normalize`): `--ignore /gen` (gitignore-style leading slash) matched nothing, a silent no-op.
- **W3** (slice 2, `project.mjs` `detectConventions`): `conventions.pathAliases` and `tsStrict` ignored tsconfig `extends` while the resolver followed it.
- **W4** (slice 3, spec drift): the Markdown requirement said "drop signatures, then reduce the tree", but the implementation collapses signatures to names, reduces tree depth, drops module blocks, then hard cuts. The CLI requirement kept staged-delivery prose ("until then markdown/both exit 2") and registration said "lands in slice N".
- **W5** (process): apply-progress had no TDD cycle evidence table; tasks.md slice-1 commit hashes were stale after the rebase; two possibly-empty test loops (`render-markdown.test.ts` task lines, `repo-map.test.ts` graph edges).

### Suggestions

- S1: `export const a = 1, b = 2` records the first declarator only.
- S2: residual tokenizer limits (regex after `)` gives a false import; JSX text `/*` swallows the rest of the file).
- S3: signatures keep spacing artifacts such as `f( a: number, b: string ): void`.
- S4: a BOM-prefixed `package.json` was recorded as `invalid-json`.
- S5: on this repository the Markdown is aggressively cut (203 modules: 91 collapsed, tree depth 1, 57 not listed, 31,597 of 32,000 chars); the cap works but utility is low.
- S6: `script.json` `description` omitted the import graph and exported symbols.
- S7: tasks.md website path wrong, proposal mentioned `test/fixtures`, design Open Questions unchecked.
- S8: with no git installed the scan falls back to a walk and does not honor `.gitignore` (documented).
- S9: an mkdir failure prints an absolute path on stderr only (not in the output files).

## Probes that passed

Two runs byte-identical (this repo, git temp repo, installed script via `shitaku run`); same tree in two directories; fixed-date git commit hash stable; own `.shitaku` and custom `--out` excluded in git and non-git (except W1); empty dir, no commit, symlink to symlink skipped, 1.1 MB file `too-large`, chmod 000 unreadable, CRLF, 400k-char pathological inputs (under 1 s, exit 0); no body text in any signature; no absolute paths or timestamps in JSON or Markdown; `--out package.json` and `--bogus` exit 2; `.gitignore` untouched; tracked files untouched; `src/` unchanged.

## Remediation

Fixed as new commits on top of 6f7f246, strict TDD (failing regression test first):

| Item | Commit                                                                                  |
| ---- | --------------------------------------------------------------------------------------- |
| W2   | 3913616 `fix(repo-map): anchor --ignore patterns with a leading slash`                  |
| W1   | b255f20 `fix(repo-map): exclude an output directory reached through a symlink`          |
| W3   | 8049f06 `fix(repo-map): follow tsconfig extends for path aliases and strict`            |
| S4   | 401765f `fix(repo-map): accept a package.json with a byte order mark`                   |
| S6   | 9084d09 `docs(repo-map): describe the import graph and exported symbols`                |
| W4   | 31b7cea `docs(openspec): align repo-map specs with the final behavior`                  |
| W5   | tasks.md hashes and website path refreshed, test loop guards added, this report written |

S7 is covered by W4 and W5.

### Deferred follow-ups (intentionally not fixed)

- First-declarator-only `export const a = 1, b = 2` (S1).
- Tokenizer residuals: regex after `)`, JSX `/*` (S2).
- Signature spacing artifacts (S3).
- Richer Markdown default budget (S5).
- Missing-git scan ignores `.gitignore` (S8, documented).
- mkdir failure prints the absolute path on stderr (S9).

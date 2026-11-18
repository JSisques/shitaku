# Verify Report: rules-deterministic-checks (#288)

Tip branch: `feat/rules-checks-3-evaluators` (PR1-3, #311-#314).

## Verdict

Implementation behaviorally COMPLIANT. 1 CRITICAL (strict-TDD evidence table missing in apply-progress, process-only), 2 WARNING, 5 SUGGESTION. Not blocking archive.

## Commands

All exit 0.

- `typecheck`: OK
- `lint`: OK
- `format:check`: OK
- `test`: 66 files / 1905 tests pass
- `build`: OK (`check-dist-aliases`: 64 files clean)

Targeted coverage on changed `src`: 98.61% statements, 92.23% branches, 99.26% lines. Uncovered: `safe-regex.ts:7-8` and `evaluate.ts:200` (unreachable `tool` case).

## Scope and design

- No diff in `package.json`, the lockfile, `src/adapters`, `src/application`, `src/ports` or `catalog/**`.
- Domain purity grep is empty.
- `RESERVED_RULE_KEYS` is gone.
- The opt-in mappings keep their shapes (a test asserts there is no `maps` key).
- The `z.preprocess` deviation is documented in the design Resolved Assumptions.
- `finalizeEvaluation` and `FindingDraft` were extra exports recorded only in apply-progress, not in the design Interfaces.
- Docs (README:353-365, CONTRIBUTING:252-255, security en:73,79 / es:54,61) state "declared but not enforced until #226"; none says reserved.
- Tasks: all `[x]` except 5.1 (intentional, needs merge).

## CRITICAL

apply-progress (#1707) has no TDD Cycle Evidence table. RED/GREEN counts exist only as prose for PR3 (4.1, 4.3, 4.5); PR1, PR2a and PR2b have none. Tests and `src` land in the same commits, so RED is not reconstructible.

Fix: append an honest table (PR3 from recorded counts, others "not recorded"), never fabricate.

## WARNING

1. `test/rules-docs.test.ts` does not assert that the docs describe the five types, the default severity and the glob/regex limits (spec MUST; satisfied by inspection only; the security pages lack the five types and the default severity).
2. `evaluate.test.ts` has no `evaluateRuleCheck`-level test for deterministic output (called twice), the "No violations" full tuple, or the `parseRule` to evaluate default severity `error`.

## SUGGESTION

1. The reader's YAML equivalence is covered only by 5 hand-written cases.
2. `''` to 0 lines is not observable through the public API (`max >= 1`).
3. Install bytes are covered at `planInit` level only.
4. `evaluate.ts` `parseOrThrow` (L84-88) vs `compileGlobs` silently dropping invalid globs (L~100).
5. Record `finalizeEvaluation` and `FindingDraft` in design.md.

## Learned

Engram search showed pending conflicts on #1701 and #1707 (`mem_judge` not resolved).

## Corrective pass

- W2: resolved by tests in `test/domain/checks/evaluate.test.ts` (determinism, empty tuple, default severity `error`).
- S2: resolved by exporting `countLines` and testing the empty string directly.
- W1: resolved by guard assertions in `test/rules-docs.test.ts` and by adding the five types and the default severity to the en/es security pages.
- S5: resolved in design.md Interfaces.
- C1: resolved by the TDD Cycle Evidence table in apply-progress, built only from recorded facts.
- S1, S3, S4: accepted as suggestions, no change.

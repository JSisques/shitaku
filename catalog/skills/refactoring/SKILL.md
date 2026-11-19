---
name: refactoring
description: 'Trigger: refactor code, clean up code, restructure, extract function, rename, remove duplication, reduce complexity. Refactor safely: tests first, behavior unchanged, small named steps, test after each step, atomic refactor commits.'
---

## Activation Contract

Use when asked to refactor, clean up, restructure, or simplify existing code without changing what it does. Not for new features, bug fixes, commit-message authoring, or pull request titles and descriptions.

## Hard Rules

- Inspect first: the test runner, test coverage of the target code, and the commit conventions.
- Safety net first: run the existing tests before touching code. When coverage is missing, write characterization tests that pin the current behavior (including surprising behavior), or stop and ask.
- Keep behavior unchanged: no new features, bug fixes, or public contract changes. Report bugs found instead of fixing them in the refactoring.
- Apply one named refactoring per step, the smallest useful one. Run the tests after every step; revert a failing step and never patch forward.
- Never edit existing tests to make them pass, except a pure rename of the symbol under test.
- Commit one `refactor:` commit per coherent step, never mixed with behavior changes. Follow the repository commit convention when one exists.
- No scope creep: mention unrelated cleanups as follow-ups instead of doing them.
- Stay generic: do not assume any repository-specific tool, runner, or path.

Named refactorings, one per step:

- Extract Function: a block needs a comment to explain it, or is duplicated.
- Inline Function: the body is as clear as the name, or the indirection adds nothing.
- Extract Variable: a complex expression is hard to read.
- Rename: a name does not reveal intent.
- Move Function or Field: it uses another module more than its own.
- Decompose Conditional: a condition or its branches are hard to read.
- Replace Conditional with Guard Clauses: nested conditionals hide the normal path.
- Replace Conditional with Polymorphism: the same type switch repeats in several places.
- Introduce Parameter Object: the same group of parameters travels together.
- Replace Magic Number with Constant: a literal carries unexplained meaning.
- Remove Dead Code: code is unreachable or unused (confirm with search and tests).

## Decision Gates

| Condition                                           | Action                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| No tests cover the target code                      | Write characterization tests first, or stop and ask                         |
| Baseline tests fail before any change               | Stop and report; do not refactor on a red baseline                          |
| Tests fail after a step                             | Revert the step and try a smaller one                                       |
| A bug is found while refactoring                    | Report it; fix it later in a separate `fix` change, not in this refactoring |
| The change would alter a public API or contract     | Stop and ask; treat it as a behavior change                                 |
| The request mixes refactoring with a feature        | Refactor first in `refactor:` commits, then hand off the feature            |
| The repository has refactoring or style conventions | Follow them over the defaults in this skill                                 |

## Execution Steps

1. Confirm the target code and the goal (readability, duplication, complexity).
2. Inspect the test runner, coverage of the target code, and commit conventions.
3. Run the tests and record a green baseline; stop and report if it is red.
4. Add characterization tests where coverage is missing and commit them separately.
5. Pick one named refactoring and apply it.
6. Run the tests; revert on failure, otherwise commit as `refactor:`.
7. Repeat steps 5 and 6 until the goal is met or the next step would change behavior.
8. Report the outcome.

## Output Contract

Return the named refactorings applied in order, the commits created, test results after each step, characterization tests added, reverted steps with the reason, bugs or behavior questions found but not fixed, and remaining refactoring opportunities.

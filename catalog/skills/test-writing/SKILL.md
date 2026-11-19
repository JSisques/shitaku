---
name: test-writing
description: 'Trigger: write tests, add unit tests, add test coverage, regression test, flaky test, what to mock. Write reliable tests: pick the right pyramid level, mock only boundaries, behavior-named cases, edge-case and regression checklists, no flakiness.'
---

## Activation Contract

Use when asked to write, add, or fix tests, raise test coverage, reproduce a bug with a regression test, or remove flakiness from a test suite. Not for refactoring safety nets (characterization tests written during a refactor), production code changes, commit messages, or pull request text.

## Hard Rules

- Repository conventions first: inspect the test runner, file layout, naming, helpers, and fixtures before writing; they win over the defaults in this skill.
- Pick the cheapest level that proves the behavior, following the test pyramid: many unit tests, fewer integration tests, few end-to-end tests.
- Mock only at boundaries: fake I/O, network, filesystem, clock, and randomness. Never mock the unit under test or its internal collaborators.
- Test behavior, not implementation: assert observable outcomes (return values, state, output, errors), not private calls or internal structure.
- One behavior per test, named after that behavior and structured as Arrange-Act-Assert.
- A regression test reproduces the bug and fails before the fix; observe the failure before changing code.
- No flakiness: control time and randomness, never sleep on real time, isolate shared state, and keep tests independent of order.
- Never weaken, skip, or delete an existing test to make a suite pass.
- Stay generic: do not assume any repository-specific tool, runner, or path.

Edge-case checklist, applied to each behavior:

- Empty: empty strings and collections, missing optional values.
- Boundaries: zero, one, maximum, and off-by-one limits.
- Invalid: malformed data, wrong types, and rejected values.
- Errors: failing dependencies, timeouts, and thrown errors.
- Ordering and concurrency, when the behavior depends on them.

## Decision Gates

| Condition                                                    | Action                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| The repository has a test runner and test conventions        | Follow them over the defaults in this skill                            |
| No test runner is configured                                 | Stop and ask before adding one                                         |
| The behavior is pure logic                                   | Write a unit test                                                      |
| The behavior crosses a module, database, or process boundary | Write an integration test; fake only external services                 |
| A user flow can only be proven end to end                    | Add one end-to-end test; cover details at lower levels                 |
| The code cannot be tested without mocking internals          | Test through the public interface, or report the design issue and ask  |
| A bug is being fixed                                         | Write the regression test first and see it fail                        |
| A test is flaky                                              | Remove the source of nondeterminism; never add retries or longer waits |
| The request is a safety net for a refactoring                | Out of scope; leave it to the refactoring workflow                     |

## Execution Steps

1. Confirm the behavior to test and why (new feature, bug, coverage gap, flaky test).
2. Inspect the runner, test layout, naming, helpers, and existing tests near the target code.
3. Choose the test level and the boundaries to fake.
4. List the cases: the main behavior, the edge-case checklist, and a regression case for each bug.
5. Write one behavior-named Arrange-Act-Assert test per case.
6. Run the new tests; a regression test must fail before the fix and pass after it.
7. Run the relevant suite and confirm the new tests pass in isolation and in any order.
8. Report the outcome.

## Output Contract

Return the tests added or changed with the behavior each covers, the level chosen and why, the boundaries faked, test results (including the failing run of each regression test), edge cases left untested with the reason, and production code issues found but not fixed.

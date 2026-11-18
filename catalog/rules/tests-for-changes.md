---
name: tests-for-changes
description: Add or update tests whenever behavior changes.
---

# Tests for changes

- Every behavior change or bug fix comes with a test in the same change.
- For a bug fix, write a test that fails because of the bug first, then fix it.
- Test observable behavior, not implementation details. Keep each test small and focused on one thing.
- Place tests following the project's existing layout and naming.
- Run the relevant tests before you call the work done, and report any that fail or that you could not run.
- Do not delete or weaken a test to make it pass.

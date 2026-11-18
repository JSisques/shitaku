---
name: small-changes
description: Keep each change small, focused and easy to review.
---

# Small changes

- Make the smallest change that fully solves the task. Do not refactor unrelated code in the same change.
- Do one thing per change. If you notice a separate problem, mention it instead of fixing it silently.
- Keep diffs reviewable: avoid reformatting untouched lines, reordering imports or renaming for taste.
- Do not add features, options or abstractions that were not asked for.
- If a task needs a large change, propose a split into steps and do the first step.

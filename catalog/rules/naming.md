---
name: naming
description: Use clear, consistent names that follow the conventions already in the codebase.
---

# Naming

- Follow the naming style already used in the surrounding code: casing, prefixes, suffixes and file names.
- Name things after what they are or do, not how they are implemented. Prefer `userCount` over `n` or `data2`.
- Avoid abbreviations that a new reader would have to look up. Well-known ones such as `id` or `url` are fine.
- Booleans read as questions: `isReady`, `hasAccess`, `canRetry`.
- Functions are verbs, types and classes are nouns.
- When a rename is needed, apply it everywhere in the same change instead of leaving two names for one concept.

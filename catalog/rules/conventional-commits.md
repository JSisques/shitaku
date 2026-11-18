---
name: conventional-commits
description: Write commit messages in the Conventional Commits format.
---

# Conventional commits

- Format: `type(scope): subject`, for example `fix(parser): handle empty input`.
- Use the standard types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.
- Write the subject in the imperative mood, lowercase, without a trailing period, at most about 72 characters.
- Use the body to explain why the change was made. Mark breaking changes with `!` or a `BREAKING CHANGE:` footer.
- Make one logical change per commit, with its tests and docs.
- Never add AI attribution or co-author trailers unless the project asks for them.

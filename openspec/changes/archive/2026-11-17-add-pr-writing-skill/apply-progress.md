# Apply Progress: add-pr-writing-skill

Mode: Strict TDD (runner: `pnpm test`). Branch `feat/pr-writing-skill` from origin/main.

## Status

14/15 tasks complete. Task 5.3 is a PR-time reminder (update issue #236 acceptance criteria that mention topics) and stays open.

## TDD Cycle Evidence

| Task    | Test file                                       | RED                                                                                        | GREEN                                         |
| ------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 1.1-1.3 | `test/adapters/catalog/bundled-catalog.test.ts` | 2 failed, 5 passed (skills index mismatch; ENOENT on `catalog/skills/pr-writing/SKILL.md`) | 7 passed after skill and catalog entry        |
| 2.1-2.3 | same                                            | n/a                                                                                        | targeted 7/7; full suite 1460/1460 after docs |

## Commits

- `5e0b285` feat(catalog): add pr-writing skill
- `64acdb7` docs: list pr-writing skill in README and website

## Notes

- Between the two commits the repo-wide `test/release-config.test.ts` website drift check fails (generated pages missing); it passes after the docs commit.
- Dry-run `init --skills pr-writing --scope project` reports `pr-writing: create` and writes nothing.

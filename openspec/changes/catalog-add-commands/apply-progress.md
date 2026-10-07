# Apply Progress: catalog-add-commands

## Batch 1: PR 1 (catalog) — tasks 1.1-1.9 complete

Mode: Strict TDD. Chain: stacked-to-main. Remaining: 2a._, 2b._, 2c._, 3a._, 3b.* (not started).

### TDD Cycle Evidence

| Task    | Test File                                                  | Layer       | Safety Net             | RED                    | GREEN        | Triangulate                       | Refactor                                         |
| ------- | ---------------------------------------------------------- | ----------- | ---------------------- | ---------------------- | ------------ | --------------------------------- | ------------------------------------------------ |
| 1.1/1.2 | `test/domain/catalog/frontmatter.test.ts`, `skill.test.ts` | Unit        | 85/85 (domain/catalog) | Written, import failed | 85/85 pass   | 6 cases + skill unchanged         | Skill reader moved to `frontmatter.ts`           |
| 1.3/1.4 | `test/domain/catalog/command.test.ts`                      | Unit        | N/A (new)              | Written, import failed | Pass         | names x2, description x3, body x2 | None needed                                      |
| 1.5/1.6 | `schema.test.ts`, `profile.test.ts`, `listing.test.ts`     | Unit        | 93/93                  | 15 failing before code | 93/93 pass   | extends dedupe, unknown, empty    | None needed                                      |
| 1.7/1.8 | `folder-source.test.ts`, `bundled-catalog.test.ts`         | Integration | 42/42                  | 10 failing before code | Pass         | 10 loader cases                   | `flagUnlisted` shared by skills/scripts/commands |
| 1.9     | whole suite                                                | Gate        | N/A                    | N/A                    | 944/944 pass | N/A                               | typecheck, lint, format:check, build clean       |

### Work Unit Evidence

| Evidence             | Value                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | `pnpm vitest run test/domain/catalog test/adapters/catalog`: 9 files, 135 tests passed                                                                    |
| Runtime harness      | Real `FolderCatalogSource` against tmp folders and the bundled `catalog/`; `list --json` CLI path unchanged (kind wiring lands in 3a)                     |
| Rollback boundary    | `src/domain/catalog/{frontmatter,command}.ts`, catalog schema/profile/listing, folder-source `loadCommands`, `catalog.json` `commands: []`, test literals |

### Deviations from design

- Loader tests build command fixtures in tmp dirs (existing `folder-source.test.ts` style, and symlinks cannot be committed reliably) instead of `test/fixtures/**/commands/`.
- `readFrontmatter` also returns `body` (needed for the empty-body rule).
- Size: about 560 changed lines (482 added, 78 removed), above the 400 budget. Contingency split 1a/1b from tasks.md applies (about 190 / 370).

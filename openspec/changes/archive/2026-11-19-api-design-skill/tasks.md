# Tasks: Add api-design Catalog Skill

Strict TDD (`pnpm test`). Spec: `specs/api-design-skill/spec.md`. Design: `design.md`.

## Review Workload Forecast

| Field                   | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| Estimated changed lines | ~170-200 (SKILL.md ~125-135, catalog.json ~1, test ~30; docs generated) |
| 400-line budget risk    | Low                                                                     |
| Chained PRs recommended | No                                                                      |
| Suggested split         | Single PR, two commits                                                  |
| Delivery strategy       | auto-chain                                                              |
| Chain strategy          | pending                                                                 |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Generated lines (excluded): README row + 2 website pages. Push only after commit 2, because `docs:catalog:check` runs in CI, not in hooks.

### Suggested Work Units

| Unit | Goal                                   | Likely PR | Focused test command                                      | Runtime harness                                                        | Rollback boundary                              |
| ---- | -------------------------------------- | --------- | --------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| 1    | Skill, catalog entry and contract test | PR 1      | `pnpm test test/adapters/catalog/bundled-catalog.test.ts` | `node dist/main.js init --skills api-design --scope project --dry-run` | Revert commit 1 (SKILL.md, catalog.json, test) |
| 2    | Regenerated README and website pages   | PR 1      | `pnpm run docs:catalog:check`                             | `pnpm run docs:website-catalog:check`                                  | Revert commit 2 (generated docs only)          |

## Commit 1: `feat(catalog): add api-design skill`

### Phase 0: Pre-flight verification (no commit)

- [x] 0.1 Verify against primary sources (rfc-editor.org, datatracker.ietf.org, spec.openapis.org) before writing SKILL.md: RFC 9457 (Problem Details, obsoletes RFC 7807), RFC 9745 (`Deprecation` header), RFC 8594 (`Sunset` header), and the `Idempotency-Key` IETF draft (`draft-ietf-httpapi-idempotency-key-header`, still a draft or now an RFC). Also confirm OpenAPI 3.1.x remains a valid target. If a citation differs, adjust the SKILL.md wording and the required-token list accordingly and note it in the commit body (Req: OpenAPI 3.1 contract output, "cited only when verified")
- [x] 0.2 Read back `openspec/changes/api-design-skill/design.md` against the verified citations and resolve the two Open Questions (citations checked; OAS 3.2 noted); update the design file in place if any fact changed

### Phase 1: RED (test edits only)

- [x] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, rename the registration test to `ships api-design, commit-writing, docs-writing, example-skill, pr-writing, product-owner, refactoring, socratic-method and test-writing as registered loadable bundled skills` (Req: Bundled registration)
- [x] 1.2 Prepend `'api-design'` to both exact lists (`index.items.skills` and sorted `readdirSync` entries) (Req: Bundled registration)
- [x] 1.3 Change `expect(catalog.skills).toHaveLength(8)` to `9` (Req: Bundled registration)
- [x] 1.4 Before the `commit-writing` `byName` block add the `byName['api-design']` assertions: `toMatchObject({ name: 'api-design' })`, description length > 0, `files` equal `['SKILL.md']` (Req: Bundled registration)
- [x] 1.5 After `keeps the commit-writing skill content contract` add `keeps the api-design skill content contract` using `expectSkillContract('api-design', ...)` with the 13 required tokens (`Repository conventions first`, `OpenAPI`, `openapi: 3.1`, `Idempotency-Key`, `application/problem+json`, `RFC 9457`, `cursor`, `/v1`, `backward-compatible`, `breaking change`, `Deprecation`, `Sunset`, `Not for product requirements`) and forbidden `/shitaku/i`, `'Co-Authored-By'`, `'RFC 7807'`; then read `catalog/skills/api-design/SKILL.md` raw and assert `raw.split(/\r?\n---\r?\n/)` has length 2 (Req: Content contract guard)
- [x] 1.6 Run `pnpm test`; observe and record RED (list/count failures and ENOENT on missing SKILL.md) (Req: Content contract guard, scenario "Guard fails before the skill exists")

### Phase 2: GREEN (skill + catalog)

- [x] 2.1 Create `catalog/skills/api-design/SKILL.md` from the design outline: two-key frontmatter, 232-char single-quoted `Trigger:` description, five sections in order, Decision Gates Condition | Action table, numbered Execution Steps, Activation Contract ending with `Not for product requirements or user stories, prose API documentation or guides, implementing handlers or writing tests, or GraphQL, gRPC, and event-driven API design.`, one `yaml` fence (OpenAPI 3.1.0, Prettier-stable: single quotes, flow mappings, 2-space indent) under `### Reference contract` last in `## Output Contract`, ~125-135 lines. Apply the citation outcome of 0.1. No `---` line in the body, no `shitaku`, no `Co-Authored-By`, no `RFC 7807`, no `disable-model-invocation` (Reqs: frontmatter, generic, sections, conventions first, resource modeling, versioning default, error format, cursor pagination, idempotency, compatibility, OpenAPI output, scope)
- [x] 2.2 Insert `"api-design"` before `"commit-writing"` in `catalog/catalog.json` `items.skills` (Req: Bundled registration)
- [x] 2.3 Run `pnpm run format`; accept Prettier output, then re-check the YAML fence still matches the intended structure (quoted `'200'`, `'null'`, `$ref` strings) and the table is aligned
- [x] 2.4 Run `pnpm test`; observe GREEN, including the 250-char description check and the `---` split assertion (Req: Content contract guard, scenario "Guard passes after the skill is added")
- [x] 2.5 Run `pnpm run typecheck && pnpm run lint && pnpm run format:check`
- [x] 2.6 Confirm `git diff --stat` shows no `src/`, `CHANGELOG.md`, `.prettierignore`, or existing skill/rule/agent/profile change (Req: Scope limited, Catalog-only surface)
- [x] 2.7 Commit: `feat(catalog): add api-design skill` (SKILL.md, catalog.json, test; design.md updates if any). Never use `--no-verify`

## Commit 2: `docs: list api-design skill in README and website`

### Phase 3: Generated docs

- [x] 3.1 Run `pnpm run docs:catalog` (README skills table), then `pnpm run docs:website-catalog` (en and es pages). Do not hand-edit (Req: Catalog-only surface)
- [x] 3.2 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass
- [x] 3.3 Run `pnpm run format:check`; if generated files need formatting, run `pnpm run format` and re-run both checks
- [x] 3.4 Confirm the diff contains only `README.md` and `website/src/content/docs/{en,es}/catalog/skills/api-design.md`
- [x] 3.5 Commit: `docs: list api-design skill in README and website`

## Phase 4: Final verification (no commit)

- [x] 4.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`
- [x] 4.2 Run `pnpm run build`, then `node dist/main.js init --skills api-design --scope project --dry-run`; expect `api-design` classified `create` and no files, backups, or manifest written (Req: Installable create when absent)
- [x] 4.3 Confirm `git status` is clean of stray files from the dry-run and `dist/` is not committed

## Parallelism

Strictly sequential: 0.x verification precedes SKILL.md text, RED precedes GREEN (strict TDD), and generators need the registered skill. Tasks 0.1 and 1.1-1.5 touch independent files and could overlap, but 2.1 depends on both. No parallel tasks planned.

# Proposal: Add api-design Catalog Skill

## Intent

Add a bundled **api-design** skill (#266) so agents design and review HTTP APIs consistently. Today agents improvise: inconsistent resource naming, verbs in paths, ad hoc error bodies, missing pagination, unsafe retries on non-idempotent operations, and silent breaking changes. No catalog skill covers API contract design; the skill gives agents one generic, tool-agnostic playbook that defers to repository conventions and produces an OpenAPI-shaped contract.

## Scope

### In Scope

- `catalog/skills/api-design/SKILL.md`: English, generic and tool-agnostic, model-invocable (no `disable-model-invocation`), exactly two frontmatter keys: `name: api-design` and a single-quoted, single-line `Trigger:`-style `description` (<=250 chars, no apostrophes, double quotes or pipes). Layout mirrors the sibling skills: Activation Contract (ending with a "Not for ..." sentence), Hard Rules, Decision Gates (Condition | Action table), Execution Steps (numbered), Output Contract. Target length about 100-140 lines with one-line rules.
- Skill behavior:
  - **Repository conventions first**: inspect existing routes, OpenAPI documents, error shapes, naming and versioning; they win over the skill defaults.
  - **Resource modeling**: plural nouns, no verbs in paths, consistent casing, shallow nesting, correct HTTP method semantics and status codes.
  - **Versioning**: default to a URI major version (`/v1`) when the repository has no convention; the repository convention always wins.
  - **Errors**: `application/problem+json` (Problem Details) as the default error format.
  - **Pagination**: `cursor`-based pagination as the default for collections; filtering and sorting via query parameters.
  - **Idempotency**: safe/idempotent method semantics and an `Idempotency-Key` header for retryable non-idempotent writes.
  - **Evolution**: classify each change as `backward-compatible` or `breaking change`; breaking changes require a new major version and a deprecation path.
  - **Contract output**: an OpenAPI 3.1 contract; SKILL.md includes one short inline OpenAPI 3.1 YAML fence as the reference example.
  - Activation boundary: "Not for" product requirements or user stories (owned by `product-owner`), prose API documentation or guides (owned by `docs-writing`), implementing handlers, writing tests, or non-HTTP protocols beyond a brief mention.
- Register `api-design` in `catalog/catalog.json` -> `items.skills` in alphabetical order (before `commit-writing`); run `pnpm run format`.
- Update `test/adapters/catalog/bundled-catalog.test.ts` RED first: both exact skill lists, count 8 -> 9, a `byName['api-design']` entry with `files: ['SKILL.md']`, and a content-contract test via `expectSkillContract` asserting load-bearing tokens (`Repository conventions first`, `OpenAPI`, `Idempotency-Key`, `application/problem+json`, `cursor`, `backward-compatible`, `breaking change`, `Not for`) and the forbidden tokens (`/shitaku/i`, `Co-Authored-By`).
- Regenerate docs: `pnpm run docs:catalog` (README) then `pnpm run docs:website-catalog` (website en/es); verify with the matching `:check` scripts.

### Out of Scope

- An `api-designer` agent or any profile entry (separate issue).
- Changes to other skills, rules, agents or profiles.
- GraphQL, gRPC or event/async API design guidance beyond a scoping note.
- Tooling integrations (OpenAPI linters such as Spectral, code generators, mock servers).
- A `references/` folder, separate example files or a multi-file skill.
- Any `src/` change or install-time templating.
- Hand edits to generated README or website pages, or to `CHANGELOG.md` (release-generated).

## Capabilities

Install, list and validate behavior stays under the existing `catalog` and `skills-install` capabilities (no deltas).

### New Capabilities

- `api-design-skill`: catalog-bundled API design skill content (repository conventions first, resource modeling and HTTP semantics, URI major versioning default, Problem Details errors, cursor pagination, idempotency keys, backward-compatible versus breaking change classification, OpenAPI 3.1 contract output with an inline example), activation boundary versus `product-owner` and `docs-writing`, decision gates, and installability acceptance.

### Modified Capabilities

None

## Approach

Single dense generic `SKILL.md` with one inline OpenAPI 3.1 YAML fence (exploration approach 1), mirroring the archived `add-commit-writing-skill` and `add-test-writing-skill` changes. The skill tells the agent to inspect repository conventions, model resources and operations, apply the default rules where no convention exists, classify compatibility of changes, and report an OpenAPI contract plus a short decision summary. Install remains a byte-identical copy. Exact standard references (Problem Details, deprecation headers) are confirmed in the design phase before being cited.

Strict TDD (`pnpm test`): update the bundled-catalog test and add the content-contract test first and observe RED, then add the skill and catalog entry (GREEN), then format, regenerate docs, run gates, and dry-run `init --skills api-design`.

Delivery: one PR with two Conventional Commits, no chaining:

1. `feat(catalog): add api-design skill` (test, SKILL.md, catalog.json).
2. `docs: list api-design skill in README and website` (generated README and website pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and generated docs only.

| Area                                                            | Impact   | Description                                                    |
| --------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| `catalog/skills/api-design/SKILL.md`                            | New      | Skill content, frontmatter and inline OpenAPI 3.1 YAML example |
| `catalog/catalog.json`                                          | Modified | Add `api-design` as first `items.skills` entry (alphabetical)  |
| `test/adapters/catalog/bundled-catalog.test.ts`                 | Modified | Skill lists, count 9, `byName` entry, content-contract test    |
| `README.md`                                                     | Modified | Skills table (generated by `docs:catalog`)                     |
| `website/src/content/docs/{en,es}/catalog/skills/api-design.md` | New      | Website pages (generated by `docs:website-catalog`)            |
| `src/`                                                          | None     | Catalog data only                                              |

## Risks

| Risk                                                                     | Likelihood | Mitigation                                                                                      |
| ------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------- |
| First skill code fence breaks Prettier or the website generator          | Med        | Run `pnpm run format:check` and both docs `:check` scripts; keep the YAML fence short and valid |
| Description breaks the 250-char or no-apostrophe/quote/pipe rule         | Med        | Count characters; avoid contractions; `expectSkillContract` enforces it                         |
| Skill about 2x sibling length dilutes agent attention                    | Med        | One-line rules, compact gate table, single short example                                        |
| Scope overlap with `product-owner`, `docs-writing` or a future API agent | Low        | Explicit "Not for ..." boundary in the Activation Contract                                      |
| Incorrect standard citations (RFC numbers, header names)                 | Med        | Verify against primary sources in design; cite only what is confirmed                           |
| Opinionated defaults conflict with an existing API                       | Low        | Hard rule: repository conventions first; defaults apply only when no convention exists          |
| README table re-padding inflates the docs diff                           | Low        | Accept generated output; isolated in the docs commit                                            |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/skills/api-design/`, the `catalog.json` entry, the test changes and the regenerated README and website pages (or rerun the docs scripts after the revert). No `src/`, manifest or migration impact. Users who already installed the skill can run `shitaku undo` or delete the installed skill directory. No agent or profile depends on the skill.

## Dependencies

- Existing `skills-install` capability and catalog docs generators.
- No external dependency.

## Review Workload Forecast

Expected authored change ~140-190 lines: ~100-140-line SKILL.md, a few catalog.json lines, ~25-40 test lines; generated README and website pages excluded. Single PR, two commits. 400-line budget risk: Low. Decision needed before apply: No. Chained PRs recommended: No.

## Success Criteria

- [ ] Bundled-catalog test lists 9 skills including `api-design` and passes (observed RED first)
- [ ] Content-contract test for `api-design` passes via `expectSkillContract`
- [ ] `pnpm run build` then `node dist/main.js init --skills api-design --scope project --dry-run` plans a `create` for the skill
- [ ] `docs:catalog:check` and the website catalog check pass
- [ ] SKILL.md has `name: api-design`, Trigger-style one-line `description` (<=250 chars), no `disable-model-invocation`
- [ ] SKILL.md states repository conventions first and URI major versioning (`/v1`) as the default only when no convention exists
- [ ] SKILL.md covers resource modeling, Problem Details errors, cursor pagination, `Idempotency-Key`, and backward-compatible versus breaking change classification
- [ ] SKILL.md contains one valid OpenAPI 3.1 YAML example fence
- [ ] SKILL.md excludes product requirements, prose documentation, and implementation or test work
- [ ] No `src/` changes; `CHANGELOG.md` untouched
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass

# Design: Add api-design Catalog Skill

## Technical Approach

Mirror the archived `add-commit-writing-skill` and `add-test-writing-skill` changes: one generic, tool-agnostic `catalog/skills/api-design/SKILL.md` with the shared skill contract (two-key frontmatter, five fixed `##` sections, Condition | Action Decision Gates table, numbered Execution Steps). The only novelty is one inline OpenAPI 3.1 YAML fence, the first code fence in a catalog skill body. No `src/` change: `FolderCatalogSource` and the `skills-install` byte-copy path already handle a new single-file skill once it is registered in `catalog/catalog.json`. Correctness is pinned by `test/adapters/catalog/bundled-catalog.test.ts` (registration, loadability, `files: ['SKILL.md']`, count 9) and by `expectSkillContract` (frontmatter shape, headings, load-bearing tokens, forbidden tokens), plus one api-design-specific assertion guarding the frontmatter split against a stray `---` line. README and website pages are regenerated, never hand-edited.

Strict TDD order: RED (test edits only) -> GREEN (SKILL.md + catalog.json) -> format -> docs generators -> full gates -> build and dry-run install.

## Architecture Decisions

### Decision: Single-file skill with one inline OpenAPI 3.1 YAML fence

**Choice**: Only `SKILL.md` in `catalog/skills/api-design/`, about 120-140 lines: the five sections with one-line rules, and a `### Reference contract` subsection at the end of `## Output Contract` holding one `yaml` fence (~50 lines) that shows a cursor-paginated `GET`, an idempotent-keyed `POST`, and a shared Problem Details response.
**Alternatives considered**: Prose only (agents then improvise the contract shape, which is the problem the issue describes); a `references/` folder or example file (breaks the `files: ['SKILL.md']` precedent asserted for every bundled skill; out of scope per proposal).
**Rationale**: The user confirmed the inline fence. One example demonstrates five rules at once (versioned path, cursor, `Idempotency-Key`, `application/problem+json`, shared component reuse) more compactly than prose. Flow-style mappings (`{ type: string }`) keep the fence short.

### Decision: Fence placement and Prettier stability

**Choice**: Place the fence last in the file (inside `## Output Contract`). Write it Prettier-stable from the start: 2-space indent, single-quoted strings (`'200'`, `'#/components/...'`, `'null'`), flow mappings for leaf schemas, no line over ~110 columns, and no `---` document marker or `...` end marker. Apply runs `pnpm run format` and accepts Prettier's output, then re-checks the YAML still matches the intended structure.
**Alternatives considered**: Add `catalog/skills/**` to `.prettierignore` (hides drift for every skill and weakens `format:check`); use an indented code block instead of a fence (Prettier would not format it, but agents and renderers handle fenced `yaml` better).
**Rationale**: Verified in code: `.prettierignore` does not exclude `catalog/`, so `format:check` covers SKILL.md, and Prettier formats embedded `yaml` fences in Markdown. `.prettierrc` sets `singleQuote: true`, so double-quoted YAML scalars would be rewritten; starting with single quotes avoids churn. OpenAPI requires response-code keys to be strings, so `'200'` must stay quoted. `'null'` must be quoted inside a `type` array, or YAML parses it as a null value.

### Decision: No `---` line anywhere in the body

**Choice**: The body must contain no line that is exactly `---` (no horizontal rules, no YAML document markers). The api-design contract test adds an explicit assertion for it.
**Alternatives considered**: Rely on `expectSkillContract` alone.
**Rationale**: Verified in code: `expectSkillContract` splits `raw` with `/^---\r?\n|\r?\n---\r?\n/` (no `m` flag), so every `\n---\n` in the body starts a new segment and `body` is truncated at the first one. A YAML fence is the first place such a line could plausibly appear. Headings before the marker would still pass, so truncation can go unnoticed; the explicit assertion makes it fail loudly. The CLI reader (`FRONTMATTER` in `src/domain/catalog/frontmatter.ts`) is lazy and stops at the first closing `---`, so it is unaffected either way.

### Decision: Website and README generators need no change

**Choice**: No generator change. Run `docs:catalog` and `docs:website-catalog` after GREEN.
**Alternatives considered**: Rendering the skill body (including the fence) into the website page.
**Rationale**: Verified in code: `scripts/generate-website-catalog.mjs` (`renderSkill`) and `scripts/generate-catalog-table.mjs` read only the frontmatter `description` through `scripts/lib/frontmatter-description.mjs` (`readFrontmatter`, strict mode). The SKILL.md body, and therefore the fence, never reaches generated pages. The generated page content is frontmatter + title + description + source note, formatted by Prettier.

### Decision: Description text (232 characters)

**Choice**:

```
Trigger: design an API, review an API, REST endpoint, OpenAPI spec, API versioning, breaking API change. Design HTTP APIs: resource naming, status codes, Problem Details errors, cursor pagination, idempotency, OpenAPI 3.1 contracts.
```

Manual count: `Trigger: ` 9, `design an API, ` 15 (24), `review an API, ` 15 (39), `REST endpoint, ` 15 (54), `OpenAPI spec, ` 14 (68), `API versioning, ` 16 (84), `breaking API change. ` 21 (105), `Design HTTP APIs: ` 18 (123), `resource naming, ` 17 (140), `status codes, ` 14 (154), `Problem Details errors, ` 24 (178), `cursor pagination, ` 19 (197), `idempotency, ` 13 (210), `OpenAPI 3.1 contracts.` 22 (232). No `'`, `"` or `|`; no contractions. Margin 18 characters; apply still rechecks via the contract test.
**Alternatives considered**: Listing versioning in both halves (exceeds the budget with little gain; the trigger already names it); naming `GraphQL` or `gRPC` (would invite out-of-scope invocations).
**Rationale**: Trigger phrases drive model invocation; both "design" and "review" are first-class entry points per the issue.

### Decision: Standards citations (verified against primary sources during apply)

**Choice**: The skill cites, by number, only:

| Citation                      | Use in skill                                      | Status relied on                                                                  |
| ----------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| RFC 9457 Problem Details      | Default error format `application/problem+json`   | Proposed Standard, July 2023; obsoletes RFC 7807                                  |
| RFC 9745 `Deprecation` header | Signal a deprecated operation or version          | Proposed Standard, March 2025                                                     |
| RFC 8594 `Sunset` header      | Announce the removal date of a deprecated version | Informational, May 2019                                                           |
| `Idempotency-Key` header      | Retryable non-idempotent writes                   | IETF HTTPAPI Internet-Draft (`draft-ietf-httpapi-idempotency-key-header`), no RFC |
| OpenAPI 3.1                   | Contract format; example uses `openapi: 3.1.0`    | OAS 3.1.0 through 3.1.2 published; OAS 3.2.0 and 3.2.1 also published             |

The skill names `Idempotency-Key` as an IETF draft without an RFC number and without draft-specific status codes; it only states behavior that does not depend on the draft text (same key + same payload returns the original result; reuse with a different payload is rejected with a Problem Details error). `RFC 7807` is a forbidden token so the obsolete reference cannot creep back.
**Alternatives considered**: Citing the draft's status codes (400 missing key, 409 in-flight, 422 payload mismatch), which I recall from the draft but could not verify live; citing no RFCs (loses precision the issue asks for).
**Rationale**: Verified during apply via curl against primary sources: rfc-editor.org (RFC 9457 Standards Track, obsoletes 7807; RFC 9745 Standards Track, March 2025; RFC 8594 Informational), datatracker.ietf.org API (`draft-ietf-httpapi-idempotency-key-header` rev 08, active Internet-Draft, `rfc: null`, expires 2027-04-25), spec.openapis.org (3.1.0 to 3.1.2 and 3.2.0 to 3.2.1 listed). No citation changed. Earlier design-phase note: no fetch tool was available then. Facts used are long-stable (RFC numbers, titles, obsoletion), and the riskier details (draft status codes, OAS 3.2 adoption) are deliberately kept out of the skill.

### Decision: Opinionated defaults, all subordinate to repository conventions

**Choice**: Defaults apply only when the repository has no convention: URI major version `/v1` (major only, in the path), plural kebab-case resource paths, camelCase JSON fields, cursor pagination with `limit` and an opaque `nextCursor`, `application/problem+json` errors, RFC 3339 UTC timestamps, opaque string IDs. The first Hard Rule and the first Decision Gate make repository conventions win.
**Alternatives considered**: Neutral guidance with no defaults (agents keep improvising); header or media-type versioning as default (less visible, harder to route and cache; the user confirmed `/v1`).
**Rationale**: User-confirmed in the proposal; mirrors `test-writing` and `commit-writing` ("Repository conventions first ... they win over the defaults in this skill").

### Decision: Activation boundary

**Choice**: Activation Contract ends with `Not for product requirements or user stories, prose API documentation or guides, implementing handlers or writing tests, or GraphQL, gRPC, and event-driven API design.` A Decision Gate row redirects those requests. Sibling skills are not named by catalog name.
**Alternatives considered**: Naming `product-owner` and `docs-writing` inside the skill (couples skills; rejected by the test-writing and commit-writing designs for the same reason).
**Rationale**: Mirrors `product-owner`'s `Not for technical design` line, so the two skills partition the space symmetrically.

### Decision: Contract-test tokens

**Choice**: Required (exact substrings of `raw`): the proposal's eight with `Not for` strengthened to `Not for product requirements` (`Repository conventions first`, `OpenAPI`, `Idempotency-Key`, `application/problem+json`, `cursor`, `backward-compatible`, `breaking change`), plus `openapi: 3.1`, `RFC 9457`, `/v1`, `Deprecation`, `Sunset`. Forbidden: `/shitaku/i`, `'Co-Authored-By'`, `'RFC 7807'`.
**Alternatives considered**: Only the proposal's eight (bare `Not for` and `OpenAPI` are weak substrings; the example, versioning default and deprecation path would be unguarded); a tool-name guard like test-writing's runner regex (the skill must not name tools, but no specific tool is a realistic drift risk here).
**Rationale**: The extra tokens pin the highest-consequence content: that an OpenAPI 3.1 example exists, the current Problem Details RFC, the confirmed versioning default, and the deprecation path for breaking changes.

### Decision: Two commits in one PR

**Choice**: `feat(catalog): add api-design skill` (SKILL.md, catalog.json, test) then `docs: list api-design skill in README and website` (generated files only).
**Alternatives considered**: One commit; chained PRs.
**Rationale**: User-confirmed; authored diff ~170-200 lines, under the 400-line budget, so `auto-chain` does not slice. `docs:catalog:check` runs in CI, not in hooks, so commit 1 passes `pre-push` alone; the PR is pushed after commit 2.

## Data Flow

    catalog/skills/api-design/SKILL.md ──┐
    catalog/catalog.json (items.skills) ─┼──→ FolderCatalogSource.load() ──→ init --skills api-design (byte copy, body + fence)
                                         │
                                         ├──→ frontmatter description only ──→ scripts/generate-catalog-table.mjs ──→ README.md
                                         └──→ frontmatter description only ──→ scripts/generate-website-catalog.mjs ──→ website/.../{en,es}/catalog/skills/api-design.md

## File Changes

| File                                                       | Action             | Description                                                                         |
| ---------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts`            | Modify             | Test name, both skill lists, count 9, `byName` block, new contract test (RED first) |
| `catalog/skills/api-design/SKILL.md`                       | Create             | Skill content (outline below)                                                       |
| `catalog/catalog.json`                                     | Modify             | Insert `"api-design"` as the first `items.skills` entry (before `"commit-writing"`) |
| `README.md`                                                | Modify (generated) | Skills table row via `pnpm run docs:catalog`                                        |
| `website/src/content/docs/en/catalog/skills/api-design.md` | Create (generated) | `pnpm run docs:website-catalog`                                                     |
| `website/src/content/docs/es/catalog/skills/api-design.md` | Create (generated) | Same generator                                                                      |

No `src/`, profile, agent, rule, generator script, `.prettierignore`, CONTRIBUTING or CHANGELOG change.

## Interfaces / Contracts

### SKILL.md outline (target text; apply may polish wording but must keep every required token and keep the body free of `---` lines)

````markdown
---
name: api-design
description: '<232-char description above>'
---

## Activation Contract

Use when asked to design, review, or change an HTTP API: resources and endpoints, request and response shapes, status codes, errors, pagination, versioning, compatibility of a change, or an OpenAPI contract. Not for product requirements or user stories, prose API documentation or guides, implementing handlers or writing tests, or GraphQL, gRPC, and event-driven API design.

## Hard Rules

- Repository conventions first: inspect existing routes, OpenAPI documents, error bodies, field casing, pagination, and versioning; they win over the defaults in this skill.
- Contract first: the OpenAPI document is the source of truth; design and review it before any implementation.
- Resources are plural nouns in kebab-case paths (`/order-items`); no verbs in paths; nest at most one level (`/orders/{orderId}/items`).
- Use one field casing across the API; default to camelCase. Timestamps are RFC 3339 in UTC; IDs are opaque strings.
- Methods: GET reads and is safe; PUT replaces and DELETE removes, both idempotent; PATCH updates partially; POST creates or runs a non-idempotent action. Prefer a sub-resource or a state field over an action endpoint.
- Status codes: 200 OK, 201 Created with a `Location` header, 202 Accepted for async work, 204 No Content; 400 malformed, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 validation failed, 429 with `Retry-After`; 5xx only for server faults. Never return 200 with an error body.
- Errors use `application/problem+json` Problem Details (RFC 9457): `type`, `title`, `status`, `detail`, `instance`, plus extension members such as field errors. Never leak stack traces or internal identifiers.
- Collections use `cursor` pagination by default: an opaque cursor, a `limit` with a documented maximum, and `nextCursor` in the response. Use offset pagination only when the repository already does or random page access is a requirement.
- Filter and sort with query parameters (`?status=paid&sort=-createdAt`); never encode them in the path.
- Idempotency: retryable POST (and non-idempotent PATCH) operations accept an `Idempotency-Key` request header (IETF draft). The same key with the same payload returns the original result; reuse with a different payload is rejected with a Problem Details error.
- Versioning: when the repository has no convention, put the major version in the path (`/v1`); never put minor versions in the path.
- Classify every change as backward-compatible (new endpoint, new optional field or parameter, new response field) or breaking change (removed or renamed field, changed type or default, new required input, stricter validation, changed status code or semantics, new values in a closed enum).
- A breaking change requires a new major version and a deprecation path: mark the old operations `deprecated: true`, send the `Deprecation` header (RFC 9745) and a `Sunset` header (RFC 8594) with the removal date, publish a migration note, and run both versions until the sunset date.
- Every operation declares its security scheme; never put secrets or tokens in paths or query strings.
- Stay generic: do not assume any framework, gateway, or tool.

## Decision Gates

| Condition                                                                 | Action                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The repository has API conventions or an OpenAPI document                 | Follow them over the defaults in this skill                                   |
| No convention is found                                                    | Apply the defaults above and list each one used                               |
| An operation does not fit a CRUD method                                   | Model a sub-resource or state change; use a POST action only as a last resort |
| A collection can grow without bound                                       | Paginate it with a cursor from the first version                              |
| A write may be retried by clients or networks                             | Require an `Idempotency-Key` on it                                            |
| A proposed change is backward-compatible                                  | Ship it in the current major version                                          |
| A proposed change is a breaking change                                    | Add a new major version, deprecate the old one, and plan the sunset           |
| Compatibility of a change is unclear                                      | Treat it as breaking and ask                                                  |
| The request is product requirements, prose docs, implementation, or tests | Out of scope; leave it to the matching workflow                               |
| The API is GraphQL, gRPC, or event-driven                                 | Out of scope; say so and stop                                                 |

## Execution Steps

1. Confirm the goal: a new API, a change to an existing one, or a review.
2. Read the conventions: existing routes, OpenAPI documents, error bodies, casing, pagination, and versioning.
3. Model resources, relationships, and operations; choose methods and status codes.
4. Define request and response schemas, errors, pagination, filtering, and idempotency.
5. For changes, classify each one as backward-compatible or breaking change, and plan versioning and deprecation.
6. Write or update the OpenAPI 3.1 contract.
7. Check the contract against the hard rules and the repository conventions.
8. Report the outcome.

## Output Contract

Return the OpenAPI 3.1 contract (or the diff to the existing one); a decision summary with the conventions applied and their source and each default used; the compatibility classification of every change with its migration and deprecation plan; review findings ordered by severity when reviewing; and open questions.

### Reference contract

```yaml
openapi: 3.1.0
info: { title: Orders API, version: 1.0.0 }
paths:
  /v1/orders:
    get:
      operationId: listOrders
      parameters:
        - { name: cursor, in: query, schema: { type: string } }
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
      responses:
        '200':
          description: One page of orders
          content:
            application/json:
              schema: { $ref: '#/components/schemas/OrderPage' }
        '400': { $ref: '#/components/responses/Problem' }
    post:
      operationId: createOrder
      parameters:
        - { name: Idempotency-Key, in: header, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Order' }
      responses:
        '201':
          description: Order created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Order' }
        '409': { $ref: '#/components/responses/Problem' }
        '422': { $ref: '#/components/responses/Problem' }
components:
  responses:
    Problem:
      description: Error in Problem Details format
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
  schemas:
    Problem:
      type: object
      properties:
        { type: { type: string }, title: { type: string }, status: { type: integer }, detail: { type: string } }
    Order:
      type: object
      required: [id, status]
      properties: { id: { type: string }, status: { type: string } }
    OrderPage:
      type: object
      required: [items]
      properties:
        items: { type: array, items: { $ref: '#/components/schemas/Order' } }
        nextCursor: { type: [string, 'null'] }
```
````

Body ~125-135 lines. The Decision Gates table is shown unaligned; `pnpm run format` aligns it (and may re-wrap any flow mapping that exceeds 120 columns; accept the output). Token check against the outline: `Repository conventions first` (Hard Rules), `OpenAPI` (multiple), `openapi: 3.1` (fence), `Idempotency-Key` (Hard Rules, gates, fence), `application/problem+json` (Hard Rules, fence), `RFC 9457` (Hard Rules), `cursor` (multiple), `/v1` (Hard Rules, fence), `backward-compatible` and `breaking change` (Hard Rules, gates, steps), `Deprecation` and `Sunset` (Hard Rules), `Not for product requirements` (Activation Contract). Neither `shitaku`, the attribution trailer name, nor `RFC 7807` appears. The fence contains no `---` line.

### Test edits (`test/adapters/catalog/bundled-catalog.test.ts`)

1. Rename the registration test to `ships api-design, commit-writing, docs-writing, example-skill, pr-writing, product-owner, refactoring, socratic-method and test-writing as registered loadable bundled skills`.
2. Prepend `'api-design'` to both exact lists (`index.items.skills` and the sorted `readdirSync` entries).
3. `expect(catalog.skills).toHaveLength(9);`
4. Before the `commit-writing` `byName` block:

```ts
expect(byName['api-design']).toMatchObject({ name: 'api-design' });
expect(byName['api-design']?.description.length).toBeGreaterThan(0);
expect(byName['api-design']?.files.map((f) => f.path)).toEqual(['SKILL.md']);
```

5. New test after `keeps the commit-writing skill content contract`:

```ts
it('keeps the api-design skill content contract', () => {
  expectSkillContract('api-design', {
    required: [
      'Repository conventions first',
      'OpenAPI',
      'openapi: 3.1',
      'Idempotency-Key',
      'application/problem+json',
      'RFC 9457',
      'cursor',
      '/v1',
      'backward-compatible',
      'breaking change',
      'Deprecation',
      'Sunset',
      'Not for product requirements',
    ],
    forbidden: [/shitaku/i, 'Co-Authored-By', 'RFC 7807'],
  });
  // The YAML example must not add a `---` line: the contract split would truncate the body there.
  const raw = readFileSync(join(catalogRoot, 'skills', 'api-design', 'SKILL.md'), 'utf8');
  expect(raw.split(/\r?\n---\r?\n/)).toHaveLength(2);
});
```

Expected RED: list and count assertions fail (8 skills, missing entry) and `expectSkillContract` throws ENOENT on the missing SKILL.md.

### catalog.json edit

Insert `"api-design"` before `"commit-writing"` in `items.skills` (alphabetical, first entry); the array is already multi-line. Run `pnpm run format`. No other key changes.

### Command sequence

```sh
pnpm test                          # RED observed after test edits
# add SKILL.md + catalog.json entry
pnpm run format
pnpm test                          # GREEN
# commit 1: feat(catalog): add api-design skill
pnpm run docs:catalog
pnpm run docs:website-catalog
pnpm run docs:catalog:check
pnpm run docs:website-catalog:check
pnpm run typecheck && pnpm run lint && pnpm run format:check
pnpm run build && node dist/main.js init --skills api-design --scope project --dry-run   # expect a create
# commit 2: docs: list api-design skill in README and website
```

## Testing Strategy

| Layer            | What to Test                                                                              | Approach                                                       |
| ---------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Unit / adapter   | Registration, loadability, `files: ['SKILL.md']`, count 9                                 | Extend existing bundled-catalog test (RED first)               |
| Content contract | Frontmatter shape, 250-char description, headings, 13 required tokens, 3 forbidden tokens | `expectSkillContract('api-design', ...)`                       |
| Body integrity   | No `---` line in the body (frontmatter split stays exact)                                 | Explicit `split` length assertion in the same test             |
| Formatting       | YAML fence and table are Prettier-stable                                                  | `pnpm run format:check`                                        |
| Repo checks      | README and website drift                                                                  | `docs:catalog:check`, `docs:website-catalog:check`             |
| Smoke            | Install plan                                                                              | Built CLI `init --skills api-design --scope project --dry-run` |
| E2E              | N/A                                                                                       | Not configured in this project                                 |

OpenAPI validity of the example is checked by review, not by a test: adding a YAML or OpenAPI parser would be a new dependency (out of scope).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in shitaku code. The change adds static catalog data and a test; the skill body is installed as a byte copy and never executed or parsed beyond its frontmatter.

## Migration / Rollout

No migration required. Skill is opt-in via `init --skills api-design`; not added to any profile or agent.

## Open Questions

- [x] Resolved in apply: RFC 9457, RFC 9745, RFC 8594 and the `Idempotency-Key` draft status confirmed against rfc-editor.org and datatracker.ietf.org; no change.
- [x] Resolved in apply: OAS 3.2.x exists and 3.1.x remains published; the example uses `openapi: 3.1.0` per the proposal, and the repository-conventions rule covers projects already on another version.

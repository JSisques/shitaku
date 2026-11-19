# api-design-skill Specification

## Purpose

Catalog-bundled **api-design** skill: single generic, tool-agnostic English skill that guides an agent to design and review HTTP API contracts (repository conventions first, resource modeling and HTTP semantics, URI major versioning default, Problem Details errors, cursor pagination, idempotency keys, backward-compatible versus breaking change classification, OpenAPI 3.1 contract output with one inline example). Model-invocable, installable via existing skills-install. Product requirements, prose API documentation, handler or test implementation, and non-HTTP protocols belong elsewhere.

## ADDED Requirements

### Requirement: Bundled registration and valid frontmatter

The bundled catalog MUST list `api-design` in `items.skills`, in alphabetical order (first entry, before `commit-writing`), and MUST ship `catalog/skills/api-design/SKILL.md` with YAML frontmatter containing exactly two keys: single-line `name` equal to `api-design` and single-line, single-quoted `description` of at most 250 characters, starting with `Trigger:`, containing no apostrophes, double quotes or pipes. The skill MUST load and validate under existing catalog rules.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN skill `api-design` is available and valid
- AND frontmatter `name` equals the skill directory name
- AND the bundled skill list is `api-design`, `commit-writing`, `docs-writing`, `example-skill`, `pr-writing`, `product-owner`, `refactoring`, `socratic-method`, `test-writing`
- AND the bundled skill count is 9
- AND the `api-design` entry has `files: ['SKILL.md']`

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `api-design`
- WHEN the catalog is loaded
- THEN the skill MUST NOT be selectable
- AND the error MUST name the offending path and reason

#### Scenario: Description contract

- GIVEN `catalog/skills/api-design/SKILL.md`
- WHEN its frontmatter is inspected
- THEN `description` is one line, single-quoted, at most 250 characters and starts with `Trigger:`
- AND it contains no apostrophes, double quotes or pipes

### Requirement: Model-invocable and generic

Frontmatter MUST NOT set `disable-model-invocation: true` (the key SHOULD be omitted). The skill MUST be generic and tool-agnostic (usable in any repository, no dependency on a specific framework, linter, generator or API gateway) and written in concise English. It MUST NOT hardcode shitaku-specific names, files, tools or conventions, and MUST NOT contain the literal `Co-Authored-By` token.

#### Scenario: Invocable and generic

- GIVEN `catalog/skills/api-design/SKILL.md` after the change
- WHEN frontmatter and body are inspected
- THEN `disable-model-invocation` is absent or not `true`
- AND the text does not match `/shitaku/i`
- AND the text does not contain `Co-Authored-By`

### Requirement: Required sections

The skill body MUST contain five sections in this order: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract. Decision Gates MUST be a Condition | Action table and Execution Steps MUST be numbered. The skill SHOULD stay concise (about 100-140 lines) using one-line rules.

#### Scenario: Section layout

- GIVEN `catalog/skills/api-design/SKILL.md`
- WHEN its headings are inspected
- THEN Activation Contract, Hard Rules, Decision Gates, Execution Steps and Output Contract are present in that order
- AND Decision Gates is a table with Condition and Action columns
- AND Execution Steps is a numbered list

### Requirement: Repository conventions first

The skill MUST instruct the agent to inspect the repository before designing: existing routes, OpenAPI documents, error shapes, naming, casing and versioning. Repository conventions MUST take precedence over every skill default, and the skill MUST include a "Repository conventions first" rule stating this.

#### Scenario: Existing conventions found

- GIVEN the repository has existing routes, an OpenAPI document and an established error shape and versioning scheme
- WHEN the agent follows `api-design`
- THEN it adopts those naming, error, pagination and versioning conventions
- AND those conventions override conflicting skill defaults

#### Scenario: No conventions detectable

- GIVEN the repository has no existing API or documents to infer from
- WHEN the agent follows `api-design`
- THEN it falls back to the defaults of the skill (URI major version, Problem Details, cursor pagination)

### Requirement: Resource modeling and HTTP semantics

The skill MUST instruct the agent to model resources as plural nouns, keep verbs out of paths, use consistent casing, keep nesting shallow, and apply correct HTTP method semantics (safe and idempotent methods) and appropriate status codes. Filtering and sorting MUST be expressed through query parameters.

#### Scenario: Resource-oriented design

- GIVEN a request to design an endpoint to cancel an order
- WHEN the agent follows `api-design`
- THEN paths use plural nouns and contain no verbs in the path
- AND the chosen HTTP method and status codes match their semantics

#### Scenario: Collection filtering and sorting

- GIVEN a collection that callers need to filter or order
- WHEN the agent designs the operation
- THEN filtering and sorting are query parameters, not separate path segments

### Requirement: Versioning default

The skill MUST instruct the agent to default to a URI major version (for example `/v1`) only when the repository has no versioning convention. When a repository convention exists (for example header or media-type versioning), it MUST win.

#### Scenario: No versioning convention

- GIVEN the repository has no versioning convention
- WHEN the agent designs new routes
- THEN it uses a URI major version such as `/v1`

#### Scenario: Existing convention wins

- GIVEN the repository versions via a header or media type
- WHEN the agent designs new routes
- THEN it keeps that convention and does not introduce a URI version

### Requirement: Error format

The skill MUST instruct the agent to use `application/problem+json` (Problem Details) as the default error format when the repository has no established error shape, and to keep one consistent error shape across the API.

#### Scenario: Default error responses

- GIVEN the repository has no established error shape
- WHEN the agent defines error responses
- THEN they use `application/problem+json` with Problem Details fields

#### Scenario: Established error shape

- GIVEN the repository already uses a consistent error body
- WHEN the agent defines error responses
- THEN it reuses that shape

### Requirement: Cursor pagination

The skill MUST instruct the agent to use `cursor`-based pagination as the default for collections (when no repository convention exists) and to avoid unbounded collection responses.

#### Scenario: Collection endpoint

- GIVEN a new collection endpoint and no pagination convention in the repository
- WHEN the agent designs it
- THEN it uses `cursor`-based pagination
- AND the response is bounded

### Requirement: Idempotency

The skill MUST instruct the agent to respect safe and idempotent method semantics and to support an `Idempotency-Key` header for retryable non-idempotent writes (for example `POST` creating resources or payments).

#### Scenario: Retryable non-idempotent write

- GIVEN a `POST` operation that clients may retry after a timeout
- WHEN the agent designs the operation
- THEN it accepts an `Idempotency-Key` header
- AND repeated requests with the same key do not repeat the effect

#### Scenario: Naturally idempotent method

- GIVEN a `PUT` or `DELETE` operation
- WHEN the agent designs the operation
- THEN it relies on method idempotency and does not require `Idempotency-Key`

### Requirement: Evolution and compatibility classification

The skill MUST instruct the agent to classify every contract change as `backward-compatible` or `breaking change`. A `breaking change` MUST require a new major version and a deprecation path; a `backward-compatible` change MUST NOT require a new major version. The Decision Gates MUST map these classifications to actions.

#### Scenario: Additive change

- GIVEN a change adding an optional response field
- WHEN the agent classifies it
- THEN it is `backward-compatible`
- AND no new major version is required

#### Scenario: Breaking change

- GIVEN a change removing a field or making a request parameter required
- WHEN the agent classifies it
- THEN it is a `breaking change`
- AND the agent requires a new major version and a deprecation path for the old one

### Requirement: OpenAPI 3.1 contract output

The Output Contract MUST require an OpenAPI 3.1 contract plus a short decision summary (conventions found, defaults applied, compatibility classification). SKILL.md MUST contain exactly one short, valid inline OpenAPI 3.1 YAML code fence as the reference example. Standards references (for example Problem Details, deprecation headers) MUST be cited only when verified.

#### Scenario: Contract reported

- GIVEN the agent finishes a design
- WHEN it reports the result
- THEN it provides an OpenAPI 3.1 contract and a short decision summary

#### Scenario: Inline example

- GIVEN `catalog/skills/api-design/SKILL.md`
- WHEN its fenced code blocks are inspected
- THEN exactly one YAML fence exists and it is a valid OpenAPI 3.1 document
- AND `pnpm run format:check` and the website catalog generator accept it

### Requirement: Scope limited to API contract design (Not for)

The skill MUST state in its Activation Contract (ending with a "Not for ..." sentence) that it is not for product requirements or user stories (owned by `product-owner`), prose API documentation or guides (owned by `docs-writing`), implementing handlers or writing tests, or non-HTTP protocols beyond a brief mention. Existing skills, rules, agents and profiles MUST remain unchanged, and no `api-designer` agent or profile entry is added.

#### Scenario: Out-of-scope content absent

- GIVEN `catalog/skills/api-design/SKILL.md`
- WHEN the Activation Contract is inspected
- THEN a `Not for` statement excludes product requirements or user stories and prose API documentation
- AND it also excludes implementing handlers, writing tests and non-HTTP protocols

#### Scenario: Existing items unchanged

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN no existing skill, rule, agent or profile file is modified
- AND `catalog/catalog.json` only gains the `api-design` skill entry

### Requirement: Content contract guard

`test/adapters/catalog/bundled-catalog.test.ts` MUST assert the exact skill lists and count 9, the `api-design` entry with `files: ['SKILL.md']`, and a content-contract test via `expectSkillContract` that checks the load-bearing tokens (`Repository conventions first`, `OpenAPI`, `Idempotency-Key`, `application/problem+json`, `cursor`, `backward-compatible`, `breaking change`, `Not for`) plus the forbidden `/shitaku/i` and `Co-Authored-By`.

#### Scenario: Guard fails before the skill exists

- GIVEN the test changes are applied without the skill or catalog entry
- WHEN `pnpm test` runs
- THEN the bundled-catalog tests fail (RED)

#### Scenario: Guard passes after the skill is added

- GIVEN the skill and catalog entry are added
- WHEN `pnpm test` runs
- THEN the bundled-catalog and content-contract tests pass (GREEN)

### Requirement: Installable create when absent

When the target is absent, `init --skills api-design --dry-run` MUST classify `create` and MUST NOT write files, backups, or manifest. Applied install MUST be byte-identical under existing skills-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target directory for `api-design`
- WHEN `init --skills api-design --dry-run` runs
- THEN the plan classifies `api-design` as `create`
- AND no file, backup, or manifest changes occur

#### Scenario: Byte-identical install under existing skills-install

- GIVEN the bundled `api-design` skill and an absent target
- WHEN `init --skills api-design` applies successfully
- THEN the target skill tree is byte-identical to the catalog skill
- AND behavior follows existing skills-install requirements without modification

### Requirement: Catalog-only surface with synced docs

Delivery MUST be catalog data, tests, and regenerated docs only. `src/` hexagonal layers MUST NOT change, no install-time templating MUST be introduced, and `CHANGELOG.md` MUST NOT be edited. The README skills table and website catalog pages (en, es) MUST be regenerated, not hand-edited, so the docs check scripts pass.

#### Scenario: No src changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/` and `CHANGELOG.md` are unchanged
- AND no install-time templating is introduced

#### Scenario: Generated docs in sync

- GIVEN `api-design` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `api-design`

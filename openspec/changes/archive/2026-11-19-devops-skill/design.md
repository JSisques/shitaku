# Design: Add devops Catalog Skill

## Technical Approach

Mirror the archived `2026-11-19-api-design-skill` change: one generic, tool-agnostic `catalog/skills/devops/SKILL.md` with the shared skill contract (two-key frontmatter, five fixed `##` sections, Condition | Action Decision Gates table, numbered Execution Steps), registered in `catalog/catalog.json`. Hard Rules are grouped under three `###` subheadings (Images, Pipelines, Deployments) after a short general block, so a broad topic stays scannable with one-line rules. One short multi-stage `dockerfile` fence closes the Output Contract as a reference example. No `src/` change: `FolderCatalogSource` and the `skills-install` byte-copy path already handle a single-file skill once registered. Correctness is pinned by `test/adapters/catalog/bundled-catalog.test.ts` (registration, loadability, `files: ['SKILL.md']`, count 10) and by `expectSkillContract` (frontmatter shape, headings, load-bearing tokens, forbidden tokens), plus the same no-`---` body assertion api-design uses. README and website pages are regenerated, never hand-edited.

Strict TDD order: RED (test edits only) -> GREEN (SKILL.md + catalog.json) -> format -> docs generators -> full gates -> build and dry-run install.

## Architecture Decisions

### Decision: Single-file skill with grouped Hard Rules

**Choice**: Only `SKILL.md` in `catalog/skills/devops/`, about 120-130 lines. `## Hard Rules` holds three general rules, then `### Images`, `### Pipelines` and `### Deployments` with one-line rules each.
**Alternatives considered**: One flat list of ~25 rules (hard to scan, mixes concerns); a `references/` folder per topic (breaks the `files: ['SKILL.md']` precedent; out of scope per proposal); three separate skills (the issue asks for one devops skill).
**Rationale**: The three groups map 1:1 to the issue scope and to the spec requirements (Dockerfile, CI/CD, deployment safety). `expectSkillContract` only checks that each `## ` heading is present in the body, so `###` subheadings are compatible.

### Decision: Include one short multi-stage Dockerfile fence

**Choice**: A `### Reference Dockerfile` subsection at the end of `## Output Contract` with one `dockerfile` fence of ~17 lines: a build stage that copies manifests and the lockfile before source, uses a cache mount and a build secret mount, and a runtime stage on the same pinned base, `--chown` copies, `USER node`, exec-form `HEALTHCHECK` and `CMD`.
**Alternatives considered**: Prose only (the proposal default if the example pushed the skill past target; the outline below stays within ~130 lines, so the tradeoff favors the example); a CI workflow example too (vendor-specific syntax, violates tool-agnostic scope); a language-neutral pseudo-Dockerfile (not valid, so agents cannot copy its shape).
**Rationale**: One example demonstrates six rules at once (layer order, multi-stage, pinned tag, build secret mount, non-root, exec form with a health check) more compactly than prose. Node is used only as an illustrative runtime; a sentence states the shape, not the runtime, is what matters. The fence contains no `---` line, no `latest`, and no embedded secret, as the spec requires. Prettier has no built-in Dockerfile formatter, so the fence content is left untouched by `pnpm run format`; only surrounding Markdown is normalized.

### Decision: No `---` line anywhere in the body

**Choice**: The body contains no line that is exactly `---`. The devops contract test repeats api-design's explicit assertion `raw.split(/\r?\n---\r?\n/)` has length 2.
**Alternatives considered**: Rely on `expectSkillContract` alone.
**Rationale**: Verified in code: `expectSkillContract` splits `raw` with `/^---\r?\n|\r?\n---\r?\n/`, so a body `---` truncates `body` silently while headings before it still pass. The assertion makes such drift fail loudly.

### Decision: Description text (231 characters)

**Choice**:

```
Trigger: write or review a Dockerfile, CI pipeline, CI/CD workflow, deployment step, rollback plan. Build images, pipelines and deploys: multi-stage, pinned bases, non-root, cached builds, least privilege, health checks, rollbacks.
```

Manual count: `Trigger: ` 9, `write or review a Dockerfile, ` 30 (39), `CI pipeline, ` 13 (52), `CI/CD workflow, ` 16 (68), `deployment step, ` 17 (85), `rollback plan. ` 15 (100), `Build images, pipelines and deploys: ` 37 (137), `multi-stage, ` 13 (150), `pinned bases, ` 14 (164), `non-root, ` 10 (174), `cached builds, ` 15 (189), `least privilege, ` 17 (206), `health checks, ` 15 (221), `rollbacks.` 10 (231). No `'`, `"` or `|`; no contractions. Margin 19; the contract test rechecks it.
**Alternatives considered**: Naming `container image` and `.dockerignore` as triggers (exceeds 250); naming a CI vendor (violates tool-agnostic scope and invites vendor-only activation); `Kubernetes` or `Helm` anywhere in the description (would invite out-of-scope invocations).
**Rationale**: Trigger phrases drive model invocation; both writing and reviewing are first-class entry points, and the second sentence names the default practices.

### Decision: Standards and tool citations

**Choice**: The skill cites no RFC or standard by number. It names only long-stable Dockerfile instructions and flags in prose and the example: `USER`, `HEALTHCHECK`, exec-form `CMD`/`ENTRYPOINT`, `COPY --from`, `COPY --chown`, `RUN --mount=type=cache`, `RUN --mount=type=secret`, `ARG`, `ENV`, `# syntax=docker/dockerfile:1`. CI concepts are named generically (token permissions, secret store, OIDC short-lived credentials, pinning actions or images to a commit SHA or digest).
**Alternatives considered**: Citing CIS Docker Benchmark, SLSA levels or OpenSSF Scorecard checks (precision the issue does not ask for, and claims that drift between versions); naming GitHub Actions `permissions:` syntax (vendor-specific).
**Rationale**: Unverified in the design phase: no web or fetch tool was available. The cited items are long-documented BuildKit and Dockerfile reference features; the riskiest detail is the `secret` mount `target=` option and the `node:22.13-bookworm-slim` tag format in the example. Apply should verify against the Dockerfile reference (docs.docker.com/reference/dockerfile/) and the official `node` image tag list if a fetch tool is available, and record the result here as was done for api-design. If the tag cannot be verified, use `node:22-bookworm-slim` (major-pinned, still an explicit tag) and keep the digest rule in prose.

### Decision: Opinionated defaults, all subordinate to repository conventions

**Choice**: Defaults apply only when the repository has no convention: multi-stage with a minimal runtime stage, version-pinned base (digest when reproducibility matters), non-root runtime user, `.dockerignore`, stages lint -> test -> build -> deliver -> deploy, lockfile-keyed caches, read-only default token permissions, build once and promote, health check gating, documented rollback, expand-then-contract migrations. The first Hard Rule and the first Decision Gate make repository conventions win.
**Alternatives considered**: Neutral guidance with no defaults (agents keep improvising, the problem in the issue).
**Rationale**: Mirrors `test-writing`, `commit-writing` and `api-design` ("Repository conventions first ... they win over the defaults in this skill"). Exception: a leaked secret is always flagged, regardless of convention.

### Decision: Activation boundary

**Choice**: Activation Contract ends with `Not for Kubernetes manifests or Helm charts, Terraform or other infrastructure as code, cloud-provider-specific services, application code, or writing tests.` Two Decision Gate rows redirect those requests. Sibling skills are not named by catalog name.
**Alternatives considered**: Naming `test-writing` inside the skill (couples skills; rejected by the earlier skill designs).
**Rationale**: Matches the spec requirement and the issue scope; the sentence is the contract-test anchor.

### Decision: Contract-test tokens

**Choice**: Required (exact substrings of `raw`): `Repository conventions first`, `multi-stage`, `.dockerignore`, `non-root`, `type=secret`, `lockfile`, `least privilege`, `health check`, `rollback`, `same artifact`, `environment parity`, `Not for Kubernetes`. Forbidden: `/shitaku/i`, `'Co-Authored-By'`, `':latest'`, `'kubectl'`. Plus the no-`---` split assertion.
**Alternatives considered**: Only the spec's eight (bare `Not for` is a weak substring; no-secrets-in-layers, cache keys and artifact promotion would be unguarded); forbidding `latest` outright (the skill must say "never `latest`").
**Rationale**: The spec's eight are kept (`Not for` is satisfied by its stronger superset `Not for Kubernetes`). The extras pin the highest-consequence rules: build secret mounts, lockfile-keyed caching, build-once promotion and environment parity. `:latest` guards the example and rules against an unpinned image reference; `kubectl` guards against Kubernetes how-to creeping in.

### Decision: Two commits in one PR

**Choice**: `feat(catalog): add devops skill` (test, SKILL.md, catalog.json) then `docs: list devops skill in README and website` (generated files only).
**Alternatives considered**: One commit; chained PRs.
**Rationale**: Authored diff ~165-185 lines (SKILL.md ~125, test ~30, catalog.json 1), under the 400-line budget, so `auto-chain` does not slice. `docs:catalog:check` runs in CI, not in hooks, so commit 1 passes `pre-push` alone; push after commit 2.

## Data Flow

    catalog/skills/devops/SKILL.md ──────┐
    catalog/catalog.json (items.skills) ─┼──→ FolderCatalogSource.load() ──→ init --skills devops (byte copy, body + fence)
                                         │
                                         ├──→ frontmatter description only ──→ scripts/generate-catalog-table.mjs ──→ README.md
                                         └──→ frontmatter description only ──→ scripts/generate-website-catalog.mjs ──→ website/.../{en,es}/catalog/skills/devops.md

Generators read only the frontmatter `description` (verified in the api-design design via `scripts/lib/frontmatter-description.mjs`), so the body and fence never reach generated pages.

## File Changes

| File                                                   | Action             | Description                                                                          |
| ------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------ |
| `test/adapters/catalog/bundled-catalog.test.ts`        | Modify             | Test name, both skill lists, count 10, `byName` block, new contract test (RED first) |
| `catalog/skills/devops/SKILL.md`                       | Create             | Skill content (outline below)                                                        |
| `catalog/catalog.json`                                 | Modify             | Insert `"devops"` between `"commit-writing"` and `"docs-writing"` in `items.skills`  |
| `README.md`                                            | Modify (generated) | Skills table row via `pnpm run docs:catalog`                                         |
| `website/src/content/docs/en/catalog/skills/devops.md` | Create (generated) | `pnpm run docs:website-catalog`                                                      |
| `website/src/content/docs/es/catalog/skills/devops.md` | Create (generated) | Same generator                                                                       |

No `src/`, profile, agent, rule, generator script, `.prettierignore`, CONTRIBUTING or CHANGELOG change.

## Interfaces / Contracts

### SKILL.md outline (target text; apply may polish wording but must keep every required token, avoid every forbidden token, and keep the body free of `---` lines)

````markdown
---
name: devops
description: '<231-char description above>'
---

## Activation Contract

Use when asked to write, review, or change a container image (Dockerfile, `.dockerignore`, compose file), a CI/CD pipeline (stages, caching, matrix, secrets, permissions), or a deployment step (health checks, promotion, rollback). Not for Kubernetes manifests or Helm charts, Terraform or other infrastructure as code, cloud-provider-specific services, application code, or writing tests.

## Hard Rules

- Repository conventions first: inspect existing Dockerfiles, compose files, CI workflow files, deploy scripts, and runtime and toolchain versions; they win over the defaults in this skill.
- Stay tool-agnostic: name a CI platform, registry, or cloud only when the repository already uses it.
- Never put secrets in files, images, build args, logs, or history; a leaked secret is always flagged, whatever the convention.

### Images

- Order layers for caching: copy dependency manifests and the lockfile, install, then copy the source.
- Use multi-stage builds: build tools stay in the build stage; the runtime stage holds only the artifact and its runtime dependencies on a minimal base.
- Pin base images to an explicit version tag, and to a digest when reproducibility matters; never use `latest` or an untagged base.
- Run the runtime stage as a non-root user; the process owns only the paths it writes.
- Keep a `.dockerignore` that excludes VCS data, local env files, dependency folders, build output, and credentials.
- Never pass secrets through `ARG`, `ENV`, or `COPY`; they persist in layers or image history. Use a build secret mount (`RUN --mount=type=secret`) or inject them at runtime.
- Use exec-form `CMD` or `ENTRYPOINT` so the process receives signals, and shut down gracefully on SIGTERM.
- One concern per container; log to stdout and stderr.

### Pipelines

- Order stages lint, test, build, deliver, deploy; fail fast and run the cheapest checks first.
- Build once: later stages use the same artifact, identified by an immutable tag or digest such as the commit SHA.
- Key dependency and build caches on the lockfile and toolchain version; a cache miss may slow a build but never change its result.
- Use lockfile-exact installs and pinned toolchain versions; never pipe a downloaded script into a shell.
- Use matrix builds only for the versions or platforms the project supports.
- Read secrets from the platform secret store, scope them to the jobs that need them, and never echo them or write them to artifacts.
- Apply least privilege: default token permissions to read-only, grant write scopes per job, and prefer short-lived OIDC credentials over long-lived keys.
- Pin third-party actions, plugins, and CI images to a commit SHA or digest.
- Never expose secrets to jobs triggered by untrusted forks or pull requests.

### Deployments

- Every service exposes a health check: readiness gates traffic and liveness drives restarts, where the platform supports both; liveness never depends on downstream services.
- Promote the same artifact from one environment to the next; never rebuild an image per environment.
- Keep environment parity: environment-specific values come from environment variables or mounted configuration, never from the image.
- Document a rollback path to the previous immutable artifact for every deployment, and keep that artifact available.
- Keep schema changes backward-compatible with the running version (expand, then contract) so a rollback needs no down migration.
- Roll out progressively (rolling, blue-green, or canary) gated on health checks; stop and roll back when checks fail.
- Production deploys need an explicit trigger or approval as the repository policy defines.

## Decision Gates

| Condition                                                                                               | Action                                                               |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The repository has Dockerfiles, pipelines, or deploy scripts                                            | Follow their conventions over the defaults in this skill             |
| No convention is found                                                                                  | Apply the defaults above and list each one used                      |
| The request is an image, a pipeline, or a deployment                                                    | Apply that rule group; a review checks all groups the change touches |
| A base image, action, or CI image is unpinned or uses `latest`                                          | Pin it and flag the change                                           |
| The runtime runs as root                                                                                | Add a non-root user, or flag why root is required                    |
| A secret appears in a file, layer, build arg, or log                                                    | Flag it as critical, remove it, and recommend rotating it            |
| A token or job has more permissions than it uses                                                        | Reduce it to least privilege                                         |
| A deployment has no health check or rollback path                                                       | Add them, or flag the gap as blocking                                |
| An image is rebuilt per environment                                                                     | Promote the same artifact with per-environment configuration         |
| A schema change is not backward-compatible                                                              | Split it into expand and contract deployments                        |
| The request is Kubernetes, Helm, Terraform or other infrastructure as code, or a cloud-specific service | Out of scope; say so and stop                                        |
| The request is application code or tests                                                                | Out of scope; leave it to the matching workflow                      |

## Execution Steps

1. Classify the request: image, pipeline, deployment, or a review of one of them.
2. Read the conventions: Dockerfiles, `.dockerignore`, compose files, CI workflow files, deploy scripts, and runtime and toolchain versions.
3. List unsafe patterns: root user, `latest` or unpinned bases and actions, secrets in layers or logs, broad permissions, missing health check or rollback.
4. Write or change the files with the smallest diff that applies the rules.
5. Check the result against the hard rules and the repository conventions; run the available build or lint commands and note any not run.
6. Report the outcome.

## Output Contract

Return the changed files (or the diff); a decision summary with the conventions found and their source, each default applied, and each unsafe pattern flagged; review findings ordered by severity when reviewing (leaked secrets first); the checks run and not run; and open questions.

### Reference Dockerfile

Illustrative runtime; the shape, not the runtime, is the point.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22.13-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22.13-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "dist/healthcheck.js"]
CMD ["node", "dist/server.js"]
```
````

Body ~120-130 lines after formatting. The Decision Gates table is shown unaligned; `pnpm run format` aligns it (accept the output). Token check against the outline: `Repository conventions first` (Hard Rules), `multi-stage` (Hard Rules), `.dockerignore` (Activation, Hard Rules, steps), `non-root` (Hard Rules, gates), `type=secret` (Hard Rules, fence), `lockfile` (Images and Pipelines rules), `least privilege` (Pipelines rules, gates), `health check` (Deployments rules, gates, steps), `rollback` (multiple), `same artifact` (Pipelines and Deployments rules), `environment parity` (Deployments rules), `Not for Kubernetes` (Activation Contract). Forbidden check: no `shitaku`, no attribution trailer name, no `:latest` (the rule writes `` `latest` `` without a colon), no `kubectl`. No `---` line in the body.

### Test edits (`test/adapters/catalog/bundled-catalog.test.ts`)

1. Rename the registration test to `ships api-design, commit-writing, devops, docs-writing, example-skill, pr-writing, product-owner, refactoring, socratic-method and test-writing as registered loadable bundled skills`.
2. Insert `'devops'` after `'commit-writing'` in both exact lists (`index.items.skills` and the sorted `readdirSync` entries).
3. `expect(catalog.skills).toHaveLength(10);`
4. After the `commit-writing` `byName` block:

```ts
expect(byName['devops']).toMatchObject({ name: 'devops' });
expect(byName['devops']?.description.length).toBeGreaterThan(0);
expect(byName['devops']?.files.map((f) => f.path)).toEqual(['SKILL.md']);
```

5. New test after `keeps the api-design skill content contract`:

```ts
it('keeps the devops skill content contract', () => {
  expectSkillContract('devops', {
    required: [
      'Repository conventions first',
      'multi-stage',
      '.dockerignore',
      'non-root',
      'type=secret',
      'lockfile',
      'least privilege',
      'health check',
      'rollback',
      'same artifact',
      'environment parity',
      'Not for Kubernetes',
    ],
    forbidden: [/shitaku/i, 'Co-Authored-By', ':latest', 'kubectl'],
  });
  // The Dockerfile example must not add a `---` line: the contract split would truncate the body there.
  const raw = readFileSync(join(catalogRoot, 'skills', 'devops', 'SKILL.md'), 'utf8');
  expect(raw.split(/\r?\n---\r?\n/)).toHaveLength(2);
});
```

Expected RED: list and count assertions fail (9 skills, missing `devops`) and `expectSkillContract` throws ENOENT on the missing SKILL.md.

### catalog.json edit

Insert `"devops"` between `"commit-writing"` and `"docs-writing"` in `items.skills`; the array is already multi-line. Run `pnpm run format`. No other key changes.

### Command sequence

```sh
pnpm test                          # RED observed after test edits
# add SKILL.md + catalog.json entry
pnpm run format
pnpm test                          # GREEN
# commit 1: feat(catalog): add devops skill
pnpm run docs:catalog
pnpm run docs:website-catalog
pnpm run docs:catalog:check
pnpm run docs:website-catalog:check
pnpm run typecheck && pnpm run lint && pnpm run format:check
pnpm run build && node dist/main.js init --skills devops --scope project --dry-run   # expect a create
# commit 2: docs: list devops skill in README and website
```

## Testing Strategy

| Layer            | What to Test                                                                              | Approach                                                   |
| ---------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Unit / adapter   | Registration, loadability, `files: ['SKILL.md']`, count 10                                | Extend existing bundled-catalog test (RED first)           |
| Content contract | Frontmatter shape, 250-char description, headings, 12 required tokens, 4 forbidden tokens | `expectSkillContract('devops', ...)`                       |
| Body integrity   | No `---` line in the body (frontmatter split stays exact)                                 | Explicit `split` length assertion in the same test         |
| Formatting       | Markdown, gate table and fence surroundings are Prettier-stable                           | `pnpm run format:check`                                    |
| Repo checks      | README and website drift                                                                  | `docs:catalog:check`, `docs:website-catalog:check`         |
| Smoke            | Install plan                                                                              | Built CLI `init --skills devops --scope project --dry-run` |
| E2E              | N/A                                                                                       | Not configured in this project                             |

Dockerfile validity of the example is checked by review, not by a test: building it would need a container runtime and a project (out of scope; no new dependency).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in shitaku code. The change adds static catalog data and a test; the skill body (including the Dockerfile fence) is installed as a byte copy and never executed or parsed beyond its frontmatter.

## Migration / Rollout

No migration required. Skill is opt-in via `init --skills devops`; not added to any profile or agent.

## Open Questions

- [x] Verified in apply (Docker Hub tags API, docker/docs and nodejs/docker-node on GitHub): `RUN --mount=type=secret,id=...,target=...` and `--mount=type=cache,target=...` syntax confirmed; `node:22.13-bookworm-slim` is a published tag; the image creates a `node` user (uid 1000). No fallback needed. Non-blocking.

# Proposal: Add devops Catalog Skill

## Intent

Add a bundled **devops** skill (#272) so agents write and review container images, CI/CD pipelines and deployment steps consistently. Today agents improvise: bloated single-stage images, unpinned `latest` base images, containers running as root, secrets baked into layers, missing `.dockerignore`, pipelines without caching, over-privileged CI tokens, and deployments with no health check or rollback path. No catalog skill covers delivery infrastructure; the skill gives agents one generic, tool-agnostic playbook that defers to repository conventions.

## Scope

### In Scope

- `catalog/skills/devops/SKILL.md`: English, generic and tool-agnostic, model-invocable (no `disable-model-invocation`), exactly two frontmatter keys: `name: devops` and a single-quoted, single-line `Trigger:`-style `description` (<=250 chars, no apostrophes, double quotes or pipes). Layout mirrors the sibling skills: Activation Contract (ending with a "Not for ..." sentence), Hard Rules, Decision Gates (Condition | Action table), Execution Steps (numbered), Output Contract. Target length about 90-130 lines with one-line rules.
- Skill behavior:
  - **Repository conventions first**: inspect existing Dockerfiles, compose files, CI workflow files, deploy scripts and runtime versions; they win over the skill defaults.
  - **Dockerfile**: layer caching (dependency manifests copied and installed before source), `multi-stage` builds with a minimal runtime stage, pinned base images (explicit version tag, digest when reproducibility matters, never `latest`), a `non-root` runtime user, a `.dockerignore`, and no secrets in layers or build args (use build-time secret mounts or runtime injection).
  - **CI/CD pipelines**: clear stage structure (lint, test, build, deliver, deploy) that fails fast, dependency and build caching keyed on lockfiles, matrix builds only for supported versions or platforms, secrets from the platform secret store and never echoed, `least privilege` tokens and permissions, and pinned third-party actions or images.
  - **Deployment safety**: a `health check` (readiness and liveness where the platform supports it), a documented `rollback` path to the previous immutable artifact, the same artifact promoted across environments, and environment parity (configuration through environment variables, not rebuilt images).
  - Activation boundary: "Not for" Kubernetes manifests, Terraform or other infrastructure-as-code, cloud-provider-specific services, application code, or test authoring (owned by `test-writing`).
- Register `devops` in `catalog/catalog.json` -> `items.skills` in alphabetical order (after `commit-writing`, before `docs-writing`); run `pnpm run format`.
- Update `test/adapters/catalog/bundled-catalog.test.ts` RED first: rename the registration test title, both exact skill lists, count 9 -> 10, a `byName['devops']` entry with `files: ['SKILL.md']`, and a content-contract test via `expectSkillContract` asserting load-bearing tokens (proposed: `Repository conventions first`, `multi-stage`, `.dockerignore`, `non-root`, `least privilege`, `health check`, `rollback`, `Not for`) and the forbidden tokens (`/shitaku/i`, `Co-Authored-By`). Final token list is fixed in spec/design.
- Regenerate docs: `pnpm run docs:catalog` (README) then `pnpm run docs:website-catalog` (website en/es); verify with the matching `:check` scripts.

### Out of Scope

- Kubernetes, Helm, Terraform, Pulumi or any infrastructure-as-code guidance beyond a scoping note.
- Cloud-provider-specific services (AWS, GCP, Azure, Vercel and similar) and vendor-specific CI syntax beyond illustrative mentions.
- A `devops` agent or any profile entry (separate issue).
- Changes to other skills, rules, agents or profiles.
- Tooling integrations (hadolint, image scanners, workflow linters).
- A `references/` folder, separate example files or a multi-file skill.
- Any `src/` change or install-time templating.
- Hand edits to generated README or website pages, or to `CHANGELOG.md` (release-generated).

## Capabilities

Install, list and validate behavior stays under the existing `catalog` and `skills-install` capabilities (no deltas). The existing `ci-workflow` capability describes this repository's own CI and is not affected.

### New Capabilities

- `devops-skill`: catalog-bundled devops skill content (repository conventions first, Dockerfile practices: layer caching, multi-stage, pinned bases, non-root, `.dockerignore`, no secrets in layers; CI/CD practices: structure, caching, matrix, secrets, least privilege; deployment safety: health checks, rollbacks, environment parity), activation boundary versus Kubernetes/IaC/cloud-specific work and `test-writing`, decision gates, and installability acceptance.

### Modified Capabilities

None

## Approach

Single dense generic `SKILL.md`, mirroring the archived `2026-11-19-api-design-skill` change. The skill tells the agent to inspect repository conventions, classify the request (image, pipeline, deployment), apply the default rules where no convention exists, flag unsafe patterns (root user, `latest`, leaked secrets, over-broad permissions, no rollback), and report the changed files plus a short decision summary. An optional single short multi-stage Dockerfile fence as a reference example is decided in design (the api-design precedent shows a fence passes Prettier and the website generator); default is prose only if it would push the skill beyond the target length. Install remains a byte-identical copy.

Strict TDD (`pnpm test`): update the bundled-catalog test and add the content-contract test first and observe RED, then add the skill and catalog entry (GREEN), then format, regenerate docs, run gates, and dry-run `init --skills devops`.

Delivery (`auto-chain`, expected under budget): one PR with two Conventional Commits, no chaining:

1. `feat(catalog): add devops skill` (test, SKILL.md, catalog.json).
2. `docs: list devops skill in README and website` (generated README and website pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and generated docs only.

| Area                                                        | Impact   | Description                                                  |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| `catalog/skills/devops/SKILL.md`                            | New      | Skill content and frontmatter                                |
| `catalog/catalog.json`                                      | Modified | Add `devops` between `commit-writing` and `docs-writing`     |
| `test/adapters/catalog/bundled-catalog.test.ts`             | Modified | Skill lists, count 10, `byName` entry, content-contract test |
| `README.md`                                                 | Modified | Skills table (generated by `docs:catalog`)                   |
| `website/src/content/docs/{en,es}/catalog/skills/devops.md` | New      | Website pages (generated by `docs:website-catalog`)          |
| `src/`                                                      | None     | Catalog data only                                            |

## Risks

| Risk                                                               | Likelihood | Mitigation                                                                               |
| ------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| Description breaks the 250-char or no-apostrophe/quote/pipe rule   | Med        | Count characters; avoid contractions; `expectSkillContract` enforces it                  |
| Broad topic (images, CI, deploys) bloats the skill                 | Med        | One-line rules, compact gate table, three grouped rule blocks, Kubernetes/IaC scoped out |
| Vendor-specific advice leaks in (one CI platform, one cloud)       | Med        | Hard rule: tool-agnostic wording; vendor names only as illustrative examples             |
| Opinionated defaults conflict with an existing pipeline or image   | Low        | Hard rule: repository conventions first; defaults apply only when no convention exists   |
| A bare `---` line or code fence breaks frontmatter parsing or docs | Low        | No `---` in body; run `format:check` and both docs `:check` scripts                      |
| Overlap with `test-writing` or a future devops agent               | Low        | Explicit "Not for ..." boundary in the Activation Contract                               |
| README table re-padding inflates the docs diff                     | Low        | Accept generated output; isolated in the docs commit                                     |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/skills/devops/`, the `catalog.json` entry, the test changes and the regenerated README and website pages (or rerun the docs scripts after the revert). No `src/`, manifest or migration impact. Users who already installed the skill can run `shitaku undo` or delete the installed skill directory. No agent or profile depends on the skill.

## Dependencies

- Existing `skills-install` capability and catalog docs generators.
- No external dependency.

## Review Workload Forecast

Expected authored change ~130-180 lines: ~90-130-line SKILL.md, a few catalog.json lines, ~25-40 test lines; generated README and website pages excluded. Single PR, two commits. 400-line budget risk: Low. Decision needed before apply: No. Chained PRs recommended: No.

## Success Criteria

- [ ] Bundled-catalog test lists 10 skills including `devops` and passes (observed RED first)
- [ ] Content-contract test for `devops` passes via `expectSkillContract`
- [ ] `pnpm run build` then `node dist/main.js init --skills devops --scope project --dry-run` plans a `create` for the skill
- [ ] `docs:catalog:check` and the website catalog check pass
- [ ] SKILL.md has `name: devops`, Trigger-style one-line `description` (<=250 chars), no `disable-model-invocation`
- [ ] SKILL.md states repository conventions first; defaults apply only when no convention exists
- [ ] SKILL.md covers layer caching, multi-stage builds, pinned base images, non-root user, `.dockerignore` and no secrets in layers
- [ ] SKILL.md covers CI/CD structure, caching, matrix builds, secrets handling and least privilege
- [ ] SKILL.md covers health checks, rollbacks and environment parity
- [ ] SKILL.md excludes Kubernetes, infrastructure-as-code, cloud-specific services, application code and test authoring
- [ ] No `src/` changes; `CHANGELOG.md` untouched
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass

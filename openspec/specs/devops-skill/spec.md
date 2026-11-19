# devops-skill Specification

## Purpose

Catalog-bundled **devops** skill: single generic, tool-agnostic English skill that guides an agent to write and review container images, CI/CD pipelines and deployment steps (repository conventions first; Dockerfile practices: layer caching, multi-stage builds, pinned base images, non-root user, `.dockerignore`, no secrets in layers; CI/CD practices: fail-fast stage structure, lockfile-keyed caching, supported-only matrix builds, platform secret store, least privilege, pinned third-party actions or images; deployment safety: health checks, rollback to the previous immutable artifact, artifact promotion, environment parity). Model-invocable, installable via existing skills-install. Kubernetes, infrastructure-as-code, cloud-provider-specific services, application code and test authoring belong elsewhere.

## ADDED Requirements

### Requirement: Bundled registration and valid frontmatter

The bundled catalog MUST list `devops` in `items.skills`, in alphabetical order (after `commit-writing`, before `docs-writing`), and MUST ship `catalog/skills/devops/SKILL.md` with YAML frontmatter containing exactly two keys: single-line `name` equal to `devops` and single-line, single-quoted `description` of at most 250 characters, starting with `Trigger:`, containing no apostrophes, double quotes or pipes. The skill MUST load and validate under existing catalog rules.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN skill `devops` is available and valid
- AND frontmatter `name` equals the skill directory name
- AND the bundled skill list is `api-design`, `commit-writing`, `devops`, `docs-writing`, `example-skill`, `pr-writing`, `product-owner`, `refactoring`, `socratic-method`, `test-writing`
- AND the bundled skill count is 10
- AND the `devops` entry has `files: ['SKILL.md']`

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `devops`
- WHEN the catalog is loaded
- THEN the skill MUST NOT be selectable
- AND the error MUST name the offending path and reason

#### Scenario: Description contract

- GIVEN `catalog/skills/devops/SKILL.md`
- WHEN its frontmatter is inspected
- THEN `description` is one line, single-quoted, at most 250 characters and starts with `Trigger:`
- AND it contains no apostrophes, double quotes or pipes

### Requirement: Model-invocable and generic

Frontmatter MUST NOT set `disable-model-invocation: true` (the key SHOULD be omitted). The skill MUST be generic and tool-agnostic (usable in any repository, no dependency on a specific CI platform, container runtime, registry or cloud provider; vendor names MAY appear only as illustrative examples) and written in concise English. It MUST NOT hardcode shitaku-specific names, files, tools or conventions, and MUST NOT contain the literal `Co-Authored-By` token.

#### Scenario: Invocable and generic

- GIVEN `catalog/skills/devops/SKILL.md` after the change
- WHEN frontmatter and body are inspected
- THEN `disable-model-invocation` is absent or not `true`
- AND the text does not match `/shitaku/i`
- AND the text does not contain `Co-Authored-By`

### Requirement: Required sections

The skill body MUST contain five sections in this order: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract. Decision Gates MUST be a Condition | Action table and Execution Steps MUST be numbered. The skill SHOULD stay concise (about 90-130 lines) using one-line rules, and MUST NOT contain a bare `---` line in its body.

#### Scenario: Section layout

- GIVEN `catalog/skills/devops/SKILL.md`
- WHEN its headings are inspected
- THEN Activation Contract, Hard Rules, Decision Gates, Execution Steps and Output Contract are present in that order
- AND Decision Gates is a table with Condition and Action columns
- AND Execution Steps is a numbered list

#### Scenario: No bare frontmatter delimiter in body

- GIVEN `catalog/skills/devops/SKILL.md`
- WHEN the lines after the closing frontmatter delimiter are inspected
- THEN no line consists solely of `---`

### Requirement: Repository conventions first

The skill MUST instruct the agent to inspect the repository before writing or reviewing: existing Dockerfiles, compose files, CI workflow files, deploy scripts and runtime versions. Repository conventions MUST take precedence over every skill default, defaults MUST apply only when no convention exists, and the skill MUST include a "Repository conventions first" rule stating this.

#### Scenario: Existing conventions found

- GIVEN the repository has Dockerfiles, CI workflow files and deploy scripts with established patterns
- WHEN the agent follows `devops`
- THEN it adopts those base images, stage layout, caching and deploy conventions
- AND those conventions override conflicting skill defaults

#### Scenario: No conventions detectable

- GIVEN the repository has no container, pipeline or deployment files to infer from
- WHEN the agent follows `devops`
- THEN it falls back to the defaults of the skill (multi-stage, pinned base, non-root user, fail-fast stages, health check, rollback path)

### Requirement: Dockerfile practices

The skill MUST instruct the agent to: order layers for caching (dependency manifests copied and installed before source); use `multi-stage` builds with a minimal runtime stage; pin base images to an explicit version tag (digest when reproducibility matters) and never `latest`; run as a `non-root` user in the runtime stage; provide a `.dockerignore`; and never place secrets in image layers or build args (use build-time secret mounts or runtime injection).

#### Scenario: New Dockerfile from defaults

- GIVEN a request to containerize an application and no existing Dockerfile convention
- WHEN the agent follows `devops`
- THEN the Dockerfile copies and installs dependency manifests before copying source
- AND it uses multi-stage builds with a minimal runtime stage
- AND its base images carry an explicit version tag and not `latest`
- AND the runtime stage runs as a non-root user
- AND a `.dockerignore` is present

#### Scenario: Secret needed at build time

- GIVEN a build step that needs a credential
- WHEN the agent writes the Dockerfile
- THEN it uses a build-time secret mount or runtime injection
- AND the secret is not stored in a layer, build arg or committed file

#### Scenario: Unsafe image pattern reviewed

- GIVEN an existing Dockerfile that uses `latest`, runs as root or bakes a secret into a layer
- WHEN the agent reviews it under `devops`
- THEN each pattern is flagged as unsafe in the decision summary
- AND a fix is proposed unless a repository convention explicitly requires it

### Requirement: CI/CD pipeline practices

The skill MUST instruct the agent to: structure pipelines in clear stages (lint, test, build, deliver, deploy) that fail fast; cache dependencies and build output keyed on lockfiles; use matrix builds only for supported versions or platforms; read secrets from the platform secret store and never echo them; grant `least privilege` tokens and permissions; and pin third-party actions or images.

#### Scenario: New pipeline from defaults

- GIVEN a request to add a pipeline and no existing CI convention
- WHEN the agent follows `devops`
- THEN stages run lint, test, build, deliver, deploy in a fail-fast order
- AND dependency caches are keyed on the lockfile
- AND job permissions are limited to what each job needs
- AND third-party actions or images are pinned

#### Scenario: Matrix scope

- GIVEN a project that supports specific runtime versions or platforms
- WHEN the agent defines a build matrix
- THEN the matrix covers only those supported versions or platforms

#### Scenario: Secret handling

- GIVEN a pipeline step that needs a credential
- WHEN the agent writes the step
- THEN the credential comes from the platform secret store
- AND it is never printed to logs or committed

#### Scenario: Over-privileged pipeline reviewed

- GIVEN an existing pipeline with broad token permissions or unpinned third-party actions
- WHEN the agent reviews it under `devops`
- THEN each is flagged in the decision summary and narrowed or pinned unless a repository convention requires otherwise

### Requirement: Deployment safety

The skill MUST instruct the agent to: define a `health check` (readiness and liveness where the platform supports them); document a `rollback` path to the previous immutable artifact; promote the same artifact across environments; and keep environment parity by supplying configuration through environment variables instead of rebuilding images per environment.

#### Scenario: Deployment step defined

- GIVEN a request to add or review a deployment step
- WHEN the agent follows `devops`
- THEN a health check gates the rollout
- AND a rollback path to the previous immutable artifact is documented
- AND the same built artifact is promoted from one environment to the next

#### Scenario: Per-environment configuration

- GIVEN differing settings between staging and production
- WHEN the agent configures the deployment
- THEN differences are supplied through environment variables
- AND the image is not rebuilt per environment

#### Scenario: Deployment without rollback

- GIVEN an existing deployment with no health check or rollback path
- WHEN the agent reviews it under `devops`
- THEN the gap is flagged in the decision summary and a health check and rollback path are proposed

### Requirement: Decision gates

The Decision Gates table MUST map conditions to actions covering at least: an existing repository convention (follow it), request classification (image, pipeline or deployment), a missing convention (apply the skill default), an unsafe pattern found (flag it and propose the safe alternative), and an out-of-scope request (state the boundary and defer).

#### Scenario: Gates cover classification and unsafe patterns

- GIVEN `catalog/skills/devops/SKILL.md`
- WHEN the Decision Gates table is inspected
- THEN rows exist for existing convention, request classification, missing convention, unsafe pattern and out-of-scope request
- AND every row has a non-empty Action

### Requirement: Output contract

The Output Contract MUST require the agent to report the changed files and a short decision summary (conventions found, defaults applied, unsafe patterns flagged). Any reference example in the skill (such as a single short multi-stage Dockerfile fence) is OPTIONAL, MUST be valid, and MUST pass `pnpm run format:check` and the website catalog generator when present. Tool or standards references MUST be cited only when verified.

#### Scenario: Result reported

- GIVEN the agent finishes writing or reviewing delivery infrastructure
- WHEN it reports the result
- THEN it lists the changed files
- AND it provides a short decision summary of conventions found, defaults applied and unsafe patterns flagged

#### Scenario: Optional example present

- GIVEN `catalog/skills/devops/SKILL.md` contains a code fence
- WHEN `pnpm run format:check` and the website catalog generator run
- THEN both accept it
- AND the fence does not show `latest`, a root runtime user or an embedded secret

### Requirement: Scope limited to container, pipeline and deployment practice (Not for)

The skill MUST state in its Activation Contract (ending with a "Not for ..." sentence) that it is not for Kubernetes manifests, Terraform or other infrastructure-as-code, cloud-provider-specific services, application code, or test authoring (owned by `test-writing`). Existing skills, rules, agents and profiles MUST remain unchanged, and no `devops` agent or profile entry is added.

#### Scenario: Out-of-scope content absent

- GIVEN `catalog/skills/devops/SKILL.md`
- WHEN the Activation Contract is inspected
- THEN a `Not for` statement excludes Kubernetes manifests, infrastructure-as-code and cloud-provider-specific services
- AND it also excludes application code and test authoring

#### Scenario: Existing items unchanged

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN no existing skill, rule, agent or profile file is modified
- AND `catalog/catalog.json` only gains the `devops` skill entry

### Requirement: Content contract guard

`test/adapters/catalog/bundled-catalog.test.ts` MUST assert the exact skill lists (with a renamed registration test title) and count 10, the `devops` entry with `files: ['SKILL.md']`, and a content-contract test via `expectSkillContract` that checks the load-bearing tokens (`Repository conventions first`, `multi-stage`, `.dockerignore`, `non-root`, `least privilege`, `health check`, `rollback`, `Not for`) plus the forbidden `/shitaku/i` and `Co-Authored-By`.

#### Scenario: Guard fails before the skill exists

- GIVEN the test changes are applied without the skill or catalog entry
- WHEN `pnpm test` runs
- THEN the bundled-catalog tests fail (RED)

#### Scenario: Guard passes after the skill is added

- GIVEN the skill and catalog entry are added
- WHEN `pnpm test` runs
- THEN the bundled-catalog and content-contract tests pass (GREEN)

### Requirement: Installable create when absent

When the target is absent, `init --skills devops --dry-run` MUST classify `create` and MUST NOT write files, backups, or manifest. Applied install MUST be byte-identical under existing skills-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target directory for `devops`
- WHEN `init --skills devops --dry-run` runs
- THEN the plan classifies `devops` as `create`
- AND no file, backup, or manifest changes occur

#### Scenario: Byte-identical install under existing skills-install

- GIVEN the bundled `devops` skill and an absent target
- WHEN `init --skills devops` applies successfully
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

- GIVEN `devops` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `devops`

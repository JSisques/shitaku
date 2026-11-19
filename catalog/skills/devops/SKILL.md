---
name: devops
description: 'Trigger: write or review a Dockerfile, CI pipeline, CI/CD workflow, deployment step, rollback plan. Build images, pipelines and deploys: multi-stage, pinned bases, non-root, cached builds, least privilege, health checks, rollbacks.'
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

# Tasks: Add devops Catalog Skill

Strict TDD (`pnpm test`). Spec: `specs/devops-skill/spec.md`. Design: `design.md`.

## Review Workload Forecast

| Field                   | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| Estimated changed lines | ~165-185 (SKILL.md ~125-130, catalog.json ~1, test ~30; docs generated) |
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

| Unit | Goal                                   | Likely PR | Focused test command                                      | Runtime harness                                                    | Rollback boundary                              |
| ---- | -------------------------------------- | --------- | --------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| 1    | Skill, catalog entry and contract test | PR 1      | `pnpm test test/adapters/catalog/bundled-catalog.test.ts` | `node dist/main.js init --skills devops --scope project --dry-run` | Revert commit 1 (SKILL.md, catalog.json, test) |
| 2    | Regenerated README and website pages   | PR 1      | `pnpm run docs:catalog:check`                             | `pnpm run docs:website-catalog:check`                              | Revert commit 2 (generated docs only)          |

## Commit 1: `feat(catalog): add devops skill`

### Phase 0: Pre-flight verification (no commit)

- [ ] 0.1 Verify the design's unconfirmed Dockerfile details against primary sources (docs.docker.com/reference/dockerfile/, Docker Hub official `node` image tag list or github.com/nodejs/docker-node): `RUN --mount=type=secret,id=...,target=...` syntax, `RUN --mount=type=cache,target=...` syntax, that `node:22.13-bookworm-slim` is a published tag, and that the image ships a `node` user (for `USER node` and `--chown=node:node`). If any detail cannot be verified or differs, fall back to `node:22-bookworm-slim` and adjust the fence; keep the digest rule in prose. Mark verification outcome in `design.md` Open Questions (Req: Output contract, "cited only when verified")
- [ ] 0.2 If no fetch tool is available, record that the check was not possible, use the fallback tag `node:22-bookworm-slim`, and note it in the commit body

### Phase 1: RED (test edits only)

- [ ] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, rename the registration test to `ships api-design, commit-writing, devops, docs-writing, example-skill, pr-writing, product-owner, refactoring, socratic-method and test-writing as registered loadable bundled skills` (Req: Bundled registration)
- [ ] 1.2 Insert `'devops'` after `'commit-writing'` in both exact lists (`index.items.skills` and sorted `readdirSync` entries) (Req: Bundled registration)
- [ ] 1.3 Change `expect(catalog.skills).toHaveLength(9)` to `10` (Req: Bundled registration)
- [ ] 1.4 After the `commit-writing` `byName` block add the `byName['devops']` assertions: `toMatchObject({ name: 'devops' })`, description length > 0, `files` equal `['SKILL.md']` (Req: Bundled registration)
- [ ] 1.5 After `keeps the api-design skill content contract` add `keeps the devops skill content contract` using `expectSkillContract('devops', ...)` with the 12 required tokens (`Repository conventions first`, `multi-stage`, `.dockerignore`, `non-root`, `type=secret`, `lockfile`, `least privilege`, `health check`, `rollback`, `same artifact`, `environment parity`, `Not for Kubernetes`) and forbidden `/shitaku/i`, `'Co-Authored-By'`, `':latest'`, `'kubectl'`; then read `catalog/skills/devops/SKILL.md` raw and assert `raw.split(/\r?\n---\r?\n/)` has length 2 (Req: Content contract guard)
- [ ] 1.6 Run `pnpm test`; observe and record RED (list/count failures and ENOENT on missing SKILL.md) (Req: Content contract guard, scenario "Guard fails before the skill exists")

### Phase 2: GREEN (skill + catalog)

- [ ] 2.1 Create `catalog/skills/devops/SKILL.md` from the design outline: two-key frontmatter, 231-char single-quoted `Trigger:` description, five sections in order, `### Images` / `### Pipelines` / `### Deployments` subgroups under Hard Rules, Decision Gates Condition | Action table, numbered Execution Steps, Activation Contract ending with `Not for Kubernetes manifests or Helm charts, Terraform or other infrastructure as code, cloud-provider-specific services, application code, or writing tests.`, one `dockerfile` fence under `### Reference Dockerfile` last in `## Output Contract` (apply the 0.1 outcome for the base tag and mount syntax), ~125-130 lines. No `---` line in the body, no `shitaku`, no `Co-Authored-By`, no `:latest`, no `kubectl`, no `disable-model-invocation` (Reqs: frontmatter, generic, sections, conventions first, Dockerfile practices, CI/CD practices, deployment safety, decision gates, output contract, scope)
- [ ] 2.2 Insert `"devops"` between `"commit-writing"` and `"docs-writing"` in `catalog/catalog.json` `items.skills` (Req: Bundled registration)
- [ ] 2.3 Run `pnpm run format`; accept Prettier output, then re-check the Decision Gates table is aligned and the fence is untouched
- [ ] 2.4 Run `pnpm test`; observe GREEN, including the 250-char description check and the `---` split assertion (Req: Content contract guard, scenario "Guard passes after the skill is added")
- [ ] 2.5 Run `pnpm run typecheck && pnpm run lint && pnpm run format:check`
- [ ] 2.6 Confirm `git diff --stat` shows no `src/`, `CHANGELOG.md`, `.prettierignore`, or existing skill/rule/agent/profile change (Req: Scope limited, Catalog-only surface)
- [ ] 2.7 Commit: `feat(catalog): add devops skill` (SKILL.md, catalog.json, test; design.md update from 0.1). Never use `--no-verify`

## Commit 2: `docs: list devops skill in README and website`

### Phase 3: Generated docs

- [ ] 3.1 Run `pnpm run docs:catalog` (README skills table), then `pnpm run docs:website-catalog` (en and es pages). Do not hand-edit (Req: Catalog-only surface)
- [ ] 3.2 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass
- [ ] 3.3 Run `pnpm run format:check`; if generated files need formatting, run `pnpm run format` and re-run both checks
- [ ] 3.4 Confirm the diff contains only `README.md` and `website/src/content/docs/{en,es}/catalog/skills/devops.md`
- [ ] 3.5 Commit: `docs: list devops skill in README and website`

## Phase 4: Final verification (no commit)

- [ ] 4.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`
- [ ] 4.2 Run `pnpm run build`, then `node dist/main.js init --skills devops --scope project --dry-run`; expect `devops` classified `create` and no files, backups, or manifest written (Req: Installable create when absent)
- [ ] 4.3 Confirm `git status` is clean of stray files from the dry-run and `dist/` is not committed

## Parallelism

Strictly sequential: 0.x verification precedes SKILL.md text, RED precedes GREEN (strict TDD), and generators need the registered skill. Tasks 0.1 and 1.1-1.5 touch independent files and could overlap, but 2.1 depends on both. No parallel tasks planned.

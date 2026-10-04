## Exploration: product-website

Issue: [#52](https://github.com/JSisques/shitaku/issues/52) — feat(website): product website with landing page and documentation  
Related (blocked, out of MVP unless explicitly pulled in): [#78](https://github.com/JSisques/shitaku/issues/78) README website badge.

### Current State

- No `website/` directory, no Astro/Starlight deps, no GitHub Pages workflow.
- Product docs today live primarily in root `README.md` (quickstart, why, catalog tables, full CLI usage, security/custom catalogs, limitations). Maintainer release docs live in `docs/releasing.md` (out of product-site MVP).
- Catalog drift prevention already exists for README only: `scripts/generate-catalog-table.mjs` + `pnpm run docs:catalog` / `docs:catalog:check`, enforced in `.github/workflows/ci.yml`. It regenerates MCP/skill tables from `catalog/` markers; profiles are not included in those tables.
- Catalog shape (`catalog/catalog.json` + `mcps/*.json` + `skills/*/SKILL.md` + `profiles/*.json`) is stable and validated by zod in `src/domain/catalog/schema.ts`. Bundled today: 14 MCPs, 1 skill (`example-skill`), 3 profiles (`base`, `web`, `backend`). Profiles resolve/list but are **not installable by name** yet (CONTRIBUTING). No `agents` catalog kind exists.
- CLI surface is broader than issue MVP wording: `init`, `undo`, `uninstall`, `status`, `list`, `doctor`, `version` (`-v`/`--version`). Exit codes documented in README: 0–4.
- Package layout is a **single root package** (`@jsisques/shitaku`), not a pnpm workspace. `package.json` `files` ships only `dist`, `catalog`, README, LICENSE — website must not be published to npm.
- Release pipeline: `ci.yml` (PR + `workflow_call`) → `cd.yml` (manual `workflow_dispatch` + semantic-release). Specs and tests (`openspec/specs/ci-workflow`, `release-pipeline`, `test/release-config.test.ts`) guard that CD reuses `ci.yml` and stays isolated from push/publish side effects. Website CI must not become a required step of that release path.
- README already reserves a `TODO(website) (#78)` badge slot pointing at #52.
- OpenSpec: change folder is new; main specs cover CLI/catalog/CI/release but have **no website domain** yet.
- Engram: session preflight recorded (`sdd/product-website/session-preflight`); no prior explore/proposal for this change.

### Affected Areas

- `website/` (new) — Astro Starlight app, EN/ES content, build-time catalog page generation, `base: '/shitaku/'` for project Pages URL.
- `.github/workflows/website.yml` (new) — isolated build + GitHub Pages deploy; must not be called from `cd.yml` and must not alter `ci.yml` release gates unless explicitly decided.
- `scripts/` and/or `website/` build hooks — extend or parallel the existing `docs:catalog` generation so catalog pages stay in sync (MCP/skill/profile metadata from `catalog/`).
- Root tool config — `.gitignore` (Astro `dist`/`.astro`), possibly `.prettierignore` / `eslint.config.js` ignores so website deps and generated output do not break root `lint`/`format:check`.
- Root `package.json` / lockfile — only if website deps are hoisted or a workspace is introduced; prefer keeping website install scoped.
- `README.md` — optional link to live site (full badge is #78); no need to duplicate all docs long-term.
- `openspec/specs/` — new `website` (or similar) capability + possible delta notes that website workflow stays outside release CD.
- `CONTRIBUTING.md` — document how catalog edits refresh website pages (alongside `docs:catalog`).
- `test/` — likely new contract tests for website workflow isolation and/or catalog-page generation check (mirroring `docs:catalog:check`); root architecture tests should stay CLI-focused.

### Approaches

1. **Nested `website/` package + dedicated Pages workflow (issue-aligned)** — Add `website/package.json` with Astro + `@astrojs/starlight`, static build with `site`/`base` for `https://jsisques.github.io/shitaku/`, Starlight `locales` for `en` + `es`. Deploy via new workflow (`actions/upload-pages-artifact` + `actions/deploy-pages`), path-filtered or always-on for `website/**` + `catalog/**` changes. Generate catalog docs at build time from `../catalog`.
   - Pros: Matches #52 scope; leaves `ci.yml`/`cd.yml` release contract intact; npm package publish stays clean; clear ownership boundary.
   - Cons: Two package trees / installs; root ESLint/Prettier must ignore or include website intentionally; contributors need a second install path.
   - Effort: Medium (MVP content + generator + CI) to High (full EN/ES parity + polish).

2. **Convert repo to pnpm workspace (`packages/cli` + `website`)** — Hoist tooling, share scripts, filter installs in CI.
   - Pros: Cleaner multi-package DX long-term; shared TypeScript/catalog helpers.
   - Cons: Large invasive move of CLI package layout; high risk to release/CI contracts and review budget; far beyond issue wording.
   - Effort: High.

3. **Fold website build into existing `ci.yml` and deploy from CD** — Single pipeline builds CLI + site.
   - Pros: One CI entrypoint.
   - Cons: Couples docs deploy to release gates; violates acceptance (“website CI does not interfere with release pipeline”) and existing OpenSpec CD requirements; Pages permissions would expand release job surface.
   - Effort: Medium, but **rejected** on isolation grounds.

**Catalog page generation (within approach 1):**

| Option                                                                              | Pros                                     | Cons                                                  | Effort     |
| ----------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- | ---------- |
| A. Build-time reader (Astro integration / content layer reads `catalog/`)           | Single source; no committed generated MD | Harder to diff translations; more Astro-specific code | Medium     |
| B. Prebuild emitter writing MD/MDX into `website/src/content` (like `docs:catalog`) | Easy CI `--check`; familiar pattern      | Generated files or check-only discipline needed       | Low–Medium |
| C. Shared Node module used by README table script + website emitter                 | One parser for MCP/skill frontmatter     | Touches existing README generator                     | Medium     |

### Recommendation

**Approach 1 + generation option B (or B+C):** scaffold Astro Starlight under `website/` as its own package; configure `base: '/shitaku/'` and Starlight i18n (`en` default, `es` second locale); add an isolated `.github/workflows/website.yml` for Pages that never participates in `cd.yml`; emit catalog MCP/skill/profile pages from `catalog/` at build (extend the existing `docs:catalog` mindset with a check mode). Keep root `ci.yml` focused on the CLI package; optionally add a lightweight path or ignore strategy so website noise does not break release CI.

Cognitive-doc shape for MVP: landing leads with what + one `npx` happy path; deeper CLI/catalog/security via progressive disclosure; recognition over recall (tables for catalog, flag/exit-code reference).

Delivery (`ask-on-risk`): expect **>400 authored lines** → propose/tasks should forecast chained PRs (e.g. scaffold+CI → content EN → ES/i18n → catalog generator).

### Risks

- **Release coupling**: accidentally wiring Pages deploy into `ci.yml`/`cd.yml` or required checks that block semantic-release.
- **Subpath deploy**: wrong `base`/`site` breaks all asset/links on `jsisques.github.io/shitaku`.
- **i18n drift**: Spanish pages lag English; catalog item descriptions are English-only in source — translating every MCP description vs translating chrome only is a product decision.
- **CLI docs accuracy**: issue MVP lists only `init`/`undo`, but product CLI already has more commands; under-documenting confuses users, over-scoping delays MVP.
- **Tooling blast radius**: root `eslint .` / `prettier --check .` will see `website/` unless ignored or configured; lockfile/workspace changes can fail frozen installs.
- **Review budget**: Starlight scaffold + dual-language content + CI + generator likely exceeds 400-line PR budget under `ask-on-risk`.
- **Profiles/agents honesty**: documenting profiles as installable or agents as present would be false; agents explicitly deferred by issue.
- **Secrets in generated docs**: catalog pages must show `${VAR}` placeholders and env **names**, never invent literal secrets (catalog already enforces placeholders).

### Open questions for propose (confirm before design)

1. **CLI reference scope**: stick to issue MVP (`init`, `undo`, flags, exit codes) or document the full current CLI (`list`, `status`, `doctor`, `uninstall`, `version`) in MVP?
2. **Catalog i18n**: Spanish UI/navigation only with English catalog descriptions, or translated descriptions (and who maintains them)?
3. **Default locale URL shape**: English as Starlight `root` (`/`) vs prefixed `/en/` with `/es/`?
4. **Package strategy**: confirm nested `website/package.json` (recommended) vs introducing a pnpm workspace now.
5. **Root CI vs website CI**: should website-only PRs still run full CLI `ci.yml` (current “docs-only still runs” policy), and should root CI gain a `website:build` check or stay fully separate?
6. **Profiles pages**: include as browse-only catalog docs with “not installable yet” callout?
7. **README badge (#78)**: keep out of this change, or ship a minimal docs link once Pages is live?
8. **Chained delivery**: accept stacked PRs for scaffold/CI → content → i18n/generator under `ask-on-risk`?

### Ready for Proposal

Yes — scope is clear enough to propose. Orchestrator should run `sdd-propose` for `product-website`, surface the open questions above (especially CLI scope, catalog i18n, and CI isolation), and keep implementation out of explore.

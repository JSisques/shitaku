# Design: Product Website

## Technical Approach

Nested Astro Starlight under `website/` for GitHub Pages (`base: '/shitaku/'`), locales `/en/` + `/es/`. Catalog MCP/skill/profile pages emitted as Markdown by a root Node script (option B, like `docs:catalog`), then built by Starlight. Deploy only via `.github/workflows/website.yml`. Hexagonal `src/` untouched; root `ci.yml`/`cd.yml` stay release-only.

Docs (cognitive-doc): landing = brand + one `npx` path; CLI/catalog/security via progressive disclosure and tables.

## Architecture Decisions

| Decision     | Options                                    | Tradeoff                                                             | Choice                                          |
| ------------ | ------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------- |
| Package      | Nested `website/package.json` vs workspace | Nested: second install, zero CLI churn. Workspace: high release risk | **Nested** (not in root `files`)                |
| Pages URL    | `base: '/shitaku/'` vs host root           | Wrong base breaks all assets                                         | **`site` + `base: '/shitaku/'`**                |
| i18n URLs    | `/`+`/es/` vs `/en/`+`/es/`                | Prefixed is explicit                                                 | **Prefixed `/en/` + `/es/`**                    |
| Catalog copy | Translate vs EN source                     | Translation drifts                                                   | **ES chrome only; copy from `catalog/`**        |
| Catalog gen  | A reader / **B emitter** / C shared        | B matches `docs:catalog` + `--check`                                 | **B**: `scripts/generate-website-catalog.mjs`   |
| CI           | Fold into release CI vs isolated           | Coupling blocks acceptance                                           | **`website.yml` only**; no root `website:build` |
| Profiles     | Omit vs browse-only                        | Honesty                                                              | **Browse-only + not-installable callout**       |
| Hexagonal    | Import `@/` vs file read                   | Must stay outside CLI layers                                         | **Outside `src/`**; emitter reads `catalog/`    |

## Data Flow

```
catalog/ → generate-website-catalog.mjs → website/src/content/**/catalog/*.md
website/ (Starlight) → build → website/dist → website.yml → Pages /shitaku/{en,es}/...
```

`ci.yml`: CLI lint/test/build/smoke. `cd.yml`: calls `ci.yml` → semantic-release. Neither references `website.yml`.

## File Changes

| File                                                 | Action | Description                                                 |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `website/` (package, lock, Astro/Starlight, content) | Create | Nested site; `base`/`locales`; EN+ES docs                   |
| `website/.gitignore`                                 | Create | `dist/`, `.astro/`, `node_modules/`                         |
| `.github/workflows/website.yml`                      | Create | Install website + emit + build + Pages; path filters OK     |
| `scripts/generate-website-catalog.mjs`               | Create | Emit/check catalog pages (incl. profiles callout)           |
| `package.json`                                       | Modify | `docs:website-catalog` / `:check` only (no Astro deps)      |
| `.gitignore`, `.prettierignore`, `eslint.config.js`  | Modify | Ignore website build artifacts; keep root gates green       |
| `test/release-config.test.ts` (+ sibling if needed)  | Modify | Isolation + `--check` drift contracts                       |
| `CONTRIBUTING.md` / `README.md`                      | Modify | Catalog refresh note; optional site link (**no #78 badge**) |
| `src/**`                                             | None   | CLI unchanged                                               |

## Interfaces / Contracts

- Emitter: write mode; `--check` non-zero on drift. Sources: `catalog.json` + mcps/skills/profiles. Secrets: `${VAR}` names only.
- Starlight: `en`+`es`, both prefixed; Spanish chrome/nav only.
- Isolation: `cd.yml` MUST NOT use website workflow; `ci.yml` MUST NOT Astro-build or Pages-deploy.
- Publish: root `files` unchanged — website never packed.

## Testing Strategy

| Layer       | What                           | Approach                                           |
| ----------- | ------------------------------ | -------------------------------------------------- |
| Contract    | Emitter `--check` drift        | Script exit-code / Vitest vs committed output      |
| Integration | Workflow isolation             | Extend `release-config.test.ts`                    |
| Tooling     | Root ignores website artifacts | Same pattern as CHANGELOG ignore tests             |
| E2E         | Pages                          | `website.yml` build smoke only (no Playwright MVP) |

## Threat Matrix

N/A — static Pages workflow + MD emitter; no CLI routing, subprocess, git/PR argv, or executable-file classification boundaries. Isolation covered by release-config contracts, not threat-matrix RED rows.

## Stacked PR Slices (`stacked-to-main`)

| PR  | Unit                                                                 | Done when                                        |
| --- | -------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Scaffold + ignores + `website.yml`                                   | Local build; Pages workflow green; root CI green |
| 2   | EN landing + full CLI + security                                     | EN docs complete                                 |
| 3   | ES chrome/nav + locale routes                                        | `/en/`+`/es/`; catalog copy still EN             |
| 4   | Emitter/check, profiles callout, CONTRIBUTING + optional README link | Drift check + isolation tests pass               |

Authored ≤~400 lines per PR or `size:exception`.

## Migration / Rollout

No migration. Enable Pages (Actions) after PR1. Rollback: remove `website/`, `website.yml`, emitter/tests, ignore/doc edits.

## Open Questions

- [x] Generated MD: **commit + `--check`** (matches README tables).
- [ ] Exact `website.yml` path filters — finalize in tasks.

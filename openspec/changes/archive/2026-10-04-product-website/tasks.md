# Tasks: Product Website

## Review Workload Forecast

| Field                   | Value                                        |
| ----------------------- | -------------------------------------------- |
| Estimated changed lines | 900–1400 authored (excl. generated MD)       |
| 400-line budget risk    | High                                         |
| Chained PRs recommended | Yes                                          |
| Suggested split         | PR1 scaffold → PR2 EN → PR3 ES → PR4 emitter |
| Delivery strategy       | ask-on-risk                                  |
| Chain strategy          | stacked-to-main                              |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                               | Likely PR | Focused test command                                            | Runtime harness                          | Rollback boundary                              |
| ---- | ---------------------------------- | --------- | --------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| 1    | Scaffold + ignores + `website.yml` | PR1→main  | `pnpm test -- test/tooling.test.ts test/release-config.test.ts` | `cd website && pnpm i && pnpm run build` | Remove `website/`, `website.yml`, ignore edits |
| 2    | EN landing + CLI + security        | PR2→main  | N/A (content; build smoke)                                      | `cd website && pnpm run build`           | Revert `website/src/content/docs/en/`          |
| 3    | ES chrome + `/en/`+`/es/`          | PR3→main  | N/A (i18n; build smoke)                                         | `cd website && pnpm run build`           | Revert i18n + ES chrome                        |
| 4    | Emitter/check + profiles + docs    | PR4→main  | `pnpm test -- test/release-config.test.ts`                      | `pnpm run docs:website-catalog:check`    | Remove emitter, generated MD, doc links        |

## Phase 1: Scaffold + ignores + website.yml (PR1)

- [x] 1.1 RED `test/tooling.test.ts`: root ignores `website/dist/`, `website/.astro/`, `website/node_modules/`
- [x] 1.2 GREEN `.gitignore`, `.prettierignore`, `eslint.config.js` so root lint/format stay green
- [x] 1.3 Create nested `website/package.json` (Starlight; not workspace) + `website/.gitignore`
- [x] 1.4 `website/astro.config.*`: `base: '/shitaku/'` + prefixed `en`/`es` stubs
- [x] 1.5 Create `.github/workflows/website.yml` path filters: `website/**`, `catalog/**`, `scripts/generate-website-catalog.mjs`, `.github/workflows/website.yml`; build+Pages only
- [x] 1.6 RED→GREEN `test/release-config.test.ts`: `website.yml` exists; `ci.yml`/`cd.yml` (read-only) unused; root `files` excludes `website/`
- [x] 1.7 Verify root focused tests + `cd website && pnpm i && pnpm run build`

## Phase 2: EN landing + CLI + security (PR2)

- [x] 2.1 EN landing in `website/src/content/docs/en/`: brand + one `npx` path
- [x] 2.2 EN CLI docs: `init`/`undo`/`uninstall`/`status`/`list`/`doctor`/`version`, flags, exit codes
- [x] 2.3 EN security page; no agents/releasing pages
- [x] 2.4 Wire EN sidebar; `cd website && pnpm run build`

## Phase 3: ES chrome + locales (PR3)

- [x] 3.1 i18n URLs only `/shitaku/en/...` and `/shitaku/es/...` (no unprefixed EN)
- [x] 3.2 Spanish chrome/nav for `/es/`; catalog copy stays English
- [x] 3.3 ES doc shells mirroring EN nav
- [x] 3.4 Verify both locale trees under `/shitaku/`

## Phase 4: Emitter, profiles, docs (PR4)

- [x] 4.1 RED `test/release-config.test.ts`: `docs:website-catalog:check` fails on drift vs committed catalog MD
- [x] 4.2 GREEN `scripts/generate-website-catalog.mjs` + `package.json` scripts `docs:website-catalog` and `:check`; emit from `catalog/` (read-only); `${VAR}` only
- [x] 4.3 Profiles not-installable callout; commit generated MD; `--check` clean
- [x] 4.4 `website.yml` runs emit before Astro build; keep 1.6 isolation green
- [x] 4.5 `CONTRIBUTING.md` refresh note; optional `README.md` site link; no #78; no `src/**`
- [x] 4.6 Verify focused tests + `docs:website-catalog:check` + root gates + website build

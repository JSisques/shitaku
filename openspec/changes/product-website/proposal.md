# Proposal: Product Website

## Intent

Public shitaku site (#52): landing + docs on GitHub Pages so users can use the CLI beyond README, without touching release CI/CD.

## Scope

### In Scope

- Nested Starlight: `website/package.json` (no workspace)
- Landing + docs: getting started, full CLI (`init`/`undo`/`uninstall`/`status`/`list`/`doctor`/`version`, flags, exit codes), security
- Prefixed `/en/`+`/es/`; Spanish chrome only; catalog descriptions English from `catalog/`
- Catalog pages via emitter (`docs:catalog`+check); profiles **not installable**
- Isolated `website.yml` only (not `ci.yml`/`cd.yml`); root ignores; optional README link (no #78); tests; CONTRIBUTING note

### Out of Scope

Agents; installable profiles; releasing docs; workspace; npm `files`; #78 badge; root `website:build`; Spanish catalog copy

## Capabilities

### New Capabilities

- `website`: Starlight landing/docs, EN/ES chrome, catalog pages, Pages deploy, release-CI isolation

### Modified Capabilities

- `ci-workflow`: `ci.yml` MUST NOT add website build/deploy gate
- `release-pipeline`: `cd.yml` MUST NOT call/depend on website Pages

## Approach

Exploration #1 + emitter B: Starlight in `website/`; `base: '/shitaku/'`; emit catalog MD pre-build; deploy via `website.yml` only. Docs: happy path first; tables for catalog/flags/codes.

**Delivery** (`ask-on-risk`, `stacked-to-main`): High 400-line risk. Stacked PRs: (1) scaffold + ignores + `website.yml`; (2) EN landing + CLI/security; (3) ES chrome + locales; (4) catalog emitter/check + profiles callout + CONTRIBUTING/README link.

## Affected Areas

| Area                             | Impact   | Description                             |
| -------------------------------- | -------- | --------------------------------------- |
| `website/`                       | New      | Starlight app + generated catalog pages |
| `.github/workflows/website.yml`  | New      | Isolated Pages workflow                 |
| `scripts/`                       | Modified | Catalog emitter/check                   |
| Root ignores / eslint / prettier | Modified | Keep CLI gates clean                    |
| `README.md` / `CONTRIBUTING.md`  | Modified | Optional link; contributor note         |
| `test/`                          | Modified | Isolation/generation contracts          |
| Hexagonal `src/`                 | None     | Outside CLI layers                      |

## Risks

| Risk                 | Likelihood | Mitigation                                       |
| -------------------- | ---------- | ------------------------------------------------ |
| Release CI coupling  | Med        | Spec + tests forbid website in `ci.yml`/`cd.yml` |
| Wrong Pages `base`   | Med        | Subpath config + deploy smoke                    |
| i18n drift           | Med        | ES chrome only; descriptions from source         |
| Tooling blast radius | Med        | Nested package + ignores                         |
| Review budget        | High       | Stacked PR slices above                          |

## Rollback Plan

Remove `website/`, `website.yml`, emitter scripts/tests, and doc/ignore edits. CLI publish and release workflows unchanged by design.

## Dependencies

GitHub Pages + Actions pages perms; Astro/Starlight in nested package; `catalog/` + `docs:catalog` as source.

## Success Criteria

- [ ] Site at `/shitaku/` with `/en/` and `/es/`
- [ ] Full CLI docs; landing one-command path
- [ ] Catalog sync/check; profiles not-installable
- [ ] `website.yml` unused by `ci.yml`/`cd.yml`; CLI CI green
- [ ] Stacked PRs ≤~400 authored lines (or `size:exception`)

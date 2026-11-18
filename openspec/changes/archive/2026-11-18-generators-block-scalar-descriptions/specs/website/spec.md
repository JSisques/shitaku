# Delta for Website

## MODIFIED Requirements

### Requirement: Catalog emitter and profiles

MCP/skill/script/command/profile pages MUST emit from `catalog/` with check mode that fails on drift. Profiles MUST be browse-only with explicit not-installable callout. Pages MUST show placeholders/env names only, never invented secrets. Item descriptions MUST be decoded through the domain frontmatter reader, so block-scalar (`|`, `>`) descriptions render as decoded single-line text on `/en/` and `/es/` pages.
(Previously: MCP/skill/script/command/profile pages only, with no statement on block-scalar descriptions)

#### Scenario: Drift and profiles

- GIVEN source drift or a profile page
- WHEN check runs / page is read
- THEN check fails on drift and profile shows not-installable callout

#### Scenario: Block-scalar description

- GIVEN an agent or rule whose frontmatter uses `description: |` or `description: >`
- WHEN the emitter runs
- THEN en and es pages show the decoded single-line text, never a literal `|` or `>`

### Requirement: Isolated website workflow and root gates

Build/deploy MUST use only `.github/workflows/website.yml`. MUST NOT add root `website:build` gate. Root lint/format/typecheck/test/build MUST stay green via ignores/config without website as release dependency. CONTRIBUTING MUST note catalog→website refresh. README MAY link live site. MUST NOT ship #78 badge. `src/` MUST NOT change for this capability. The workflow `push` and `pull_request` `paths` filters MUST also include `src/domain/catalog/frontmatter.ts` and `scripts/lib/**`, so the emitter's dependencies trigger the workflow.
(Previously: no paths filter requirement for the domain reader and scripts lib)

#### Scenario: Isolation and docs

- GIVEN workflows, root gates, and docs
- WHEN inspected
- THEN website.yml owns Pages; `ci.yml`/`cd.yml` unused for it; CLI gates pass; CONTRIBUTING has refresh note; no #78 badge; no `src/` website changes

#### Scenario: Path filter covers emitter dependencies

- GIVEN `.github/workflows/website.yml`
- WHEN the `push` and `pull_request` `paths` lists are read
- THEN both include `src/domain/catalog/frontmatter.ts` and `scripts/lib/**`

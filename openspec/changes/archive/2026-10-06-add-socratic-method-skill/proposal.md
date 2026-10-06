# Proposal: Add socratic-method Catalog Skill

## Intent

Add a bundled **socratic-method** skill (#182) so agents question assumptions before implementing or rewriting work. Must be model-invocable for later #183 preload; install-time tone stays deferred.

## Scope

### In Scope

- `catalog/skills/socratic-method/SKILL.md` — English LLM-first; fixed question-first coaching tone
- Register in `catalog/catalog.json` → `items.skills`
- Update `test/adapters/catalog/bundled-catalog.test.ts`
- Regen docs: `docs:catalog`, `docs:website-catalog`

### Out of Scope

- Install-time tone (devil's advocate ↔ coach) — deferred ([comment](https://github.com/JSisques/shitaku/issues/182#issuecomment-6013152613))
- Dual tone variants; skill templating / `${VAR}` on skills; profile options; product tone UX
- #183 consumer; any `src/` hexagonal / MCP / profile-install changes

## Capabilities

Catalog-bundled skill content and installability acceptance. Product install/list/validate behavior stays under existing `catalog` + `skills-install` (no deltas there).

### New Capabilities

- `socratic-method-skill`: catalog-bundled Socratic method skill content and installability acceptance (single skill, fixed coaching tone, model-invocable).

### Modified Capabilities

None

## Approach

CONTRIBUTING “Add a skill” + `example-skill`: frontmatter `name` = dir, single-line trigger-rich `description`. Body: Activation / Hard Rules / Decision Gates / Execution Steps — generic Socratic method; challenge gaps without rewriting artifacts; omit `disable-model-invocation` (never `true`). Install stays byte-identical. Delivery (apply later): `auto-chain` / stacked-to-main; expect one PR under 400-line budget.

## Affected Areas

| Area                                            | Impact   | Description         |
| ----------------------------------------------- | -------- | ------------------- |
| `catalog/skills/socratic-method/SKILL.md`       | New      | Skill + frontmatter |
| `catalog/catalog.json`                          | Modified | Add skill name      |
| `test/adapters/catalog/bundled-catalog.test.ts` | Modified | Bundled list/count  |
| `README.md`, `website/.../catalog/`             | Modified | Docs regen          |
| `src/` layers                                   | None     | Catalog data only   |

## Risks

| Risk                                         | Likelihood | Mitigation                                      |
| -------------------------------------------- | ---------- | ----------------------------------------------- |
| Frontmatter/website parse fail               | Low        | Single-line; ≤250 chars; mirror `example-skill` |
| Docs CI drift                                | Med        | Run both docs scripts + `:check`                |
| Tone AC vs deferred install choice           | Low        | Fixed coaching tone; deferral on #182           |
| `disable-model-invocation: true` blocks #183 | Low        | Omit the key                                    |

## Rollback Plan

Revert skill dir, `catalog.json`, test, and regen docs. No `src/`/manifest migration. Installed copies: `undo` or delete target skill dir.

## Dependencies

- #182 decisions; shipped skills-install (#15). #183 not a blocker.

## Success Criteria

- [ ] Bundled load + `init --skills socratic-method --dry-run` → `create`
- [ ] Bundled-catalog test + docs `:check` pass
- [ ] No `disable-model-invocation: true`; coaching tone fixed in SKILL.md
- [ ] No `src/` or install-time tone/templating changes

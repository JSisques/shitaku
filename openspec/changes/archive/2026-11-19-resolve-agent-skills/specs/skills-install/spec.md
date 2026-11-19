# Delta for Skills Install

## ADDED Requirements

### Requirement: Skills required by agents

A skill plan entry MAY originate from an agent requirement (see `agents-install`, "Declared skill resolution"). Such an entry MUST carry a reason naming every requiring agent (for example `required by agent docs-writer`) and MUST be shown in the plan, including `--dry-run`. An explicitly selected skill that is also required MUST keep its explicit-selection reason. Entries from agent requirements MUST follow exactly the same rules as explicit ones: scope targets, per-skill classification (create, skip, update, conflict), conflict handling and `--force` replace, backup, journaling, stale-file protection, and `undo`. Requirement-derived and explicit entries MUST NOT be distinguishable in the manifest. A skill missing from the catalog MUST NOT be an error when it is only declared by an agent (see `agents-install`).

#### Scenario: Reason shown in the plan

- GIVEN a skill `s` planned only because agent `a` declares it
- WHEN the plan is printed
- THEN the entry for `s` shows the action and the reason `required by agent a`

#### Scenario: Same classification rules

- GIVEN an auto-added skill whose target is identical, owned and unmodified with a changed catalog, or different and unowned
- WHEN planned
- THEN it is classified `skip`, `update` and `conflict` respectively, as for an explicit skill

#### Scenario: Force replace of an auto-added skill

- GIVEN an auto-added skill whose target conflicts and `--force`
- WHEN init applies
- THEN the old directory is backed up, replaced as a whole, and restorable by `undo`

#### Scenario: Unknown explicit skill still fails

- GIVEN `--skills ghost` and `ghost` is not in the catalog
- WHEN init runs
- THEN it exits non-zero naming `ghost` and writes nothing, regardless of any agent declarations

#### Scenario: Manifest shape unchanged

- GIVEN an install that auto-added a skill
- WHEN the manifest is read
- THEN the skill item has the same fields as an explicitly selected one

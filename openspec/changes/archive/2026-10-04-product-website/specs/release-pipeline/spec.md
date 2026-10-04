# Delta for Release Pipeline

## ADDED Requirements

### Requirement: Website Pages excluded from CD

`cd.yml` MUST NOT call/reuse/depend on `website.yml` or Pages deploy. Release success MUST NOT require website deploy.

#### Scenario: No website dependency

- GIVEN `cd.yml`
- WHEN jobs/`uses`/`needs` inspected
- THEN no `website.yml` call or Pages wait

#### Scenario: Release without Pages

- GIVEN CD on `main`, `dry_run` false
- WHEN release succeeds
- THEN success does not require Pages deploy

# Delta for CI Workflow

## ADDED Requirements

### Requirement: Website excluded from CI gates

`ci.yml` MUST NOT add website build, website install, or Pages deploy as a gate. Existing ordered gates MUST stay unchanged by website work.

#### Scenario: No website step

- GIVEN `ci.yml`
- WHEN steps are inspected
- THEN no website build/install/Pages deploy step exists

#### Scenario: Website-only PR still runs CI

- GIVEN PR changing only `website/`
- WHEN targeting `main`
- THEN `ci` still runs CLI gates (no path-skip)

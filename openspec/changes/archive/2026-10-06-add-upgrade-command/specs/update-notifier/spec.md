# Delta for Update Notifier

## MODIFIED Requirements

### Requirement: Version reporting skips update check

`version`, `-v`, `--version`, and `upgrade` MUST NOT run the update check (no cache, fetch, or notifier stderr), even with update deps wired and no env skip. Other commands MUST keep existing notifier behavior. Notice wording MUST NOT change here.
(Previously: Only version entry points skipped; `upgrade` was not listed.)

#### Scenario: Version entry points skip notifier

- GIVEN update deps wired, newer cached, interactive, no env skip
- WHEN `shitaku version`, `-v`, or `--version` runs
- THEN no update-check I/O and no notifier line

#### Scenario: Upgrade skips notifier

- GIVEN same conditions as version skip
- WHEN `shitaku upgrade` runs
- THEN no update-check I/O and no notifier line

#### Scenario: Other commands still notify

- GIVEN update deps wired, newer available, interactive, no skip
- WHEN `status` runs
- THEN existing update-notifier behavior still applies

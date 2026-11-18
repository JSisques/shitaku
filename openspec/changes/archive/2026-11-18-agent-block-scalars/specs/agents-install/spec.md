# Delta for Agents Install

## ADDED Requirements

### Requirement: Block-scalar agents install verbatim

An agent whose `name` or `description` is written as a YAML block scalar MUST install with bytes identical to the catalog file, and MUST be offered in selection with a single-line description. Install, plan, manifest hashing, and undo behavior MUST be identical to any other agent.

#### Scenario: Block-scalar agent installs with identical bytes

- GIVEN a catalog agent `reviewer` with `description: >` followed by indented lines, and `--agents reviewer --yes`
- WHEN init runs
- THEN the installed file bytes equal the catalog file bytes, including the block-scalar syntax

#### Scenario: Single-line description in selection

- GIVEN the same agent and an interactive init
- WHEN the agent selection prompt is shown
- THEN the description offered for `reviewer` is one line with no newlines and no repeated whitespace

#### Scenario: Re-run is idempotent

- GIVEN the block-scalar agent is already installed unchanged
- WHEN init runs again
- THEN it is classified as skip identical, as for any other agent

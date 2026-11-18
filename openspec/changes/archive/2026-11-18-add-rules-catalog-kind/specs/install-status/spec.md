# Delta for Install Status

## ADDED Requirements

### Requirement: Doctor findings for rules

`doctor` MUST report an owned rule whose file is absent as a finding with code `rule-missing`, naming the rule and its path. A present rule (modified or not) MUST NOT produce `rule-missing`. `doctor` MUST NOT write.

#### Scenario: Rule removed

- GIVEN owned rule `no-secrets` whose file was deleted
- WHEN `doctor` runs
- THEN it reports `no-secrets` as `rule-missing` and writes nothing

#### Scenario: Healthy rule

- GIVEN owned `no-secrets` present on disk
- WHEN `doctor` runs
- THEN no finding is reported for `no-secrets`

## MODIFIED Requirements

### Requirement: Manifest-driven read-only report

`status` MUST list only items recorded by installs with `undoneAt === null`. It MUST NOT write to configs, settings files, skill, script, command, agent, or rule files, backups, or the manifest. Each item MUST carry `kind` (`mcp`, `skill`, `script`, `command`, `hook`, `agent`, or `rule`; the model MUST allow further kinds), `name`, `scope`, `state`, `path`, and `installId`. Items MUST be keyed by scope, path, and name. Text output MUST group items by scope, then by kind. A rule's `path` MUST be its file path.
(Previously: kinds were mcp|skill|script|command|hook|agent)

#### Scenario: Active rule listed

- GIVEN one active install with rule `no-secrets`
- WHEN `shitaku status` runs
- THEN `no-secrets` is listed with kind `rule`, scope, state, and path

#### Scenario: Same name in two scopes

- GIVEN rule `no-secrets` installed in project and user scope
- WHEN `status` runs
- THEN two distinct `no-secrets` items are listed, one per scope

#### Scenario: Agent and rule with same name

- GIVEN agent `x` and rule `x` are both owned
- WHEN `status` runs
- THEN both are listed, each with its own kind and path

### Requirement: Item states

The state table and ordering are unchanged, extended so that an agent or rule file counts under `missing` when absent, and the hash used for agents and rules is the file-bytes hash (as for commands). A user edit to a rule file MUST yield `modified`; `modified` MUST win over `out-of-date`.
(Previously: no rule file state)

#### Scenario: Installed rule

- GIVEN disk, manifest, and catalog hashes equal for `no-secrets`
- WHEN `status` runs
- THEN `no-secrets` is `installed`

#### Scenario: Modified rule

- GIVEN the user edited `no-secrets.md` and the catalog also changed
- WHEN `status` runs
- THEN `no-secrets` is `modified`

#### Scenario: Out of date rule

- GIVEN `no-secrets.md` is untouched and the catalog bytes differ
- WHEN `status` runs
- THEN `no-secrets` is `out-of-date`

#### Scenario: Missing rule and missing from catalog

- GIVEN `no-secrets.md` was deleted and rule `old` was removed from the catalog
- WHEN `status` runs
- THEN `no-secrets` is `missing` and `old` is `missing-from-catalog`

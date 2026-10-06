# Research: catalog-dead-code-script (knip JSON kinds)

```yaml
schema: gentle-ai.sdd-research/v1
change: catalog-dead-code-script
revision: 1
outcome: done
accessed_date: 2026-10-06
```

## Question

Does knip `--reporter json` emit a distinct `devDependencies` / `unusedDevDependencies` key, or must the dead-code script split unused production vs dev deps itself?

## Sources

| ID  | Source                                                                 | Accessed   |
| --- | ---------------------------------------------------------------------- | ---------- |
| S1  | https://knip.dev/reference/issue-types (context7 `/websites/knip_dev`) | 2026-10-06 |
| S2  | https://knip.dev/features/reporters (context7 sample JSON)             | 2026-10-06 |

## Findings

1. **Shared reporter key.** Unused dependencies and unused devDependencies both map to JSON key `dependencies`. There is no separate `devDependencies` key in the reporter output. (S1 table: "Unused devDependencies" → Key `dependencies`²)
2. **Footnote ².** CLI include/exclude of `dependencies` also includes/excludes `devDependencies` and `optionalPeerDependencies`. Rules config may set those keys individually for enablement, but the JSON reporter still uses `dependencies` for the finding arrays. (S1 notes)
3. **Sample shape.** Reporter emits `{ issues: [{ file, files?, exports?, types?, dependencies?, unlisted?, … }] }` with per-item `{ name, line?, col?, pos? }`. (S2)
4. **`unlisted` is distinct.** Unlisted dependencies use key `unlisted`, not `dependencies`. (S1, S2)
5. **Production mode.** `--production` / `--strict` omits devDependencies from consideration; default mode reports both under `dependencies`. (S1 note 3; production-mode docs)

## Mapping into envelope buckets

| Envelope kind (`findings.*`) | Knip JSON source                                                                                                 | Script action               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `files`                      | `issues[].files`                                                                                                 | Flatten `{ file, name, … }` |
| `exports`                    | `issues[].exports`                                                                                               | Flatten                     |
| `types`                      | `issues[].types`                                                                                                 | Flatten                     |
| `dependencies`               | `issues[].dependencies` where `name` ∈ `package.json#dependencies` (or peer/optional treated as prod per design) | Classify via package.json   |
| `devDependencies`            | same `issues[].dependencies` where `name` ∈ `package.json#devDependencies`                                       | Classify via package.json   |
| `unlisted`                   | `issues[].unlisted`                                                                                              | Flatten                     |

Always emit all six keys (empty arrays OK). Names not found in either section: design may place in `dependencies` or drop; prefer document in design (default: `dependencies` if ambiguous).

## Claim

**Confirmed:** knip does **not** emit `devDependencies` in JSON. Envelope `devDependencies` requires post-processing against consumer `package.json`.

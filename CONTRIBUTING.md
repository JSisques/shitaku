# Contributing to shitaku

Thanks for helping. This guide covers local setup, adding catalog items (MCPs, skills, scripts, slash commands, hooks, agents, rules, profiles), commit conventions and what a pull request needs to pass.

## Local setup

Requirements: Node `>=22.18` (`engines`; `.nvmrc` pins 22.23.3, which CI uses, and `nvm use` reads it) and pnpm. The pnpm version is pinned in the `packageManager` field of `package.json`. Run `corepack enable` once so it is used automatically (Node 25+ no longer bundles Corepack: run `npm i -g corepack` first). Without Corepack, `npm i -g pnpm@10` also works. `npm install` is not supported for development.

```sh
pnpm install
```

| Command                  | What it does                                       |
| ------------------------ | -------------------------------------------------- |
| `pnpm run typecheck`     | Type-check without emitting                        |
| `pnpm run lint`          | ESLint (typescript-eslint, type-aware)             |
| `pnpm run lint:fix`      | ESLint with autofixes                              |
| `pnpm test`              | Run all tests (Vitest)                             |
| `pnpm run test:changed`  | Only tests affected vs `origin/main`               |
| `pnpm run test:coverage` | Run tests with coverage (minimum 80%)              |
| `pnpm run build`         | Compile to `dist/` and check the path aliases      |
| `pnpm run format`        | Rewrite files with Prettier                        |
| `pnpm run format:check`  | Fail if any file is not formatted                  |
| `pnpm run smoke:pack`    | Pack and install the package like a consumer would |

Run the built CLI with `node dist/main.js init --dry-run ...` (after `pnpm run build`). Tests never touch your real home directory; see `test/setup.ts`.

### Git hooks

`pnpm install` installs Husky hooks:

| Hook         | Runs                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| `pre-commit` | ESLint then Prettier on staged `ts`/`mjs`/`js` files, Prettier on the rest (lint-staged) |
| `commit-msg` | commitlint with Conventional Commits                                                     |
| `pre-push`   | `pnpm run typecheck`, `pnpm run test:changed`, `pnpm run build`                          |

Bypass with `git commit --no-verify`, `git push --no-verify` or `HUSKY=0`. CI runs the same checks, so bypassing only delays the failure.

## Adding to the catalog

The catalog lives in `catalog/`:

```
catalog/
  catalog.json        index: lists every item by name
  mcps/<name>.json
  profiles/<name>.json
  skills/<name>/SKILL.md
  scripts/<name>/index.mjs
  scripts/<name>/script.json
  commands/<name>.md
  hooks/<name>.json
  agents/<name>.md
  rules/<name>.md
```

Every item must be listed in `catalog/catalog.json` under `items.mcps`, `items.profiles`, `items.skills`, `items.scripts`, `items.commands`, `items.hooks`, `items.agents` or `items.rules`. The loader (`src/adapters/catalog/folder-source.ts`) validates items with the zod schemas in `src/domain/catalog/`. An invalid or unlisted item is skipped with a warning.

After adding or changing an MCP, skill, script, slash command, hook, agent or rule, run `pnpm run docs:catalog` to regenerate the catalog tables in `README.md`. CI fails (`pnpm run docs:catalog:check`) when they are out of date.

When catalog items change, also refresh the docs site pages:

```sh
pnpm run docs:website-catalog
pnpm run docs:website-catalog:check
```

That regenerates Markdown under `website/src/content/docs/{en,es}/catalog/` from `catalog/` (read-only). Profiles stay browse-only with a not-installable callout. The isolated `.github/workflows/website.yml` workflow runs the same emit step before the Astro build; root `ci.yml` / `cd.yml` do not.

Names for MCPs, skills, scripts, slash commands, hooks, agents and rules must match `^[a-z0-9][a-z0-9-]*$` (lowercase letters, digits and hyphens; no leading hyphen).

### Add a skill

1. Create `catalog/skills/<name>/SKILL.md`. Add any supporting files (scripts, templates, assets) next to it in the same directory.
2. Start `SKILL.md` with frontmatter:

   ```md
   ---
   name: my-skill
   description: One line that says what the skill does and when to use it.
   ---

   # My skill

   Instructions for the agent.
   ```

   - `name` must equal the directory name and match the naming rule.
   - `description` is required and non-empty.
   - Only single-line `key: value` frontmatter is supported. Multi-line values (indented lines, `|`, `>`) are rejected.
   - No symlinks. Limits: 100 files, depth 8, 1 MiB per file, 5 MiB per skill.

3. Add the name to `items.skills` in `catalog/catalog.json`:

   ```json
   "skills": ["example-skill", "my-skill"]
   ```

4. Update `test/adapters/catalog/bundled-catalog.test.ts`, which asserts the exact bundled item lists and counts.
5. Verify:

   ```sh
   pnpm run build
   node dist/main.js init --skills my-skill --scope project --dry-run
   pnpm test
   ```

   The dry run prints `my-skill: create` and writes nothing. If the output says `not listed in catalog.json` or `unknown skill`, check step 3. `catalog/skills/example-skill` is a reference.

### Add an MCP

1. Create `catalog/mcps/<name>.json`. The `name` field must equal the file name and match the naming rule.
2. Fields:
   - `name`, `description`: required strings.
   - `server`: either `{ "type": "stdio", "command": "...", "args": [...], "env": {...} }` or `{ "type": "http" | "sse", "url": "https://...", "headers": {...} }`.
   - `env`: list of `{ "name": "UPPER_SNAKE", "required": true, "description": "..." }` for every variable the server references. `required` defaults to `true`.
   - `targets`: optional list of agent targets; omit it for all (the only target today is `claude-code`).
3. Secrets: values in `headers` and `server.env` must reference a `${VAR}` placeholder; literal values are rejected. Every `${VAR}` used anywhere in the server definition must be declared in `env`. Defaults (`${VAR:-x}`) are not allowed in headers. Never commit a real token.
4. Add the name to `items.mcps` in `catalog/catalog.json`, then update `test/adapters/catalog/bundled-catalog.test.ts`.
5. Verify with `pnpm run build`, `node dist/main.js init --mcps <name> --scope project --dry-run` and `pnpm test`.

Examples: `catalog/mcps/github.json` (http with a secret header) and `catalog/mcps/context7.json` (stdio).

### Add a script

1. Create `catalog/scripts/<name>/` with:
   - `index.mjs` — ESM entry point (Node `>=22.18`). shitaku runs it with `process.execPath` and `shell:false`.
   - `script.json` — metadata. Required: `name` (must equal the directory name) and non-empty `description`. Optional: `tools` (binaries expected on PATH / `.bin`), `args`, `output`, `exitCodes`.
2. Add the name to `items.scripts` in `catalog/catalog.json`:

   ```json
   "scripts": ["my-script"]
   ```

3. Update `test/adapters/catalog/bundled-catalog.test.ts` when you add or change bundled scripts (the shipped catalog currently lists `complexity`, `dead-code`, `duplication` and `repo-map` in `items.scripts`).
4. Verify:

   ```sh
   pnpm run build
   node dist/main.js init --scripts my-script --scope project --dry-run
   node dist/main.js run my-script
   pnpm test
   ```

   The dry run prints `my-script: create` and writes nothing. After a real install, `shitaku run` lists it and `shitaku run my-script` executes `index.mjs`. Regenerate README and website catalog tables with `pnpm run docs:catalog` and `pnpm run docs:website-catalog` when bundled scripts change.

Install roots: project `./.shitaku/scripts/<name>/`, user `~/.claude/.shitaku/scripts/<name>/` — never agent skill directories.

### Adding catalog items: slash commands

A slash command is a single Markdown file that Claude Code runs as `/<name>`. It is not a shitaku CLI subcommand.

1. Create `catalog/commands/<name>.md`. The file name (without `.md`) is the command name and must match `^[a-z0-9][a-z0-9-]*$`.
2. Start the file with frontmatter that has a non-empty single-line `description`; other single-line keys such as `argument-hint` pass through untouched. Multi-line values are rejected. The body after the frontmatter must not be empty.

   ```md
   ---
   description: Review the staged changes and list risks.
   argument-hint: [focus]
   ---

   Review the staged changes. Focus on $ARGUMENTS.
   ```

3. Add the name to `items.commands` in `catalog/catalog.json`:

   ```json
   "commands": ["review"]
   ```

   A file that is not listed, or a listed one that is missing or invalid, is skipped with a warning. No symlinks.

4. Verify:

   ```sh
   pnpm run build
   node dist/main.js list commands
   node dist/main.js init --commands my-command --scope project --dry-run
   pnpm test
   ```

   The dry run prints `my-command: create` and writes nothing. Regenerate the README and website tables with `pnpm run docs:catalog` and `pnpm run docs:website-catalog`.

Install behavior: the file is copied flat to `~/.claude/commands/<name>.md` (`user`) or `./.claude/commands/<name>.md` (`project`). Other files in that directory are never touched.

- A different `<name>.md` that shitaku did not install (or that changed since) is a conflict: `init` exits `2` and writes nothing.
- `--force` backs the file up under `~/.claude/.shitaku/backups/` and replaces it; `shitaku undo` restores the original bytes. Undo refuses (exit `3`) if the file changed after the install, unless `--force` is set.
- `shitaku uninstall <name> --kind command` removes only that file. The bundled catalog ships no command yet, so tests use fixtures and never depend on a bundled one.

### Adding catalog items: agents

An agent is a single Markdown file that Claude Code loads as a subagent. Its frontmatter can grant tools or permissions, so review an agent as you would code.

1. Create `catalog/agents/<name>.md`. The file name (without `.md`) is the agent name and must match `^[a-z0-9][a-z0-9-]*$`.
2. Start the file with frontmatter that has a `name` equal to the file stem and a `description`, each on one line or as a literal (`|`) or folded (`>`) block scalar. The body after the frontmatter must not be empty.

   ```md
   ---
   name: code-reviewer
   description: Reviews a diff for correctness and risk.
   tools: Read, Grep
   ---

   You review the diff you are given and list concrete risks.
   ```

3. Add the name to `items.agents` in `catalog/catalog.json`:

   ```json
   "agents": ["code-reviewer"]
   ```

   A file that is not listed, or a listed one that is missing or invalid, is skipped with a warning. No symlinks.

Validation limits:

- Only `name` and `description` are validated, and `skills` is read as a list (see below). Other keys such as `tools`, `model`, `hooks` or `mcpServers` may span several lines, are copied verbatim and are not validated; unknown keys are ignored.
- A `name` or `description` may be a literal (`|`) or folded (`>`) block scalar, with optional chomping and indentation indicators. The description is shown on one line with whitespace collapsed and the file is installed verbatim. Other multi-line forms for these two keys (nested values, multi-line plain or quoted scalars) are rejected.

Declared skills: an agent may list the skills it needs under `skills:`, either as a block list (`- a` lines) or as an inline `[a, b]` list. A plain scalar such as `skills: a, b` is rejected. The reader accepts no multi-line flow lists and no nested values. Skill names are not validated at load; each name is checked for safety only when `init` resolves it.

- On `init`, a declared skill that exists in the catalog is added to the same run and scope, and the plan shows `required by agent <name>`.
- A declared skill missing from both the catalog and the disk prints a `warning:` line. One that is already on disk but not managed by shitaku prints a `note:` line and is left alone. Neither changes the exit code, and `--dry-run` prints both.
- `uninstall` of an agent does not remove its skills; `shitaku undo` reverts the whole run.
- The bundled-catalog guard (`test/adapters/catalog/bundled-catalog.test.ts`) checks that every skill a bundled agent declares is in the catalog.

Install behavior: the file is copied flat to `~/.claude/agents/<name>.md` (`user`) or `./.claude/agents/<name>.md` (`project`). Other files in that directory are never touched. A different `<name>.md` that shitaku did not install is a conflict and is never overwritten silently; `--force` backs it up first and `shitaku undo` restores it. `shitaku uninstall <name>` refuses a modified file without `--force`. The bundled catalog ships these agents: `pr-creator`, a least-privilege example that combines the `pr-writing` skill with `github` MCP tools; `qa`, which reviews changes for missing tests and regressions, writes only test files and can use optional `playwright` MCP tools; `socratic-challenger`, which applies the `socratic-method` skill and writes only a Q&A log; and `docs-writer`, which applies the `docs-writing` skill without a shell and writes only documentation and code comments. Install behavior tests still use fixtures. Regenerate the README and website tables with `pnpm run docs:catalog` and `pnpm run docs:website-catalog`.

### Adding catalog items: rules

A rule is a single Markdown file that Claude Code loads as an instruction. A rule without `paths` is loaded in every session, so keep rules short and review one as you would a prompt: it steers the agent.

1. Create `catalog/rules/<name>.md`. The file name (without `.md`) is the rule name and must match `^[a-z0-9][a-z0-9-]*$`.
2. Start the file with frontmatter that has a single-line `name` equal to the file stem and a single-line `description`. The body after the frontmatter must not be empty.

   ```md
   ---
   name: no-secrets
   description: Never write secrets or credentials into code, config or logs.
   ---

   Never write real secrets, tokens or credentials into files, commits or logs.
   ```

3. Add the name to `items.rules` in `catalog/catalog.json`. To preselect it in the interactive prompt, also list it under `recommended.rules`:

   ```json
   "items": { "rules": ["no-secrets"] },
   "recommended": { "rules": ["no-secrets"] }
   ```

   A file that is not listed, or a listed one that is missing or invalid, is skipped with a warning. A name under `recommended.rules` that is not a loaded rule is reported and ignored. No symlinks.

Validation limits:

- Only `name` and `description` are validated. Other keys, such as Claude Code's own `paths`, may span several lines, are copied verbatim and are not validated, so malformed nested YAML is not detected. Unknown keys pass through.
- Quote glob patterns in `paths` (`- "src/**/*.ts"`): an unquoted pattern that starts with `*` or `{` is invalid YAML, and shitaku cannot catch it.
- A rule may declare one `check` (a nested mapping) and a `severity` (`error` or `warn`, default `error` when a check is present); `severity` without `check` is invalid. Checks are declared but not enforced until #226: no command evaluates them yet. An invalid `check` or `severity` skips only that rule. Types: `file-exists`, `contains-sections`, `pattern-absent`, `max-lines` and `tool` (data only, never executed); unknown fields are rejected.
- The `check` block reads a strict YAML subset one level deep: kebab-case keys, plain, single-quoted or double-quoted scalars (double quotes only allow `\\ \" \/ \n \t`; prefer single quotes for regular expressions) and block sequences of scalars. Flow collections, anchors, aliases, tags, block scalars, multi-line scalars, deeper nesting and duplicate keys are rejected.
- Check globs are at most 256 characters, relative and POSIX, with `*`, `?` and `**` only (no absolute paths, `..`, `./`, braces, character classes, `!` or backslashes); lists hold 1 to 32 entries.
- A check `pattern` is a JavaScript regular expression of 1 to 200 characters without backreferences, lookbehind or nested quantifiers such as `(a+)+`. Catalog checks are reviewed data at the same trust level as hooks; the guards are defense in depth, not a security boundary.
- A `name` or `description` written as a block scalar (`|` or `>`) is rejected (single-line only).
- Bundled rules stay at or below 1,500 bytes each and declare no `paths`; a test enforces both.

Install behavior: the file is copied flat to `~/.claude/rules/<name>.md` (`user`) or `./.claude/rules/<name>.md` (`project`). Other files in that directory are never touched. A different `<name>.md` that shitaku did not install is a conflict and is never overwritten silently; `--force` backs it up first and `shitaku undo` restores it. `shitaku uninstall <name>` refuses a modified file without `--force`. Regenerate the README and website tables with `pnpm run docs:catalog` and `pnpm run docs:website-catalog`.

### Adding catalog items: hooks

A hook is one JSON file that adds a single Claude Code `command` handler to the `hooks` key of a `settings.json`. Hooks run commands with the user's full permissions, so review them as you would code.

1. Create `catalog/hooks/<name>.json`. The `name` field must equal the file name and match the naming rule.
2. Fields: `name`, `description`, `event` (a hook event such as `PostToolUse`) and `command` are required; `matcher` (omitted means all), `timeout` (positive number) and `type` (only `command`) are optional. Unknown fields, several handlers and a non-`command` type are rejected.

   ```json
   {
     "name": "fmt",
     "description": "Format files after Claude edits them.",
     "event": "PostToolUse",
     "matcher": "Edit|Write",
     "command": "${CLAUDE_PROJECT_DIR}/scripts/format.sh",
     "timeout": 30
   }
   ```

3. Secrets: `command` and `matcher` must not contain a literal secret. Write `${VAR}` references; they are copied unchanged and never expanded by shitaku. The check is a heuristic (known token shapes and `NAME=value` credentials), so it does not replace review. Never commit a real token.
4. Add the name to `items.hooks` in `catalog/catalog.json`, and to the `hooks` list of any profile that should include it (it must exist in the catalog). A file that is not listed, or a listed one that is missing or invalid, is skipped with a warning. Update `test/adapters/catalog/bundled-catalog.test.ts` when you add a bundled hook.
5. Verify:

   ```sh
   pnpm run build
   node dist/main.js list hooks
   node dist/main.js init --hooks my-hook --scope project --dry-run
   pnpm test
   ```

   The dry run prints the exact event, matcher and command and `my-hook: create`, and writes nothing. Regenerate the README and website tables with `pnpm run docs:catalog` and `pnpm run docs:website-catalog`.

Install behavior: `init --hooks <name>` merges the handler into `~/.claude/settings.json` (`user`) or `./.claude/settings.json` (`project`), never into `settings.local.json`, and writes no marker key: the manifest records the file, event, matcher and handler and finds the hook by exact content. It always confirms the exact commands first; `--yes` does not skip that, only `--allow-hooks` does, and a non-interactive run without it writes nothing and exits `1`. Hooks from `--source` follow the same gate.

- A hook you edit in `settings.json` no longer matches, so `status` reports it `missing` and `uninstall --kind hook` reports it already absent.
- `shitaku undo` restores the original bytes, and with `--force` removes only the handlers it installed. `shitaku uninstall <name> --kind hook` removes only that handler, and uninstalling the hook whose install created the `hooks` key can leave `"hooks": {}` in the file.
- Settings must be strict JSON; a file with comments, trailing commas, a BOM or no content is refused and nothing is written.
- An install keeps the existing keys and their order, the indentation, the line endings (LF or CRLF; a file that mixes both is written as LF) and the trailing newline, but it re-serializes the file with `JSON.stringify`: one-line arrays are expanded, integer-like keys move first, duplicate keys keep the last value, integers above 2^53 lose precision and `\u` escapes become plain characters. `JSON.parse` cannot preserve these, so do not promise more in docs; `undo` with no later edits restores the exact bytes.
- Claude Code reloads hooks live and may write `settings.json` itself, so avoid `/config` during an install.
- Older shitaku versions throw a `ManifestError` on a manifest entry with `kind: 'hook'`; undo or uninstall hooks before downgrading.

### Add a profile

A profile is a named bundle of MCPs, skills, scripts, slash commands, hooks and agents.

1. Create `catalog/profiles/<name>.json`. The `name` field must equal the file name.
2. Fields: `name` (required), `description`, `extends` (profile names, applied first), `mcps`, `skills`, `scripts`, `commands`, `hooks`, `agents` (names that exist in the catalog).
3. Every referenced MCP, skill, script, command, hook and parent profile must exist, and `extends` must not form a cycle. A profile that does not resolve is skipped with a warning.
4. Add the name to `items.profiles` in `catalog/catalog.json`, then update `test/adapters/catalog/bundled-catalog.test.ts` if needed.

The CLI cannot select a profile yet; profiles are validated and resolved but not installable by name.

To try an item without touching the bundled catalog, point the CLI at another folder: `--source <folder>`.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`@commitlint/config-conventional`, enforced by the `commit-msg` hook), for example:

```
feat: add skills catalog loader
fix: reject skill names that escape the directory
docs: add CONTRIBUTING guide
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Pull requests

- Open the PR against `main`. Link the issue it closes (`Closes #<n>`).
- Keep it small and focused on one change. Split unrelated work into separate PRs. There is no hard size limit, but smaller PRs get reviewed faster.
- Add or update tests with the code, and update the README when behavior changes.
- CI (`.github/workflows/ci.yml`, job `ci`) must pass. It runs, in order: `pnpm install --frozen-lockfile`, `pnpm run lint`, `pnpm run format:check`, `pnpm run docs:catalog:check`, `pnpm run typecheck`, `pnpm run test:coverage` (fails below 80% coverage), `pnpm run build`, `pnpm run smoke:pack`. Run them locally before pushing.
- `smoke:pack` (`scripts/smoke-pack.mjs`) intentionally uses `npm pack` and `npm install`, because it simulates how consumers install the published package.

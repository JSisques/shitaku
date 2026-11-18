# AGENTS.md

Instructions for AI coding agents working on shitaku. For what the tool does and how to use it, see [README.md](README.md). For contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Overview

shitaku (`@jsisques/shitaku`) is a Node CLI (ESM, TypeScript, Node >= 22.18, pnpm) that installs a portable AI agent setup (skills, MCP servers, profiles) from a catalog into an agent target. Subcommands: `init`, `undo`, `status`.

## Layout

Hexagonal architecture, enforced by `test/architecture.test.ts`.

- `src/domain/`: pure logic (catalog schemas, plan, manifest, hashing, JSON merge, placeholders). No `fs`, `os`, `path`, `child_process` or `process`; must not import `@/adapters` or `@/application`.
- `src/ports/`: interfaces (`agent-target`, `catalog-source`, `file-system`, `paths`, `prompter`).
- `src/application/`: use cases (`init-mcps`, `undo-install`, `status`, `journal`, `skill-tree`).
- `src/adapters/`: implementations of the ports (`catalog`, `claude-code`, `cli`, `fs`).
- `src/main.ts`: composition root; the only place that touches `os.homedir`, `process` and the package location.
- `test/`: mirrors `src/` (`domain`, `application`, `adapters`), plus `helpers/`, `fixtures/` and repo-wide guards (`architecture`, `naming`, `release-config`, `tooling`). `test/setup.ts` sandboxes `HOME` to a temp dir, so tests cannot touch the real home.
- `catalog/`: bundled data shipped in the package: `catalog.json`, `skills/`, `mcps/`, `profiles/`.

Imports use path aliases: `@/` maps to `src/`, `@test/` maps to `test/`. Never use `../` specifiers, and never import `@test/` from `src/`.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm run typecheck      # tsc --noEmit
pnpm run lint           # eslint . (lint:fix to autofix)
pnpm run format:check   # prettier --check . (format to write)
pnpm run test           # vitest run (test:changed: only files changed vs origin/main)
pnpm run build          # tsc to dist/ + tsc-alias + alias check
```

## Conventions

- Conventional Commits, validated by commitlint (`commit-msg` hook).
- Husky hooks: `pre-commit` runs lint-staged (ESLint + Prettier); `pre-push` runs typecheck, `test:changed` and build. Details in [CONTRIBUTING.md](CONTRIBUTING.md#git-hooks).
- Style: Prettier (120 columns, single quotes, semicolons, trailing commas); ESLint with `typescript-eslint` type-checked rules. TypeScript is `strict` with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`; relative imports of `.ts` modules use the `.js` extension.
- Tests are Vitest files named `test/**/*.test.ts`, placed to mirror the source path.

## Adding catalog items

Skills, MCPs and profiles: follow [CONTRIBUTING.md](CONTRIBUTING.md#adding-to-the-catalog). Do not restate it here.

## Do not

- Never commit real secrets or tokens. Secrets in catalog files are only `${VAR}` placeholders.
- Never bypass hooks (`--no-verify`); fix the underlying failure instead.
- Do not read or write the real home directory from `src/` outside `src/main.ts`, or from tests.

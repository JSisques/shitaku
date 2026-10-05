import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import rules from './eslint.rules.mjs';

/**
 * Manual/shipped entry when eslint is invoked with this file as `-c`.
 * Named `complexity.eslint.config.mjs` so repo lint-staged does not auto-load it
 * as a flat config for the script sources themselves.
 * `index.mjs` writes a per-run config so consumer `.gitignore` is resolved from
 * the analysis cwd (ESM config modules are cached by URL).
 */
const gitignorePath = path.join(process.cwd(), '.gitignore');
const configs = [];

if (fs.existsSync(gitignorePath)) {
  configs.push(includeIgnoreFile(gitignorePath, { gitignoreResolution: true }));
}

configs.push({
  ignores: ['**/node_modules/**', '**/.git/**'],
});

export default defineConfig([...configs, ...rules]);

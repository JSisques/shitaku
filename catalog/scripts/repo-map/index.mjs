#!/usr/bin/env node
/**
 * Catalog repo-map script: writes a deterministic structural map of the working directory to
 * <out>/repo-map.json and a size-capped digest to <out>/repo-map.md (default .shitaku/, see
 * --format). No timestamps and no absolute paths, so equal trees give equal bytes. Git is
 * optional. Exit 0 when written, 2 for CLI, IO or fatal failures.
 */
import { mkdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from './args.mjs';
import { buildRepoMap } from './build-map.mjs';
import { renderJson } from './render-json.mjs';
import { renderMarkdown } from './render-markdown.mjs';
import { scan } from './scan.mjs';

const JSON_FILE = 'repo-map.json';
const MARKDOWN_FILE = 'repo-map.md';

/**
 * Resolve symlinks in the deepest ancestor of `path` that exists, then re-append the rest, so an
 * output directory reached through a symlinked path compares equal to the real root.
 * @param {string} path absolute
 */
function realpathOfExisting(path) {
  /** @type {string[]} */
  const rest = [];
  let current = path;
  for (;;) {
    try {
      return join(realpathSync(current), ...rest.reverse());
    } catch {
      const parent = dirname(current);
      if (parent === current) return path;
      rest.push(basename(current));
      current = parent;
    }
  }
}

/**
 * The output directory relative to the root as a POSIX path (`''` for the root itself), or
 * null when it lies outside of the root.
 * @param {string} root
 * @param {string} outDir
 */
function outputRelative(root, outDir) {
  const rel = relative(root, outDir);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

/**
 * Write through a temporary file and rename, so a crash never leaves a half-written map.
 * @param {string} target
 * @param {string} text
 */
function writeAtomic(target, text) {
  const temporary = `${target}.tmp`;
  try {
    writeFileSync(temporary, text);
    renameSync(temporary, target);
  } catch (err) {
    rmSync(temporary, { force: true });
    throw err;
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = realpathSync(process.cwd());
  const outDir = realpathOfExisting(resolve(root, options.out));

  const snapshot = scan(root, { ignore: options.ignore, outRel: outputRelative(root, outDir) });
  const map = buildRepoMap(snapshot);

  // Render every selected output before writing any, so a failure never leaves a mixed pair of
  // old and new files. An output that --format did not select is neither written nor deleted.
  /** @type {{ name: string, text: string }[]} */
  const outputs = [];
  if (options.format !== 'markdown') outputs.push({ name: JSON_FILE, text: renderJson(map) });
  if (options.format !== 'json') {
    outputs.push({ name: MARKDOWN_FILE, text: renderMarkdown(map, { maxDepth: options.maxDepth }) });
  }

  mkdirSync(outDir, { recursive: true });
  for (const { name, text } of outputs) {
    const target = join(outDir, name);
    writeAtomic(target, text);
    process.stdout.write(`wrote ${relative(root, target).split(sep).join('/')}\n`);
  }
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message.startsWith('repo-map: ') ? message : `repo-map: ${message}`}\n`);
  process.exit(2);
}

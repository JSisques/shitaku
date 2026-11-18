#!/usr/bin/env node
/**
 * Catalog repo-map script: writes a deterministic structural map of the working directory to
 * <out>/repo-map.json (default .shitaku/). No timestamps and no absolute paths, so equal trees
 * give equal bytes. Git is optional. Exit 0 when written, 2 for CLI, IO or fatal failures.
 */
import { mkdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from './args.mjs';
import { buildRepoMap } from './build-map.mjs';
import { renderJson } from './render-json.mjs';
import { scan } from './scan.mjs';

const JSON_FILE = 'repo-map.json';

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
  const outDir = resolve(root, options.out);

  const snapshot = scan(root, { ignore: options.ignore, outRel: outputRelative(root, outDir) });
  const json = renderJson(buildRepoMap(snapshot));

  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, JSON_FILE);
  writeAtomic(target, json);
  process.stdout.write(`wrote ${relative(root, target).split(sep).join('/')}\n`);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message.startsWith('repo-map: ') ? message : `repo-map: ${message}`}\n`);
  process.exit(2);
}

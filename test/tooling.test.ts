import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const FIXTURE = join(ROOT, 'test/fixtures/lint/floating-promise.ts');
const SCANNED_DIRS = ['src', 'test', 'scripts'];
const WEBSITE_ARTIFACTS = [
  'website/dist/index.html',
  'website/.astro/data-store.json',
  'website/node_modules/pkg/index.js',
];

interface Manifest {
  version: string;
  scripts?: Record<string, string>;
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Manifest;
}

function majorOf(manifest: Manifest): number {
  return Number(manifest.version.split('.')[0]);
}

function listFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|mjs|js)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe('compiler split', () => {
  it('pins typescript to major 6 for typescript-eslint', () => {
    expect(majorOf(readManifest('node_modules/typescript/package.json'))).toBe(6);
  });

  it('installs typescript-native at major 7', () => {
    expect(majorOf(readManifest('node_modules/typescript-native/package.json'))).toBe(7);
  });

  it.each(['typecheck', 'build'])('%s script uses the explicit native compiler path', (name) => {
    const script = readManifest('package.json').scripts?.[name] ?? '';
    expect(script).toContain('node_modules/typescript-native/bin/tsc');
    expect(script.replaceAll('node_modules/typescript-native/bin/tsc', '')).not.toMatch(/(^|[\s&|;])tsc(\s|$)/);
  });
});

describe('lint gate', () => {
  it('reports no-floating-promises on the violation fixture', async () => {
    const eslint = new ESLint({ cwd: ROOT, ignore: false });
    const [result] = await eslint.lintFiles([FIXTURE]);
    const ruleIds = result?.messages.map((message) => message.ruleId);
    expect(ruleIds).toContain('@typescript-eslint/no-floating-promises');
  }, 30_000);

  it('reports nothing for a clean source file', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const [result] = await eslint.lintFiles([join(ROOT, 'src/main.ts')]);
    expect(result?.errorCount).toBe(0);
  }, 30_000);
});

describe('inline disables', () => {
  it('scans at least one file so the check cannot pass vacuously', () => {
    const files = SCANNED_DIRS.flatMap(listFiles);
    expect(files.length).toBeGreaterThan(5);
  });

  it('carries a " -- " reason on every eslint-disable comment', () => {
    // The pattern is built from parts so this file never matches its own scan.
    const directive = new RegExp(['eslint', 'disable'].join('-'));
    const offenders = SCANNED_DIRS.flatMap(listFiles).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => directive.test(line) && !line.includes(' -- '))
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('website build artifact ignores', () => {
  it.each(WEBSITE_ARTIFACTS)('Prettier ignores %s', async (rel) => {
    const info = await prettier.getFileInfo(join(ROOT, rel), {
      ignorePath: join(ROOT, '.prettierignore'),
    });
    expect(info.ignored).toBe(true);
  });

  it.each(WEBSITE_ARTIFACTS)('ESLint ignores %s', async (rel) => {
    const eslint = new ESLint({ cwd: ROOT });
    expect(await eslint.isPathIgnored(join(ROOT, rel))).toBe(true);
  });

  it('gitignore lists website/dist, website/.astro, and website/node_modules', () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^website\/dist\/?$/m);
    expect(gitignore).toMatch(/^website\/\.astro\/?$/m);
    expect(gitignore).toMatch(/^website\/node_modules\/?$/m);
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli, type CliDeps } from '@/adapters/cli/program.js';

// Built from parts so this file does not match itself.
const OLD_NAME = new RegExp(['dot', 'agent'].join(''), 'i');
const ROOT = join(import.meta.dirname, '..');
// openspec/changes/** and openspec/specs/** are excluded on purpose: history and archive-time specs.
const ROOTS = [
  'src',
  'test',
  'scripts',
  'catalog',
  'openspec/config.yaml',
  'README.md',
  'package.json',
  'pnpm-lock.yaml',
];

function walk(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
}

describe('product naming', () => {
  it('does not mention the old product name in live files', () => {
    const offenders = ROOTS.flatMap((r) => walk(join(ROOT, r))).filter((f) => OLD_NAME.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it('keeps package name and bin key consistent with the CLI', async () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      name: string;
      bin: Record<string, string>;
    };
    expect(pkg.name).toBe('@jsisques/shitaku');
    expect(Object.keys(pkg.bin)).toEqual(['shitaku']);

    const out: string[] = [];
    const deps = { out: (l: string) => out.push(l), err: (l: string) => out.push(l) } as unknown as CliDeps;
    expect(await runCli(['node', 'shitaku', '--help'], deps)).toBe(0);
    expect(out.join('\n')).toContain('Usage: shitaku');
  });

  it('documents version entry points and bare-semver stdout in README', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    expect(readme).toContain('shitaku version');
    expect(readme).toContain('shitaku -v');
    expect(readme).toContain('shitaku --version');
    expect(readme).toMatch(/bare semver/i);
  });
});

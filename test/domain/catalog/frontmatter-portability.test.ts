import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const FILE = join(import.meta.dirname, '..', '..', '..', 'src', 'domain', 'catalog', 'frontmatter.ts');

/** Module specifiers from `from '...'`, `import('...')` and side-effect `import '...'` only. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

describe('frontmatter reader portability', () => {
  it('has no module specifiers', () => {
    const specifiers = [...readFileSync(FILE, 'utf8').matchAll(SPECIFIER)].map((m) => m[1] ?? '');
    expect(
      specifiers,
      'src/domain/catalog/frontmatter.ts must stay import-free: the docs generators load it under plain Node',
    ).toEqual([]);
  });

  it('loads and decodes a block scalar under plain Node with no flags', () => {
    const script = [
      `const { readFrontmatter } = await import(${JSON.stringify(pathToFileURL(FILE).href)});`,
      `const result = readFrontmatter('---\\ndescription: |\\n  a\\n  b\\n---\\n', 'x.md', { allowNested: true });`,
      'process.stdout.write(JSON.stringify(result.data));',
    ].join('\n');
    const env = { ...process.env };
    delete env['NODE_OPTIONS'];
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8' });
    expect(run.stderr).not.toMatch(/ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX|ERR_MODULE_NOT_FOUND/);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('{"description":"a\\nb\\n"}');
  });

  it('reads block and flow lists under plain Node with no flags', () => {
    const script = [
      `const { readFrontmatter } = await import(${JSON.stringify(pathToFileURL(FILE).href)});`,
      `const options = { allowNested: true, lists: ['skills'] };`,
      `const flow = readFrontmatter('---\\nskills: [a, b]\\n---\\n', 'x.md', options);`,
      `const block = readFrontmatter('---\\nskills:\\n  - a\\n  - b\\n---\\n', 'x.md', options);`,
      'process.stdout.write(JSON.stringify([flow.lists.skills, block.lists.skills]));',
    ].join('\n');
    const env = { ...process.env };
    delete env['NODE_OPTIONS'];
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8' });
    expect(run.stderr).not.toMatch(/ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX|ERR_MODULE_NOT_FOUND/);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('[["a","b"],["a","b"]]');
  });
});

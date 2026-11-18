import { beforeAll, describe, expect, it } from 'vitest';
import { loadRepoMapModule } from '@test/helpers/repo-map.js';

type GlobModule = {
  globToRegExp: (pattern: string) => RegExp;
  isIgnored: (path: string, patterns: string[]) => boolean;
  matchAny: (path: string, patterns: string[]) => boolean;
};

let mod: GlobModule;

beforeAll(async () => {
  mod = await loadRepoMapModule<GlobModule>('glob.mjs');
});

describe('globToRegExp', () => {
  it('lets ** span segments, including zero segments', () => {
    const re = mod.globToRegExp('src/**/x.ts');
    expect(re.test('src/a/b/x.ts')).toBe(true);
    expect(re.test('src/x.ts')).toBe(true);
    expect(re.test('lib/x.ts')).toBe(false);
  });

  it('keeps * inside one segment', () => {
    const re = mod.globToRegExp('src/*.ts');
    expect(re.test('src/a.ts')).toBe(true);
    expect(re.test('src/a/b.ts')).toBe(false);
  });

  it('matches exactly one character with ?', () => {
    const re = mod.globToRegExp('a?c');
    expect(re.test('abc')).toBe(true);
    expect(re.test('ac')).toBe(false);
    expect(re.test('a/c')).toBe(false);
  });

  it.each([
    ['a.b', 'a.b', 'axb'],
    ['(x)', '(x)', 'x'],
    [';rm -rf', ';rm -rf', 'rm -rf'],
    ['a+b[1]', 'a+b[1]', 'aab1'],
  ])('treats regex metacharacters in %j as literals', (pattern, hit, miss) => {
    const re = mod.globToRegExp(pattern);
    expect(re.test(hit)).toBe(true);
    expect(re.test(miss)).toBe(false);
  });
});

describe('isIgnored', () => {
  it('matches a pattern without a slash against any single segment', () => {
    expect(mod.isIgnored('a/generated/b.ts', ['generated'])).toBe(true);
    expect(mod.isIgnored('generated', ['generated'])).toBe(true);
    expect(mod.isIgnored('a/notgenerated/b.ts', ['generated'])).toBe(false);
    expect(mod.isIgnored('a/b.snap', ['*.snap'])).toBe(true);
    expect(mod.isIgnored('a/b.ts', ['*.snap'])).toBe(false);
  });

  it('anchors a pattern with a slash at the root', () => {
    expect(mod.isIgnored('src/gen/x.ts', ['src/gen'])).toBe(true);
    expect(mod.isIgnored('lib/src/gen/x.ts', ['src/gen'])).toBe(false);
  });

  it('anchors a pattern with a leading slash at the root, gitignore style', () => {
    expect(mod.isIgnored('gen/x.ts', ['/gen'])).toBe(true);
    expect(mod.isIgnored('gen', ['/gen'])).toBe(true);
    expect(mod.isIgnored('lib/gen/x.ts', ['/gen'])).toBe(false);
    expect(mod.isIgnored('a.snap', ['/*.snap'])).toBe(true);
    expect(mod.isIgnored('lib/a.snap', ['/*.snap'])).toBe(false);
    expect(mod.isIgnored('src/gen/x.ts', ['/src/gen/'])).toBe(true);
  });

  it('ignores a path when any ancestor matches', () => {
    expect(mod.isIgnored('packages/a/dist/deep/x.js', ['packages/a/dist'])).toBe(true);
    expect(mod.isIgnored('packages/a/src/x.js', ['packages/a/dist'])).toBe(false);
  });

  it('supports **/dir/** patterns at any depth', () => {
    expect(mod.isIgnored('a/b/generated/c.ts', ['**/generated/**'])).toBe(true);
    expect(mod.isIgnored('generated/c.ts', ['**/generated/**'])).toBe(true);
    expect(mod.isIgnored('a/b/c.ts', ['**/generated/**'])).toBe(false);
  });

  it('never matches with an empty pattern list', () => {
    expect(mod.isIgnored('a/b.ts', [])).toBe(false);
  });

  it('treats shell metacharacters as plain glob text', () => {
    expect(mod.isIgnored('a/;rm -rf/b.ts', [';rm -rf'])).toBe(true);
    expect(mod.isIgnored('a/b.ts', [';rm -rf'])).toBe(false);
  });
});

describe('matchAny', () => {
  it('matches a whole directory path against workspace globs', () => {
    expect(mod.matchAny('packages/a', ['packages/*'])).toBe(true);
    expect(mod.matchAny('packages/a/b', ['packages/*'])).toBe(false);
    expect(mod.matchAny('apps/web/ui', ['apps/**'])).toBe(true);
    expect(mod.matchAny('tools/x', ['packages/*'])).toBe(false);
  });

  it('lets a leading ! negate an earlier match', () => {
    expect(mod.matchAny('packages/a', ['packages/*', '!packages/a'])).toBe(false);
    expect(mod.matchAny('packages/b', ['packages/*', '!packages/a'])).toBe(true);
  });

  it('ignores a leading ./ and a trailing /', () => {
    expect(mod.matchAny('packages/a', ['./packages/*/'])).toBe(true);
  });

  it('does not match when only negations are present', () => {
    expect(mod.matchAny('packages/a', ['!packages/b'])).toBe(false);
  });
});

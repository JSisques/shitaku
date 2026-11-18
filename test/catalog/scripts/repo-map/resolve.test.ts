import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadRepoMapModule, SCRIPT_DIR, type Resolution, type ResolveModule } from '@test/helpers/repo-map.js';

let createResolver: ResolveModule['createResolver'];

beforeAll(async () => {
  createResolver = (await loadRepoMapModule<ResolveModule>('resolve.mjs')).createResolver;
});

const internal = (resolved: string): Resolution => ({ resolved, status: 'internal' });
const unresolved: Resolution = { resolved: null, status: 'unresolved' };

/** Resolve one specifier against an in-memory listing. */
const resolveIn = (files: string[], importer: string, specifier: string): Resolution =>
  createResolver({ files })(importer, specifier);

describe('createResolver: relative specifiers', () => {
  it('resolves a relative specifier to an extension-probed file', () => {
    const files = ['src/a.ts', 'src/util.ts'];
    expect(resolveIn(files, 'src/a.ts', './util')).toEqual(internal('src/util.ts'));
    expect(resolveIn(['a.ts', 'util.ts'], 'a.ts', './util')).toEqual(internal('util.ts'));
  });

  it('walks up through .. segments', () => {
    const files = ['src/a/b.ts', 'src/shared/x.ts'];
    expect(resolveIn(files, 'src/a/b.ts', '../shared/x')).toEqual(internal('src/shared/x.ts'));
  });

  it.each([
    ['.js', '.ts'],
    ['.jsx', '.tsx'],
    ['.mjs', '.mts'],
    ['.cjs', '.cts'],
  ])('maps %s to its TypeScript counterpart %s', (js, ts) => {
    expect(resolveIn([`src/a.ts`, `src/helper${ts}`], 'src/a.ts', `./helper${js}`)).toEqual(
      internal(`src/helper${ts}`),
    );
  });

  it('prefers the exact path over the TypeScript counterpart', () => {
    expect(resolveIn(['src/a.ts', 'src/helper.js', 'src/helper.ts'], 'src/a.ts', './helper.js')).toEqual(
      internal('src/helper.js'),
    );
  });

  it.each([
    ['.ts', '.tsx'],
    ['.tsx', '.mts'],
    ['.mts', '.cts'],
    ['.cts', '.js'],
    ['.js', '.jsx'],
    ['.jsx', '.mjs'],
    ['.mjs', '.cjs'],
  ])('probes %s before %s', (first, second) => {
    expect(resolveIn(['a.ts', `x${second}`, `x${first}`], 'a.ts', './x')).toEqual(internal(`x${first}`));
  });

  it('falls back to index files, after the file extensions', () => {
    expect(resolveIn(['a.ts', 'lib/index.ts'], 'a.ts', './lib')).toEqual(internal('lib/index.ts'));
    expect(resolveIn(['a.ts', 'lib/index.ts'], 'a.ts', './lib/')).toEqual(internal('lib/index.ts'));
    expect(resolveIn(['a.ts', 'lib.ts', 'lib/index.ts'], 'a.ts', './lib')).toEqual(internal('lib.ts'));
    expect(resolveIn(['lib/index.js', 'lib/index.ts', 'a.ts'], 'a.ts', './lib')).toEqual(internal('lib/index.ts'));
  });

  it('resolves . and .. as directories', () => {
    const files = ['src/index.ts', 'src/a/b.ts', 'src/a/index.ts'];
    expect(resolveIn(files, 'src/a/b.ts', '.')).toEqual(internal('src/a/index.ts'));
    expect(resolveIn(files, 'src/a/b.ts', '..')).toEqual(internal('src/index.ts'));
  });

  it('resolves non-source targets that are in the listing', () => {
    const files = ['src/a.ts', 'src/data.json', 'src/x.css'];
    expect(resolveIn(files, 'src/a.ts', './data.json')).toEqual(internal('src/data.json'));
    expect(resolveIn(files, 'src/a.ts', './x.css')).toEqual(internal('src/x.css'));
  });

  it('gives unresolved when nothing matches, including paths that leave the root', () => {
    const files = ['src/a.ts'];
    expect(resolveIn(files, 'src/a.ts', './missing')).toEqual(unresolved);
    expect(resolveIn(files, 'src/a.ts', '../../outside')).toEqual(unresolved);
  });

  it('matches case-sensitively', () => {
    expect(resolveIn(['src/a.ts', 'src/foo.ts'], 'src/a.ts', './Foo')).toEqual(unresolved);
    expect(resolveIn(['src/a.ts', 'src/Foo.ts'], 'src/a.ts', './Foo')).toEqual(internal('src/Foo.ts'));
  });

  it('is pure: the module never touches the filesystem, child processes or process state', () => {
    const source = readFileSync(join(SCRIPT_DIR, 'resolve.mjs'), 'utf8');
    expect(source.length).toBeGreaterThan(500);
    expect(source).not.toMatch(/node:(fs|child_process|path|os)|from 'fs'|process\./);
  });
});

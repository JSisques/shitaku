import { beforeAll, describe, expect, it } from 'vitest';
import { loadRepoMapModule, type ExtractModule, type RawImport } from '@test/helpers/repo-map.js';

let extractJs: ExtractModule['extractJs'];

beforeAll(async () => {
  extractJs = (await loadRepoMapModule<ExtractModule>('extract-js.mjs')).extractJs;
});

const importsOf = (source: string): RawImport[] => extractJs(source).imports;

describe('extractJs: imports', () => {
  it('records static imports of every clause shape', () => {
    const source = [
      "import a from 'a';",
      'import { b } from "b";',
      "import * as c from 'c';",
      "import d, { e } from 'd';",
      "import { type f, from } from 'f';",
      "import './side-effect.css';",
    ].join('\n');
    expect(importsOf(source)).toEqual([
      { specifier: './side-effect.css', kind: 'static' },
      { specifier: 'a', kind: 'static' },
      { specifier: 'b', kind: 'static' },
      { specifier: 'c', kind: 'static' },
      { specifier: 'd', kind: 'static' },
      { specifier: 'f', kind: 'static' },
    ]);
  });

  it('records import type as type, but keeps a default import named type static', () => {
    const source = [
      "import type { A } from 'a';",
      "import type B from 'b';",
      "import type * as C from 'c';",
      "import type from 'd';",
    ].join('\n');
    expect(importsOf(source)).toEqual([
      { specifier: 'a', kind: 'type' },
      { specifier: 'b', kind: 'type' },
      { specifier: 'c', kind: 'type' },
      { specifier: 'd', kind: 'static' },
    ]);
  });

  it('records export ... from, export * from and export * as ns from as reexport', () => {
    const source = [
      "export { a } from './a';",
      "export * from './b';",
      "export * as ns from './c';",
      "export type { T } from './d';",
      'const local = 1;',
      'export { local };',
    ].join('\n');
    expect(importsOf(source)).toEqual([
      { specifier: './a', kind: 'reexport' },
      { specifier: './b', kind: 'reexport' },
      { specifier: './c', kind: 'reexport' },
      { specifier: './d', kind: 'reexport' },
    ]);
  });

  it('records require() and import() with a literal specifier at any depth', () => {
    const source = [
      "const a = require('r1');",
      'function f() {',
      "  if (x) { return require('r2'); }",
      '}',
      "const lazy = () => import('d1');",
      'async function g() { return await import("d2"); }',
      "const attr = import('d3', { with: { type: 'json' } });",
      "foo.require('not-a-require');",
    ].join('\n');
    expect(importsOf(source)).toEqual([
      { specifier: 'd1', kind: 'dynamic' },
      { specifier: 'd2', kind: 'dynamic' },
      { specifier: 'd3', kind: 'dynamic' },
      { specifier: 'r1', kind: 'require' },
      { specifier: 'r2', kind: 'require' },
    ]);
  });

  it('ignores non-literal import() and require() and import.meta', () => {
    const source = [
      "require('real');",
      'import(variable);',
      'require(expr);',
      "require('a' + suffix);",
      'import(`./t/${name}.js`);',
      'const url = import.meta.url;',
    ].join('\n');
    expect(importsOf(source)).toEqual([{ specifier: 'real', kind: 'require' }]);
  });

  it('ignores import-like text in comments, strings, templates and regex literals', () => {
    const source = [
      "// import x from 'comment-line'",
      "/* import y from 'comment-block'; require('comment-require') */",
      'const s = "import z from \'string\'";',
      "const t = `import w from 'template' ${require('inside-template')} import('t2')`;",
      "const r = /import q from 'regex'/;",
      "import real from 'real';",
    ].join('\n');
    expect(importsOf(source)).toEqual([
      { specifier: 'inside-template', kind: 'require' },
      { specifier: 'real', kind: 'static' },
    ]);
  });

  it('ignores static import and export forms nested in blocks but keeps nested calls', () => {
    const source = [
      "import top from 'top';",
      'function f() {',
      "  import nested from 'nested-static';",
      "  export * from 'nested-export';",
      "  return require('nested-require');",
      '}',
      "declare module 'm' {",
      "  import inner from 'inner';",
      '}',
    ].join('\n');
    expect(importsOf(source)).toEqual([
      { specifier: 'nested-require', kind: 'require' },
      { specifier: 'top', kind: 'static' },
    ]);
  });

  it('returns what was found on broken syntax without throwing', () => {
    const source = "import { a from 'x'\nimport 'ok';\nexport * from";
    expect(() => extractJs(source)).not.toThrow();
    expect(importsOf(source)).toEqual([{ specifier: 'ok', kind: 'static' }]);
    expect(() => extractJs('const s = `abc ${ ; import "y"')).not.toThrow();
    expect(() => extractJs('import')).not.toThrow();
  });

  it('dedupes by specifier and kind and sorts by specifier, then kind', () => {
    const source = ["import 'b';", "import 'b';", "import('b');", "require('b');", "import 'a';"].join('\n');
    expect(importsOf(source)).toEqual([
      { specifier: 'a', kind: 'static' },
      { specifier: 'b', kind: 'dynamic' },
      { specifier: 'b', kind: 'require' },
      { specifier: 'b', kind: 'static' },
    ]);
  });
});

const exportsOf = (source: string): { name: string; kind: string }[] =>
  extractJs(source).exports.map(({ name, kind }) => ({ name, kind }));

describe('extractJs: exports', () => {
  it.each([
    ['export function f() {}', 'f', 'function'],
    ['export async function f() {}', 'f', 'function'],
    ['export function* f() {}', 'f', 'function'],
    ['export declare function f(): void;', 'f', 'function'],
    ['export class C {}', 'C', 'class'],
    ['export abstract class C {}', 'C', 'class'],
    ['export const a = 1;', 'a', 'const'],
    ['export declare const a: number;', 'a', 'const'],
    ['export let b = 2;', 'b', 'let'],
    ['export var c = 3;', 'c', 'var'],
    ['export type T = string;', 'T', 'type'],
    ['export interface I {}', 'I', 'interface'],
    ['export enum E {}', 'E', 'enum'],
    ['export const enum E {}', 'E', 'enum'],
    ['export namespace N {}', 'N', 'namespace'],
    ['export declare namespace N {}', 'N', 'namespace'],
    ['export namespace A.B {}', 'A', 'namespace'],
  ])('records %s', (source, name, kind) => {
    expect(exportsOf(source)).toEqual([{ name, kind }]);
  });

  it('records every binding of a destructured declaration and skips default values', () => {
    expect(exportsOf('export const { a, b: c, d = other, ...rest } = obj;')).toEqual([
      { name: 'a', kind: 'const' },
      { name: 'c', kind: 'const' },
      { name: 'd', kind: 'const' },
      { name: 'rest', kind: 'const' },
    ]);
    expect(exportsOf('export const [x, , y] = arr;')).toEqual([
      { name: 'x', kind: 'const' },
      { name: 'y', kind: 'const' },
    ]);
    expect(exportsOf('export let { n: { deep } } = o;')).toEqual([{ name: 'deep', kind: 'let' }]);
  });

  it.each([
    ['export default function () {}', 'function'],
    ['export default function named() {}', 'function'],
    ['export default async function named() {}', 'function'],
    ['export default class {}', 'class'],
    ['export default abstract class Base {}', 'class'],
    ['export default 42;', 'expression'],
    ['export default (a) => a;', 'expression'],
    ['export default async () => 1;', 'expression'],
  ])('records %s as the default export', (source, kind) => {
    expect(exportsOf(source)).toEqual([{ name: 'default', kind }]);
  });

  it('records export lists under their exported names with the local declaration kind', () => {
    const source = [
      'const a = 1;',
      'function b() {}',
      'export { a, b as c, missing, a as default };',
      'type T = number;',
      'export type { T };',
      'export { type T as U };',
    ].join('\n');
    expect(exportsOf(source)).toEqual([
      { name: 'T', kind: 'type' },
      { name: 'U', kind: 'type' },
      { name: 'a', kind: 'const' },
      { name: 'c', kind: 'function' },
      { name: 'default', kind: 'const' },
      { name: 'missing', kind: 'named' },
    ]);
  });

  it('records re-exports with their names, and export * as reexport-all', () => {
    const source = [
      "export * from 'a';",
      "export * as ns from 'b';",
      "export { x, y as z } from 'c';",
      "export { default } from 'd';",
    ].join('\n');
    expect(exportsOf(source)).toEqual([
      { name: '*', kind: 'reexport-all' },
      { name: 'default', kind: 'reexport' },
      { name: 'ns', kind: 'reexport' },
      { name: 'x', kind: 'reexport' },
      { name: 'z', kind: 'reexport' },
    ]);
  });

  it('records CommonJS exports', () => {
    const source = ['module.exports = {};', 'exports.x = 1;', 'module.exports.y = 2;'].join('\n');
    expect(exportsOf(source)).toEqual([
      { name: 'default', kind: 'commonjs' },
      { name: 'x', kind: 'commonjs' },
      { name: 'y', kind: 'commonjs' },
    ]);
  });

  it('does not mistake CommonJS-like member access or comparisons for exports', () => {
    const source = [
      'foo.exports.z = 1;',
      'exports.w == 1;',
      'exports.q.r = 1;',
      'exports[k] = 2;',
      'exports.ok = 3;',
    ].join('\n');
    expect(exportsOf(source)).toEqual([{ name: 'ok', kind: 'commonjs' }]);
  });

  it('ignores exports nested in function bodies, blocks and namespace or module blocks', () => {
    const source = [
      'export namespace N {',
      '  export const inner = 1;',
      '}',
      "declare module 'm' {",
      '  export function ambient(): void;',
      '}',
      'function f() {',
      '  exports.nested = 1;',
      '  module.exports = 2;',
      '}',
      'if (x) { exports.late = 1; }',
    ].join('\n');
    expect(exportsOf(source)).toEqual([{ name: 'N', kind: 'namespace' }]);
  });

  it('dedupes overloads and sorts by name, then kind', () => {
    const source = [
      'export function f(a: string): void;',
      'export function f(a: number): void;',
      'export function f(a: unknown) {}',
      'export type x = string;',
      'export const x = 1;',
      'export const b = 2;',
    ].join('\n');
    expect(exportsOf(source)).toEqual([
      { name: 'b', kind: 'const' },
      { name: 'f', kind: 'function' },
      { name: 'x', kind: 'const' },
      { name: 'x', kind: 'type' },
    ]);
  });

  it('does not treat a variable named type or an export of a plain object key as a declaration', () => {
    const source = ['const o = { type: 1, export: 2 };', 'type = 5;', 'export const real = 1;'].join('\n');
    expect(exportsOf(source)).toEqual([{ name: 'real', kind: 'const' }]);
  });
});

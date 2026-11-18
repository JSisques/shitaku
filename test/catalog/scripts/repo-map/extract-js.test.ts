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

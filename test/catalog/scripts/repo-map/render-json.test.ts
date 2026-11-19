import { beforeAll, describe, expect, it } from 'vitest';
import { loadRepoMapModule } from '@test/helpers/repo-map.js';

type RenderJsonModule = { renderJson: (value: unknown) => string };

let renderJson: RenderJsonModule['renderJson'];

beforeAll(async () => {
  ({ renderJson } = await loadRepoMapModule<RenderJsonModule>('render-json.mjs'));
});

describe('renderJson', () => {
  it('sorts object keys recursively, including objects inside arrays', () => {
    const out = renderJson({ b: 1, a: { d: [{ z: 1, y: 2 }], c: 2 } });
    expect(out).toBe(
      [
        '{',
        '  "a": {',
        '    "c": 2,',
        '    "d": [',
        '      {',
        '        "y": 2,',
        '        "z": 1',
        '      }',
        '    ]',
        '  },',
        '  "b": 1',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('indents with two spaces and ends with exactly one trailing newline', () => {
    const out = renderJson({ a: 1 });
    expect(out).toBe('{\n  "a": 1\n}\n');
    expect(out.endsWith('\n\n')).toBe(false);
  });

  it('keeps array order and does not sort array elements', () => {
    expect(JSON.parse(renderJson({ list: ['b', 'a', 'c'] }))).toEqual({ list: ['b', 'a', 'c'] });
  });

  it('gives identical bytes regardless of key insertion order', () => {
    const one = { schema: 'x', modules: [{ path: 'a', language: 'typescript' }], graph: { edges: [], n: 0 } };
    const two = { graph: { n: 0, edges: [] }, modules: [{ language: 'typescript', path: 'a' }], schema: 'x' };
    expect(renderJson(one)).toBe(renderJson(two));
  });

  it('adds no time field and does not alter values', () => {
    const value = { commit: null, count: 3, list: [1, 2], nested: { ok: true } };
    expect(JSON.parse(renderJson(value))).toEqual(value);
    expect(Object.keys(JSON.parse(renderJson(value)) as object)).toEqual(['commit', 'count', 'list', 'nested']);
  });

  it('orders keys by UTF-16 code unit, not by code point or locale', () => {
    // U+1F600 is the surrogate pair D83D DE00, which sorts before U+FF5E in code-unit order.
    const out = renderJson({ '～': 1, '\u{1F600}': 2, Z: 3, z: 4, é: 5, a: 6 });
    expect(Object.keys(JSON.parse(out) as object)).toEqual(['Z', 'a', 'z', 'é', '\u{1F600}', '～']);
    expect(out.indexOf('"Z"')).toBeLessThan(out.indexOf('"a"'));
    expect(out.indexOf('\u{1F600}')).toBeLessThan(out.indexOf('～'));
  });

  it('keeps a __proto__ key as plain data', () => {
    const value = JSON.parse('{"b":1,"__proto__":{"x":1}}') as unknown;
    expect(renderJson(value)).toBe('{\n  "__proto__": {\n    "x": 1\n  },\n  "b": 1\n}\n');
  });
});

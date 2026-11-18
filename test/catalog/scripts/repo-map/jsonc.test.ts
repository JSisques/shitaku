import { beforeAll, describe, expect, it } from 'vitest';
import { loadRepoMapModule } from '@test/helpers/repo-map.js';

type JsoncModule = { parseJsonc: (text: string) => unknown };

let parseJsonc: JsoncModule['parseJsonc'];

beforeAll(async () => {
  ({ parseJsonc } = await loadRepoMapModule<JsoncModule>('jsonc.mjs'));
});

describe('parseJsonc', () => {
  it('parses plain JSON', () => {
    expect(parseJsonc('{"a":[1,true,null,"x"]}')).toEqual({ a: [1, true, null, 'x'] });
  });

  it('drops line and block comments', () => {
    const text = `{
      // line comment
      "a": 1, /* block
      comment */ "b": 2
    }`;
    expect(parseJsonc(text)).toEqual({ a: 1, b: 2 });
  });

  it('drops trailing commas in objects and arrays', () => {
    expect(parseJsonc('{"a":[1,2,],"b":{"c":3,},}')).toEqual({ a: [1, 2], b: { c: 3 } });
  });

  it('keeps comment markers and commas that live inside strings', () => {
    const text = '{"url":"https://example.com/*x*/","glob":"src/**/*.ts","c":",]"}';
    expect(parseJsonc(text)).toEqual({ url: 'https://example.com/*x*/', glob: 'src/**/*.ts', c: ',]' });
  });

  it('handles escaped quotes inside strings', () => {
    expect(parseJsonc('{"a":"say \\"//hi\\" /* ok */"} // tail')).toEqual({ a: 'say "//hi" /* ok */' });
  });

  it('strips a leading BOM', () => {
    expect(parseJsonc('\uFEFF{"a":1}')).toEqual({ a: 1 });
  });

  it.each(['{"a":', '{a:1}', '', '{"a":1} extra'])('throws a plain Error for invalid input %j', (text) => {
    expect(() => parseJsonc(text)).toThrow(Error);
  });
});

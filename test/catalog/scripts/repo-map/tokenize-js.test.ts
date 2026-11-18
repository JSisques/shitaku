import { beforeAll, describe, expect, it } from 'vitest';
import { loadRepoMapModule, type Token, type TokenizeModule } from '@test/helpers/repo-map.js';

let tokenize: TokenizeModule['tokenize'];

beforeAll(async () => {
  tokenize = (await loadRepoMapModule<TokenizeModule>('tokenize-js.mjs')).tokenize;
});

const pairs = (source: string): [Token['type'], string][] => tokenize(source).map((t) => [t.type, t.value]);

describe('tokenize: token shape', () => {
  it('emits type, value, offsets, line and the gap flag', () => {
    expect(tokenize('const a = 1;')).toEqual([
      { type: 'ident', value: 'const', start: 0, end: 5, line: 1, gap: false },
      { type: 'ident', value: 'a', start: 6, end: 7, line: 1, gap: true },
      { type: 'punct', value: '=', start: 8, end: 9, line: 1, gap: true },
      { type: 'number', value: '1', start: 10, end: 11, line: 1, gap: true },
      { type: 'punct', value: ';', start: 11, end: 12, line: 1, gap: false },
    ]);
  });

  it('keeps offsets consistent with the source for every token', () => {
    const source = "import { a } from './x';\nexport const b = `t${a}`; // end\n";
    const tokens = tokenize(source);
    expect(tokens.length).toBeGreaterThan(10);
    for (const token of tokens) expect(source.slice(token.start, token.end)).toBe(token.value);
  });

  it('keeps arrow, spread and optional-chaining operators as single punct tokens', () => {
    expect(pairs('(a) => b?.c ...d')).toEqual([
      ['punct', '('],
      ['ident', 'a'],
      ['punct', ')'],
      ['punct', '=>'],
      ['ident', 'b'],
      ['punct', '?.'],
      ['ident', 'c'],
      ['punct', '...'],
      ['ident', 'd'],
    ]);
  });

  it('turns unknown characters into punct tokens', () => {
    expect(pairs('a @ #b \\ b')).toEqual([
      ['ident', 'a'],
      ['punct', '@'],
      ['punct', '#'],
      ['ident', 'b'],
      ['punct', '\\'],
      ['ident', 'b'],
    ]);
  });
});

describe('tokenize: comments', () => {
  it('does not emit line or block comments but flags the gap before the next token', () => {
    const tokens = tokenize('a/*x*/b//c\nd+e');
    expect(tokens.map((t) => [t.value, t.gap, t.line])).toEqual([
      ['a', false, 1],
      ['b', true, 1],
      ['d', true, 2],
      ['+', false, 2],
      ['e', false, 2],
    ]);
  });

  it('does not tokenize import-like text inside comments', () => {
    expect(pairs("// import x from 'y'\n/* require('z') */ ok")).toEqual([['ident', 'ok']]);
  });
});

describe('tokenize: strings and numbers', () => {
  it('reads quoted strings with escapes as raw single tokens', () => {
    expect(pairs(String.raw`'it\'s' "a\"b" 'x'`)).toEqual([
      ['string', String.raw`'it\'s'`],
      ['string', String.raw`"a\"b"`],
      ['string', "'x'"],
    ]);
  });

  it('reads decimal, hex, separator and exponent numbers', () => {
    expect(pairs('0x1F 1_000 1.5e+10 .5 7')).toEqual([
      ['number', '0x1F'],
      ['number', '1_000'],
      ['number', '1.5e+10'],
      ['number', '.5'],
      ['number', '7'],
    ]);
  });

  it('does not glue a minus sign onto a number without an exponent', () => {
    expect(pairs('1-2')).toEqual([
      ['number', '1'],
      ['punct', '-'],
      ['number', '2'],
    ]);
  });
});

describe('tokenize: template literals', () => {
  it('keeps a template without substitutions as one token', () => {
    expect(pairs('`a b`')).toEqual([['template', '`a b`']]);
  });

  it('splits a template around ${} and tokenizes the expression', () => {
    expect(pairs('`a${b}c`')).toEqual([
      ['template', '`a${'],
      ['ident', 'b'],
      ['template', '}c`'],
    ]);
  });

  it('handles nested templates through a mode stack', () => {
    expect(pairs('`a${`b${c}`}d`')).toEqual([
      ['template', '`a${'],
      ['template', '`b${'],
      ['ident', 'c'],
      ['template', '}`'],
      ['template', '}d`'],
    ]);
  });

  it('balances braces inside a substitution', () => {
    expect(pairs('`${ {a:1}.a }`')).toEqual([
      ['template', '`${'],
      ['punct', '{'],
      ['ident', 'a'],
      ['punct', ':'],
      ['number', '1'],
      ['punct', '}'],
      ['punct', '.'],
      ['ident', 'a'],
      ['template', '}`'],
    ]);
  });

  it('does not tokenize an escaped backtick or an escaped ${ as template structure', () => {
    const source = '`a\\`b\\${c}` d';
    expect(pairs(source)).toEqual([
      ['template', '`a\\`b\\${c}`'],
      ['ident', 'd'],
    ]);
  });

  it('keeps an unterminated template running to the end of the input', () => {
    expect(pairs('`abc')).toEqual([['template', '`abc']]);
  });
});

describe('tokenize: lines', () => {
  it('counts lines across comments and multi-line templates', () => {
    const tokens = tokenize('/*\n*/a\n`x\ny`\nb');
    expect(tokens.map((t) => [t.value, t.line])).toEqual([
      ['a', 2],
      ['`x\ny`', 3],
      ['b', 5],
    ]);
  });
});

describe('tokenize: robustness', () => {
  it('never throws and keeps tokens ordered on arbitrary input (fixed seed)', () => {
    const alphabet = [
      '`',
      '${',
      '}',
      '{',
      '/',
      '*',
      '\\',
      "'",
      '"',
      '\n',
      '\r\n',
      ' ',
      'a',
      'import',
      '1',
      '.',
      '(',
      ')',
      '$',
    ];
    let state = 0x9e3779b9;
    const next = (): number => {
      state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x1b873593) | 0;
      return (state >>> 0) / 0x100000000;
    };
    for (let round = 0; round < 400; round++) {
      let source = '';
      const length = Math.floor(next() * 60);
      for (let i = 0; i < length; i++) {
        source +=
          next() < 0.15
            ? String.fromCharCode(Math.floor(next() * 256))
            : (alphabet[Math.floor(next() * alphabet.length)] ?? '');
      }
      const tokens = tokenize(source);
      let previousEnd = 0;
      for (const token of tokens) {
        expect(token.start).toBeGreaterThanOrEqual(previousEnd);
        expect(token.end).toBeGreaterThan(token.start);
        expect(token.end).toBeLessThanOrEqual(source.length);
        expect(source.slice(token.start, token.end)).toBe(token.value);
        previousEnd = token.end;
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { readBlockMapping } from '@/domain/catalog/frontmatter.js';

/** Reads the block that follows `check:` in the given lines (the lines after the key). */
const read = (lines: string[], key = 'check') => readBlockMapping(lines, 0, key);

/** The issue text of a block that must be rejected; fails the test when it is accepted. */
const issueOf = (lines: string[], key = 'check'): string => {
  const result = read(lines, key);
  if (!('issue' in result)) throw new Error(`expected an issue, got ${JSON.stringify(result)}`);
  return result.issue;
};

describe('readBlockMapping values', () => {
  it.each([
    ['plain scalar', ['  type: pattern-absent'], { type: 'pattern-absent' }],
    ['plain scalar with spaces', ['  message: Use unknown instead'], { message: 'Use unknown instead' }],
    ['plain scalar keeping a colon without space', ['  pattern: a:b'], { pattern: 'a:b' }],
    ['plain scalar starting with a colon', ['  pattern: :\\s*any\\b'], { pattern: ':\\s*any\\b' }],
    ['single-quoted scalar', ["  files: 'src/**/*.ts'"], { files: 'src/**/*.ts' }],
    ['single-quoted doubled quote', ["  pattern: 'it''s'"], { pattern: "it's" }],
    ['single-quoted backslash is literal', ["  pattern: ':\\s*any\\b'"], { pattern: ':\\s*any\\b' }],
    ['single-quoted hash and colon-space', ["  message: 'a: b # c'"], { message: 'a: b # c' }],
    ['double-quoted scalar', ['  message: "plain"'], { message: 'plain' }],
    ['double-quoted escapes', ['  message: "a\\\\b\\"c\\/d\\ne\\tf"'], { message: 'a\\b"c/d\ne\tf' }],
    ['numeric scalar stays text', ['  max: 300'], { max: '300' }],
    ['plain trailing comment stripped', ['  message: Plain text # trailing comment'], { message: 'Plain text' }],
    ['single-quoted trailing comment', ["  pattern: 'todo' # why"], { pattern: 'todo' }],
    ['double-quoted trailing comment', ['  pattern: "todo" # why'], { pattern: 'todo' }],
    ['hash without a preceding space is kept', ['  pattern: a#b'], { pattern: 'a#b' }],
    ['value with trailing spaces trimmed', ['  type: max-lines   '], { type: 'max-lines' }],
  ])('reads a %s', (_title, lines, expected) => {
    expect(read(lines)).toEqual({ value: expected, next: lines.length });
  });

  it('reads several keys in order, skipping full-line comments and blank lines', () => {
    const lines = ['  type: pattern-absent', '', '  # a comment', '    ', "  files: 'src/**/*.ts'", '  max: 3'];
    expect(read(lines)).toEqual({
      value: { type: 'pattern-absent', files: 'src/**/*.ts', max: '3' },
      next: lines.length,
    });
  });

  it('accepts any consistent space indent greater than zero', () => {
    expect(read(['    type: tool', '    tool: commitlint'])).toEqual({
      value: { type: 'tool', tool: 'commitlint' },
      next: 2,
    });
  });
});

describe('readBlockMapping block sequences', () => {
  it.each([
    ['items indented under the key', ['  files:', "    - 'src/**/*.ts'", "    - 'lib/**/*.ts'"]],
    ['items at the key indent', ['  files:', "  - 'src/**/*.ts'", "  - 'lib/**/*.ts'"]],
  ])('reads a sequence with %s', (_title, lines) => {
    expect(read(lines)).toEqual({ value: { files: ['src/**/*.ts', 'lib/**/*.ts'] }, next: lines.length });
  });

  it('reads sequence items of every scalar form and keys after the sequence', () => {
    const lines = [
      '  sections:',
      '    - Usage',
      '    - "Why: now"',
      "    - 'It''s'",
      '    - Plain # note',
      '  type: x',
    ];
    expect(read(lines)).toEqual({
      value: { sections: ['Usage', 'Why: now', "It's", 'Plain'], type: 'x' },
      next: lines.length,
    });
  });

  it('skips comments and blank lines between items', () => {
    const lines = ['  files:', '    - a', '', '    # c', '    - b'];
    expect(read(lines)).toEqual({ value: { files: ['a', 'b'] }, next: lines.length });
  });
});

describe('readBlockMapping block end', () => {
  it('stops at the first top-level line and reports where to resume', () => {
    const lines = ['  type: tool', '  tool: commitlint', '', 'severity: warn', 'check2: x'];
    expect(read(lines)).toEqual({ value: { type: 'tool', tool: 'commitlint' }, next: 3 });
  });

  it('starts reading at the given index', () => {
    const lines = ['name: demo', 'check:', '  type: tool', 'severity: warn'];
    expect(readBlockMapping(lines, 2, 'check')).toEqual({ value: { type: 'tool' }, next: 3 });
  });
});

describe('readBlockMapping rejections', () => {
  it.each([
    ['a flow sequence', ['  files: [a, b]'], 'flow'],
    ['a flow mapping', ['  files: {a: b}'], 'flow'],
    ['an anchor', ['  files: &anchor x'], 'anchor'],
    ['an alias', ['  files: *anchor'], 'alias'],
    ['a tag', ['  files: !!str x'], 'tag'],
    ['a literal block scalar', ['  pattern: |', '    x'], 'block scalar'],
    ['a folded block scalar', ['  pattern: >', '    x'], 'block scalar'],
    ['a plain scalar starting with a percent sign', ['  pattern: %x'], 'indicator'],
    ['a plain scalar starting with a dash', ['  pattern: -x'], 'indicator'],
    ['a plain scalar containing a colon and space', ['  message: a: b'], 'colon'],
    ['a plain scalar ending with a colon', ['  message: a:'], 'colon'],
  ])('rejects %s naming the key and the line', (_title, lines, hint) => {
    const issue = issueOf(lines);
    expect(issue).toContain("'check'");
    expect(issue).toContain(lines[0]?.trim());
    expect(issue).toContain(hint);
  });

  it('rejects a multi-line plain scalar', () => {
    const issue = issueOf(['  message: first', '    second']);
    expect(issue).toContain('multi-line');
    expect(issue).toContain("'check'");
    expect(issue).toContain('second');
  });

  it('rejects nesting deeper than one level', () => {
    const issue = issueOf(['  files:', '    glob: a']);
    expect(issue).toContain('nested');
    expect(issue).toContain('glob: a');
  });

  it('rejects a duplicate key', () => {
    const issue = issueOf(['  type: a', '  type: b']);
    expect(issue).toContain('duplicate');
    expect(issue).toContain('type: b');
  });

  it.each([
    ['tab indentation', ['\ttype: a']],
    ['a tab inside the indent', [' \ttype: a']],
  ])('rejects %s', (_title, lines) => {
    expect(issueOf(lines)).toContain('tab');
  });

  it('rejects inconsistent indentation', () => {
    expect(issueOf(['    type: a', '  max: 3'])).toContain('indent');
  });

  it('rejects inconsistent sequence indentation', () => {
    expect(issueOf(['  files:', '    - a', '      - b'])).toContain('indent');
    expect(issueOf(['  files:', '    - a', '  - b'])).toContain('indent');
  });

  it('rejects a key that is not lowercase kebab-case', () => {
    expect(issueOf(['  Type: a'])).toContain('Type');
    expect(issueOf(['  ignore_case: a'])).toContain('ignore_case');
  });

  it('rejects a line that is not key: value', () => {
    expect(issueOf(['  just text'])).toContain('just text');
  });

  it('rejects a key with an empty value and no sequence', () => {
    expect(issueOf(['  files:', '  type: a'])).toContain("'files'");
  });

  it('rejects an empty sequence item', () => {
    expect(issueOf(['  files:', '    -'])).toContain('empty');
  });

  it.each([
    ['an unterminated single quote', ["  pattern: 'abc"]],
    ['an unterminated double quote', ['  pattern: "abc']],
    ['text after a closing single quote', ["  pattern: 'a' b"]],
    ['text after a closing double quote', ['  pattern: "a" b']],
  ])('rejects %s', (_title, lines) => {
    expect(issueOf(lines)).toContain(lines[0]?.trim());
  });

  it('rejects a double-quoted \\s escape and advises single quotes', () => {
    const issue = issueOf(['  pattern: "\\s*any"']);
    expect(issue).toContain('single quotes');
    expect(issue).toContain("'check'");
  });

  it('names the key given by the caller', () => {
    expect(issueOf(['  files: [a]'], 'other')).toContain("'other'");
  });
});

describe('readBlockMapping empty block', () => {
  it.each([
    ['no lines at all', []],
    ['only blank lines and comments', ['', '  # nothing', '   ']],
    ['a top-level line right away', ['severity: warn']],
  ])('reports an issue naming the key for %s', (_title, lines) => {
    const issue = issueOf(lines);
    expect(issue).toContain("'check'");
    expect(issue).toContain('empty');
  });
});

describe('readBlockMapping YAML equivalence', () => {
  it.each([
    ["'it''s'", "it's"],
    ['"a\\tb"', 'a\tb'],
    ['plain # comment', 'plain'],
    ['a#b', 'a#b'],
    ["'a # b'", 'a # b'],
  ])('decodes %s as %j, like a YAML 1.2 parser', (source, expected) => {
    expect(read([`  value: ${source}`])).toEqual({ value: { value: expected }, next: 1 });
  });
});

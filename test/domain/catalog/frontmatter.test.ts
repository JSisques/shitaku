import { describe, expect, it } from 'vitest';
import { readFrontmatter } from '@/domain/catalog/frontmatter.js';

describe('readFrontmatter', () => {
  it('reads single-line keys, unquotes values and returns the body', () => {
    const text = '---\nname: demo\ndescription: "Quoted: value"\nargument-hint: [path]\n---\n# Body\n';
    expect(readFrontmatter(text, 'X.md')).toEqual({
      data: { name: 'demo', description: 'Quoted: value', 'argument-hint': '[path]' },
      body: '# Body\n',
    });
  });

  it('accepts CRLF line endings', () => {
    expect(readFrontmatter('---\r\ndescription: a\r\n---\r\nbody', 'X.md')).toEqual({
      data: { description: 'a' },
      body: 'body',
    });
  });

  it.each([
    ['no block', '# just a body'],
    ['an unclosed block', '---\ndescription: a\n# body'],
  ])('reports %s against the given file', (_title, text) => {
    expect(readFrontmatter(text, 'review.md')).toEqual({
      issue: 'review.md has no frontmatter block',
      file: 'review.md',
    });
  });

  it('rejects a multi-line value', () => {
    expect(readFrontmatter('---\ndescription: >\n  long\n---\nbody', 'X.md')).toEqual({
      issue: "frontmatter key 'description' has a multi-line or empty value",
      file: 'X.md',
    });
    expect(readFrontmatter('---\ndescription: a\n  more\n---\nbody', 'X.md')).toEqual({
      issue: 'frontmatter has a multi-line value, only single-line values are supported',
      file: 'X.md',
    });
  });

  it('ignores blank and whitespace-only lines between keys', () => {
    expect(readFrontmatter('---\nname: a\n\n   \ndescription: b\n---\nbody', 'X.md')).toEqual({
      data: { name: 'a', description: 'b' },
      body: 'body',
    });
  });

  it.each(['|2', '| # c'])('keeps %s as a plain scalar in strict mode', (value) => {
    expect(readFrontmatter(`---\ndescription: ${value}\n---\nbody`, 'X.md')).toEqual({
      data: { description: value },
      body: 'body',
    });
  });

  it('keeps the multi-line message for a blank line followed by an indented line', () => {
    expect(readFrontmatter('---\ndescription: a\n\n  more\n---\nbody', 'X.md')).toEqual({
      issue: 'frontmatter has a multi-line value, only single-line values are supported',
      file: 'X.md',
    });
  });

  it('rejects a line that is not key: value', () => {
    expect(readFrontmatter('---\nnonsense\n---\nbody', 'X.md')).toEqual({
      issue: "frontmatter line is not 'key: value': nonsense",
      file: 'X.md',
    });
  });
});

describe('readFrontmatter nested mode', () => {
  const nested = { allowNested: true } as const;

  it('keeps strict mode unchanged when the option is absent or false', () => {
    const text = '---\nname: a\ntools:\n  - Read\n---\nbody';
    const expected = { issue: "frontmatter key 'tools' has a multi-line or empty value", file: 'a.md' };
    expect(readFrontmatter(text, 'a.md')).toEqual(expected);
    expect(readFrontmatter(text, 'a.md', { allowNested: false })).toEqual(expected);
  });

  it('reads scalars and returns an empty opaque list when there is no nested key', () => {
    expect(readFrontmatter('---\nname: a\ndescription: "d"\n---\nbody', 'a.md', nested)).toEqual({
      data: { name: 'a', description: 'd' },
      opaque: [],
      body: 'body',
    });
  });

  it.each([
    ['a tools list', 'tools:\n  - Read\n  - Edit', ['tools']],
    ['an mcpServers map', 'mcpServers:\n  fs:\n    command: npx\n    args: ["a"]', ['mcpServers']],
    ['an empty value', 'model:', ['model']],
  ])('treats %s as opaque and keeps it out of data', (_title, block, opaque) => {
    const result = readFrontmatter(`---\nname: a\n${block}\ncolor: red\n---\nbody`, 'a.md', nested);
    expect(result).toEqual({ data: { name: 'a', color: 'red' }, opaque, body: 'body' });
  });

  const decode = (block: string, key = 'description') => {
    const result = readFrontmatter(`---\nname: a\n${key}: ${block}\n---\nbody`, 'a.md', nested);
    return 'issue' in result ? result : { value: result.data[key], opaque: result.opaque };
  };

  it.each([
    ['literal clip', '|\n  line one\n  line two', 'line one\nline two\n'],
    ['folded strip', '>-\n  folded\n  text', 'folded text'],
    ['folded paragraph', '>\n  a\n  b\n\n  c', 'a b\nc\n'],
    ['folded more-indented', '>\n  a\n    code\n  b', 'a\n  code\nb\n'],
    ['literal keep', '|+\n  a\n', 'a\n\n'],
    ['literal strip', '|-\n  a\n', 'a'],
    ['indent indicator', '|2\n    lead\n  b', '  lead\nb\n'],
    ['inner blank line', '|\n  a\n\n  b', 'a\n\nb\n'],
    ['header comment', '| # note\n  a', 'a\n'],
    ['indicator then chomp', '|2-\n  a', 'a'],
    ['chomp then indicator', '|-2\n  a', 'a'],
    ['hash content line', '|\n  # not a comment', '# not a comment\n'],
  ])('decodes %s into data, not opaque', (_title, block, value) => {
    expect(decode(block)).toEqual({ value, opaque: [] });
  });

  it('decodes an empty block header followed by the next key to an empty value', () => {
    expect(readFrontmatter('---\ndescription: |\nmodel: sonnet\n---\nb', 'a.md', nested)).toEqual({
      data: { description: '', model: 'sonnet' },
      opaque: [],
      body: 'b',
    });
  });

  it('decodes a header with no content at the end of the block', () => {
    expect(readFrontmatter('---\nmodel: x\ndescription: >\n---\nb', 'a.md', nested)).toMatchObject({
      data: { model: 'x', description: '' },
    });
  });

  it('decodes CRLF blocks with newlines only and stops at the next top-level key', () => {
    const text = '---\r\ndescription: |\r\n  a\r\n  b\r\nmodel: sonnet\r\n---\r\nbody';
    expect(readFrontmatter(text, 'a.md', nested)).toEqual({
      data: { description: 'a\nb\n', model: 'sonnet' },
      opaque: [],
      body: 'body',
    });
  });

  it.each([
    ['as the first content indent', '|\n\ta'],
    ['after content started', '|\n  a\n\tb'],
  ])('reports a tab %s', (_title, block) => {
    expect(decode(block)).toEqual({
      issue: "frontmatter key 'description' has a block scalar indented with a tab",
      file: 'a.md',
    });
  });

  it('reports a less-indented line after a block as having no owning key', () => {
    expect(decode('|\n    a\n  b')).toMatchObject({ issue: expect.stringContaining('no owning key') as string });
  });

  it.each(['|#x', '|0'])('keeps %s as a plain scalar', (value) => {
    expect(decode(value)).toEqual({ value, opaque: [] });
  });

  it('collects several opaque keys in order', () => {
    const result = readFrontmatter('---\ntools:\n  - A\nname: a\nhooks:\n  x: y\n---\nb', 'a.md', nested);
    expect(result).toMatchObject({ data: { name: 'a' }, opaque: ['tools', 'hooks'] });
  });

  it('reports an indented line with no owning key', () => {
    expect(readFrontmatter('---\n  orphan: 1\nname: a\n---\nb', 'a.md', nested)).toEqual({
      issue: 'frontmatter has an indented line with no owning key: "  orphan: 1"',
      file: 'a.md',
    });
  });

  it('does not let a scalar key own following indented lines', () => {
    expect(readFrontmatter('---\nname: a\n  stray\n---\nb', 'a.md', nested)).toMatchObject({
      issue: expect.stringContaining('no owning key') as string,
    });
  });

  it('rejects a top-level line that is not key: value', () => {
    expect(readFrontmatter('---\nnot a pair\n---\nb', 'a.md', nested)).toEqual({
      issue: "frontmatter line is not 'key: value': not a pair",
      file: 'a.md',
    });
  });

  it('accepts CRLF line endings', () => {
    expect(readFrontmatter('---\r\nname: a\r\ntools:\r\n  - Read\r\n---\r\nbody', 'a.md', nested)).toEqual({
      data: { name: 'a' },
      opaque: ['tools'],
      body: 'body',
    });
  });

  it.each([
    ['no block', '# body'],
    ['an unclosed block', '---\nname: a\n# body'],
  ])('still rejects %s', (_title, text) => {
    expect(readFrontmatter(text, 'a.md', nested)).toEqual({ issue: 'a.md has no frontmatter block', file: 'a.md' });
  });
});

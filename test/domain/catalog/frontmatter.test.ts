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

  it('rejects a line that is not key: value', () => {
    expect(readFrontmatter('---\nnonsense\n---\nbody', 'X.md')).toEqual({
      issue: "frontmatter line is not 'key: value': nonsense",
      file: 'X.md',
    });
  });
});

describe('readFrontmatter nested mode', () => {
  const nested = { allowNested: true };

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
    ['a literal block', 'description: |\n  line one\n  line two', ['description']],
    ['a folded block', 'description: >-\n  folded\n  text', ['description']],
    ['an empty value', 'model:', ['model']],
  ])('treats %s as opaque and keeps it out of data', (_title, block, opaque) => {
    const result = readFrontmatter(`---\nname: a\n${block}\ncolor: red\n---\nbody`, 'a.md', nested);
    expect(result).toEqual({ data: { name: 'a', color: 'red' }, opaque, body: 'body' });
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

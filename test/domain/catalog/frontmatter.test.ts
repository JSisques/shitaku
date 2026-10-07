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

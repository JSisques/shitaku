import { describe, expect, it } from 'vitest';
import { CommandNameSchema, parseCommand } from '@/domain/catalog/command.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const valid = '---\ndescription: Review a diff\nargument-hint: [path]\n---\n\nReview $ARGUMENTS\n';
const issueOf = (r: ReturnType<typeof parseCommand>): string => ('issue' in r ? r.issue : '');

describe('CommandNameSchema', () => {
  it.each(['review', 'a1', 'code-review'])('accepts %s', (name) => {
    expect(CommandNameSchema.parse(name)).toBe(name);
  });

  it.each(['Review', '-x', 'a_b'])('rejects %s, naming it', (name) => {
    const res = CommandNameSchema.safeParse(name);
    expect(res.success ? '' : res.error.issues[0]?.message).toBe(`invalid command name '${name}'`);
  });
});

describe('parseCommand', () => {
  it('parses a valid command and keeps the original bytes, including passthrough keys', () => {
    const bytes = enc(valid);
    const result = parseCommand('review', bytes);
    expect(result).toEqual({ command: { name: 'review', description: 'Review a diff', bytes } });
  });

  it('rejects an invalid name', () => {
    expect(issueOf(parseCommand('Review', enc(valid)))).toBe("invalid command name 'Review'");
  });

  it.each([
    ['frontmatter has no description', '---\nargument-hint: x\n---\nbody'],
    ['the description is blank', '---\ndescription:    \n---\nbody'],
    ['the quoted description is whitespace', '---\ndescription: "  "\n---\nbody'],
  ])('rejects the command when %s, naming description', (_title, text) => {
    expect(issueOf(parseCommand('review', enc(text)))).toContain('description');
  });

  it('rejects missing frontmatter and multi-line values', () => {
    expect(issueOf(parseCommand('review', enc('# body only')))).toContain('no frontmatter block');
    expect(issueOf(parseCommand('review', enc('---\ndescription: >\n  long\n---\nbody')))).toContain('multi-line');
  });

  it.each(['---\ndescription: a\n---\n', '---\ndescription: a\n---\n  \n\n'])('rejects an empty body', (text) => {
    expect(issueOf(parseCommand('review', enc(text)))).toBe('command body is empty');
  });
});

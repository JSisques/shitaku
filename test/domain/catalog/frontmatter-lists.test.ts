import { describe, expect, it } from 'vitest';
import { readFrontmatter } from '@/domain/catalog/frontmatter.js';

const frontmatter = (lines: string[]): string => ['---', ...lines, '---', 'body'].join('\n');

const read = (lines: string[]): ReturnType<typeof readFrontmatter> =>
  readFrontmatter(frontmatter(lines), 'agent.md', { allowNested: true, lists: ['skills'] });

/** The parsed `skills` list, or the issue text when the reader rejects the frontmatter. */
const skillsOf = (lines: string[]): string[] | string | undefined => {
  const result = read(lines);
  if ('issue' in result) return result.issue;
  return 'lists' in result ? result.lists['skills'] : undefined;
};

describe('readFrontmatter lists option: accepted forms', () => {
  it.each<[string, string[], string[]]>([
    ['block form at column 0', ['skills:', '- a', '- b'], ['a', 'b']],
    ['block form at two-space indent', ['skills:', '  - a', '  - b'], ['a', 'b']],
    ['block form at four-space indent', ['skills:', '    - a', '    - b'], ['a', 'b']],
    ['block items plain, single-quoted and double-quoted', ['skills:', '  - a', "  - 'b'", '  - "c"'], ['a', 'b', 'c']],
    ['a single-quoted item with an escaped quote', ['skills:', "  - 'it''s'"], ["it's"]],
    [
      'block comments and blank lines between items',
      ['skills:', '  # first', '  - a', '', '  # second', '  - b'],
      ['a', 'b'],
    ],
    ['a trailing comment on an item', ['skills:', '  - a # note'], ['a']],
    ['a trailing comment on the key', ['skills: # which skills', '  - a'], ['a']],
    ['an empty key followed by another key', ['skills:', 'model: sonnet'], []],
    ['an empty key at the end of the block', ['model: sonnet', 'skills:'], []],
    ['column 0 items followed by another key', ['skills:', '- a', 'model: sonnet'], ['a']],
    ['inline flow list', ['skills: [a, b]'], ['a', 'b']],
    ['inline flow with quotes, spacing and a trailing comma', ['skills: [ \'a\', "b" , c, ]'], ['a', 'b', 'c']],
    ['inline flow with a comma inside a quoted item', ["skills: ['a,b', c]"], ['a,b', 'c']],
    ['inline flow with an escaped double quote', ['skills: ["a\\"b"]'], ['a"b']],
    ['empty inline flow', ['skills: []'], []],
    ['empty inline flow with a space', ['skills: [ ]'], []],
    ['inline flow with a trailing comment', ['skills: [a, b] # needed'], ['a', 'b']],
    ['inline flow with a single item', ['skills: [a]'], ['a']],
    ['duplicates are returned as written', ['skills: [a, b, a]'], ['a', 'b', 'a']],
  ])('reads %s', (_title, lines, expected) => {
    expect(skillsOf(lines)).toEqual(expected);
  });

  it('reads the block form and the flow form of the same items identically', () => {
    expect(skillsOf(['skills:', '  - docs-writing', '  - pr-writing'])).toEqual(
      skillsOf(['skills: [docs-writing, pr-writing]']),
    );
  });

  it('keeps the listed key out of data and opaque', () => {
    const result = read(['name: x', 'skills: [a]', 'model: sonnet']);
    expect(result).toMatchObject({ data: { name: 'x', model: 'sonnet' }, opaque: [], lists: { skills: ['a'] } });
    expect(result).not.toHaveProperty('data.skills');
  });

  it('omits a listed key that is absent from the frontmatter', () => {
    const result = read(['name: x']);
    expect(result).toMatchObject({ data: { name: 'x' }, opaque: [], lists: {} });
    expect(result).not.toHaveProperty('lists.skills');
  });

  it('coexists with opaque tools and hooks keys', () => {
    const result = read(['tools:', '  - Read', 'hooks:', '  PreToolUse:', '    - x: y', 'skills: [a]']);
    expect(result).toMatchObject({ opaque: ['tools', 'hooks'], lists: { skills: ['a'] } });
  });

  it('coexists with the mappings option', () => {
    const text = frontmatter(['check:', '  type: pattern-absent', 'skills:', '  - a']);
    const result = readFrontmatter(text, 'rule.md', { allowNested: true, lists: ['skills'], mappings: ['check'] });
    expect(result).toMatchObject({ maps: { check: { type: 'pattern-absent' } }, lists: { skills: ['a'] }, opaque: [] });
  });

  it('keeps reading keys that follow a block list', () => {
    const result = read(['skills:', '  - a', 'description: |', '  text', 'model: opus']);
    expect(result).toMatchObject({ data: { description: 'text\n', model: 'opus' }, lists: { skills: ['a'] } });
  });
});

describe('readFrontmatter lists option: rejected forms', () => {
  it.each<[string, string[], string]>([
    ['a nested mapping', ['skills:', '  docs: yes'], 'docs: yes'],
    ['a mapping item', ['skills:', '  - docs: yes'], '- docs: yes'],
    ['a nested flow item', ['skills: [[a]]'], 'skills: [[a]]'],
    ['a nested flow item in block form', ['skills:', '  - [a]'], '- [a]'],
    ['a literal block scalar', ['skills: |', '  a'], 'skills: |'],
    ['a folded block scalar', ['skills: >', '  a'], 'skills: >'],
    ['a plain scalar', ['skills: foo'], 'skills: foo'],
    ['a comma-separated plain scalar', ['skills: a, b'], 'skills: a, b'],
    ['an unclosed flow list', ['skills: [a, b'], 'skills: [a, b'],
    ['trailing text after the flow list', ['skills: [a] x'], 'skills: [a] x'],
    ['a comment glued to the flow list', ['skills: [a]# x'], 'skills: [a]# x'],
    ['an empty flow item', ['skills: [a,,b]'], 'skills: [a,,b]'],
    ['a double trailing comma', ['skills: [a,,]'], 'skills: [a,,]'],
    ['a leading comma', ['skills: [,a]'], 'skills: [,a]'],
    ['a lone comma', ['skills: [,]'], 'skills: [,]'],
    ['text after a quoted flow item', ["skills: ['a' x]"], "skills: ['a' x]"],
    ['a colon and space inside a plain flow item', ['skills: [a: b]'], 'skills: [a: b]'],
    ['a bare dash', ['skills:', '  -'], '-'],
    ['a dash with only a comment', ['skills:', '  - # nothing'], '- # nothing'],
    ['an anchor item', ['skills:', '  - &a x'], '- &a x'],
    ['an alias item', ['skills:', '  - *a'], '- *a'],
    ['a tag item', ['skills:', '  - !t x'], '- !t x'],
    ['an unterminated single-quoted item', ['skills:', "  - 'a"], "- 'a"],
    ['an unterminated quoted flow item', ["skills: ['a]"], "skills: ['a]"],
    ['a tab-indented item', ['skills:', '\t- a'], '- a'],
    ['mixed item indents', ['skills:', '  - a', '    - b'], '- b'],
    ['items at column 0 after indented ones', ['skills:', '  - a', '- b'], '- b'],
    ['an indented non-item line after the items', ['skills:', '  - a', '  note: x'], 'note: x'],
  ])('rejects %s, naming the key and the line', (_title, lines, offending) => {
    const issue = skillsOf(lines);
    expect(typeof issue).toBe('string');
    expect(issue).toContain("frontmatter key 'skills'");
    expect(issue).toContain(offending);
  });

  it.each<[string, string[]]>([
    ['block item', ['skills:', '  - "a\\sb"']],
    ['flow item', ['skills: ["a\\sb"]']],
  ])('advises single quotes for an unsupported double-quote escape in a %s', (_title, lines) => {
    const issue = skillsOf(lines);
    expect(issue).toContain("frontmatter key 'skills'");
    expect(issue).toContain('use single quotes');
  });

  it('rejects a duplicate listed key, whatever the forms', () => {
    const issue = skillsOf(['skills: [a]', 'model: x', 'skills:', '  - b']);
    expect(issue).toContain("frontmatter key 'skills'");
    expect(issue).toContain('more than once');
  });

  it('never falls back to opaque for a malformed listed key', () => {
    expect(read(['skills: foo'])).toHaveProperty('issue');
  });
});

describe('readFrontmatter lists option: unchanged behavior without the option', () => {
  it('keeps default strict mode rejecting a multi-line skills list', () => {
    const result = readFrontmatter(frontmatter(['skills:', '  - a']), 'skill.md');
    expect(result).toEqual({
      issue: "frontmatter key 'skills' has a multi-line or empty value",
      file: 'skill.md',
    });
  });

  it('keeps default strict mode ignoring lists semantics for an inline list value', () => {
    expect(readFrontmatter(frontmatter(['skills: [a, b]']), 'skill.md')).toEqual({
      data: { skills: '[a, b]' },
      body: 'body',
    });
  });

  it('keeps allowNested without lists reporting a nested skills list as opaque, with no lists key', () => {
    const result = readFrontmatter(frontmatter(['skills:', '  - a']), 'agent.md', { allowNested: true });
    expect(result).toEqual({ data: {}, opaque: ['skills'], body: 'body' });
    expect(result).not.toHaveProperty('lists');
  });

  it('keeps an inline skills value in data when lists is not requested', () => {
    const result = readFrontmatter(frontmatter(['skills: [a]']), 'agent.md', { allowNested: true });
    expect(result).toEqual({ data: { skills: '[a]' }, opaque: [], body: 'body' });
  });

  it('keeps a mappings-only call free of a lists key', () => {
    const text = frontmatter(['check:', '  type: pattern-absent', 'skills:', '  - a']);
    const result = readFrontmatter(text, 'rule.md', { allowNested: true, mappings: ['check'] });
    expect(result).toEqual({
      data: {},
      opaque: ['skills'],
      maps: { check: { type: 'pattern-absent' } },
      body: 'body',
    });
  });

  it('keeps the mappings error messages when lists is also requested', () => {
    const text = frontmatter(['check:', '  files: [a]']);
    const withLists = readFrontmatter(text, 'rule.md', { allowNested: true, lists: ['skills'], mappings: ['check'] });
    const without = readFrontmatter(text, 'rule.md', { allowNested: true, mappings: ['check'] });
    expect(withLists).toEqual(without);
    expect(withLists).toHaveProperty('issue');
  });
});

import { describe, expect, it } from 'vitest';
import { AgentNameSchema, parseAgent } from '@/domain/catalog/agent.js';
import { REVIEWER } from '@test/helpers/agents.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const valid = '---\nname: reviewer\ndescription: Reviews diffs\nmodel: sonnet\n---\n\nYou review code.\n';
const issueOf = (r: ReturnType<typeof parseAgent>): string => ('issue' in r ? r.issue : '');

describe('AgentNameSchema', () => {
  it.each(['reviewer', 'reviewer2', 'code-review'])('accepts %s', (name) => {
    expect(AgentNameSchema.parse(name)).toBe(name);
  });

  it.each(['Reviewer', '-x', 'a_b'])('rejects %s, naming it', (name) => {
    const res = AgentNameSchema.safeParse(name);
    expect(res.success ? '' : res.error.issues[0]?.message).toBe(`invalid agent name '${name}'`);
  });
});

describe('parseAgent', () => {
  it('accepts the shared builder output', () => {
    expect(parseAgent('reviewer', REVIEWER.bytes)).toEqual({ agent: REVIEWER });
  });

  it('parses a valid agent and keeps the original bytes, including unknown keys', () => {
    const bytes = enc(valid);
    expect(parseAgent('reviewer', bytes)).toEqual({
      agent: { name: 'reviewer', description: 'Reviews diffs', skills: [], bytes },
    });
  });

  describe('skills', () => {
    const withSkills = (...lines: string[]): string =>
      ['---', 'name: reviewer', 'description: d', ...lines, '---', 'body'].join('\n');
    const skillsOf = (text: string): string[] | string => {
      const result = parseAgent('reviewer', enc(text));
      return 'agent' in result ? result.agent.skills : result.issue;
    };

    it('reads the same list from the block form and the flow form', () => {
      const block = skillsOf(withSkills('skills:', '  - docs-writing', '  - pr-writing'));
      const flow = skillsOf(withSkills('skills: [docs-writing, pr-writing]'));
      expect(block).toEqual(['docs-writing', 'pr-writing']);
      expect(flow).toEqual(block);
    });

    it('is empty when the key is absent', () => {
      expect(skillsOf(withSkills('model: sonnet'))).toEqual([]);
    });

    it.each([['skills:'], ['skills: []']])('is empty for %s', (line) => {
      expect(skillsOf(withSkills(line, 'model: sonnet'))).toEqual([]);
    });

    it('keeps the first occurrence of a duplicate name', () => {
      expect(skillsOf(withSkills('skills: [a, b, a]'))).toEqual(['a', 'b']);
    });

    it('does not validate names against anything', () => {
      expect(skillsOf(withSkills('skills: [not-in-catalog, ../evil, Foo]'))).toEqual([
        'not-in-catalog',
        '../evil',
        'Foo',
      ]);
    });

    it.each([['skills: foo'], ['skills: a, b'], ['skills:\n  docs: yes'], ['skills: [a,,b]']])(
      'rejects a malformed value (%j), naming the key',
      (lines) => {
        const issue = skillsOf(withSkills(lines));
        expect(issue).toContain("frontmatter key 'skills'");
      },
    );

    it.each([
      ['block form', ['skills:', '  - a', '  - b']],
      ['flow form', ["skills: [a, 'b']"]],
    ])('keeps the bytes verbatim for a %s', (_title, lines) => {
      const bytes = enc(withSkills(...lines));
      const result = parseAgent('reviewer', bytes);
      expect('agent' in result && result.agent.bytes).toBe(bytes);
    });
  });

  it('rejects an invalid stem', () => {
    expect(issueOf(parseAgent('Reviewer', enc(valid)))).toBe("invalid agent name 'Reviewer'");
  });

  it.each([
    ['name is missing', '---\ndescription: d\n---\nbody', 'name'],
    ['name is whitespace', '---\nname:    \ndescription: d\n---\nbody', 'name'],
    ['description is missing', '---\nname: reviewer\n---\nbody', 'description'],
    ['description is whitespace', '---\nname: reviewer\ndescription: "  "\n---\nbody', 'description'],
  ])('rejects when %s', (_title, text, key) => {
    expect(issueOf(parseAgent('reviewer', enc(text)))).toContain(key);
  });

  it('rejects a name that differs from the file stem', () => {
    expect(issueOf(parseAgent('reviewer', enc('---\nname: other\ndescription: d\n---\nbody')))).toBe(
      "frontmatter name 'other' must equal the file name 'reviewer'",
    );
  });

  it.each(['name', 'description'])('rejects a nested %s as neither single-line nor block scalar', (key) => {
    const other = key === 'name' ? 'description: d' : 'name: reviewer';
    const text = `---\n${other}\n${key}:\n  - a\n---\nbody`;
    expect(issueOf(parseAgent('reviewer', enc(text)))).toBe(
      `key '${key}' must be a single-line or block scalar (| or >) value`,
    );
  });

  const withDescription = (description: string): string =>
    `---\nname: reviewer\ndescription: ${description}\n---\nbody`;
  const descriptionOf = (text: string): string | undefined => {
    const result = parseAgent('reviewer', enc(text));
    return 'agent' in result ? result.agent.description : issueOf(result);
  };

  it.each([
    ['folded paragraphs', '>\n  Reviews code.\n\n  Be strict.\n  Be kind.', 'Reviews code. Be strict. Be kind.'],
    ['literal strip', '|-\n  line one\n  line two', 'line one line two'],
    ['literal keep', '|+\n  line one\n\n', 'line one'],
    ['indent indicator', '|2\n    lead\n  tail', 'lead tail'],
    ['a single-line value with inner runs', '"a   b"', 'a b'],
  ])('collapses a %s description to one line', (_title, value, expected) => {
    expect(descriptionOf(withDescription(value))).toBe(expected);
  });

  it('loads a block-scalar name equal to the stem', () => {
    const result = parseAgent('reviewer', enc('---\nname: >-\n  reviewer\ndescription: d\n---\nbody'));
    expect(result).toMatchObject({ agent: { name: 'reviewer' } });
  });

  it('rejects a block-scalar name that differs from the stem', () => {
    expect(issueOf(parseAgent('reviewer', enc('---\nname: |\n  other\ndescription: d\n---\nbody')))).toBe(
      "frontmatter name 'other' must equal the file name 'reviewer'",
    );
  });

  it.each(['|', '|+\n\n', '>-\n   '])('rejects an empty or whitespace-only block description (%j)', (value) => {
    expect(descriptionOf(withDescription(value))).toBe('description: frontmatter key is required');
  });

  it('keeps the bytes of a block-scalar agent verbatim', () => {
    const bytes = enc(withDescription('>\n  folded\n  text'));
    const result = parseAgent('reviewer', bytes);
    expect('agent' in result && result.agent.bytes).toBe(bytes);
  });

  it.each(['---\nname: reviewer\ndescription: d\n---\n', '---\nname: reviewer\ndescription: d\n---\n \n\n'])(
    'rejects an empty body',
    (text) => {
      expect(issueOf(parseAgent('reviewer', enc(text)))).toBe('agent body is empty');
    },
  );

  it('accepts nested YAML (tools, hooks) and unknown keys, preserving bytes verbatim', () => {
    const bytes = enc(
      '---\nname: reviewer\ndescription: d\ntools:\n  - Read\n  - Grep\nhooks:\n  PreToolUse:\n    - x: y\nfuture-key: 1\n---\nbody\n',
    );
    const result = parseAgent('reviewer', bytes);
    expect('agent' in result && result.agent.bytes).toBe(bytes);
  });

  it('rejects missing frontmatter', () => {
    expect(issueOf(parseAgent('reviewer', enc('# body')))).toContain('no frontmatter block');
  });
});

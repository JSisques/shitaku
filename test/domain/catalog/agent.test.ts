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
    expect(parseAgent('reviewer', bytes)).toEqual({ agent: { name: 'reviewer', description: 'Reviews diffs', bytes } });
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

  it.each(['name', 'description'])('rejects an opaque %s as not single-line', (key) => {
    const other = key === 'name' ? 'description: d' : 'name: reviewer';
    const text = `---\n${other}\n${key}:\n  - a\n---\nbody`;
    expect(issueOf(parseAgent('reviewer', enc(text)))).toBe(`key '${key}' must be a single-line value`);
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

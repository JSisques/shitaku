import { describe, expect, it } from 'vitest';
import { RESERVED_RULE_KEYS, RuleNameSchema, parseRule } from '@/domain/catalog/rule.js';
import { ruleBytes, ruleItem } from '@test/helpers/rules.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const valid = '---\nname: no-secrets\ndescription: Never write secrets\n---\n\nKeep secrets out.\n';
const issueOf = (r: ReturnType<typeof parseRule>): string => ('issue' in r ? r.issue : '');

describe('RuleNameSchema', () => {
  it.each(['naming', 'rule2', 'no-secrets'])('accepts %s', (name) => {
    expect(RuleNameSchema.parse(name)).toBe(name);
  });

  it.each(['Naming', '-x', 'a_b'])('rejects %s, naming it', (name) => {
    const res = RuleNameSchema.safeParse(name);
    expect(res.success ? '' : res.error.issues[0]?.message).toBe(`invalid rule name '${name}'`);
  });
});

describe('parseRule', () => {
  it('accepts the shared builder output, not recommended by default', () => {
    expect(parseRule('naming', ruleItem('naming').bytes)).toEqual({ rule: ruleItem('naming') });
  });

  it('parses a valid rule and keeps the original bytes', () => {
    const bytes = enc(valid);
    expect(parseRule('no-secrets', bytes)).toEqual({
      rule: { name: 'no-secrets', description: 'Never write secrets', bytes, recommended: false },
    });
  });

  it('rejects an invalid stem', () => {
    expect(issueOf(parseRule('Naming', enc(valid)))).toBe("invalid rule name 'Naming'");
  });

  it('accepts a stem with digits', () => {
    expect('rule' in parseRule('rule2', ruleBytes('rule2'))).toBe(true);
  });

  it.each([
    ['name is missing', '---\ndescription: d\n---\nbody', 'name'],
    ['name is whitespace', '---\nname:    \ndescription: d\n---\nbody', 'name'],
    ['description is missing', '---\nname: x\n---\nbody', 'description'],
    ['description is whitespace', '---\nname: x\ndescription: "  "\n---\nbody', 'description'],
  ])('rejects when %s', (_title, text, key) => {
    expect(issueOf(parseRule('x', enc(text)))).toContain(key);
  });

  it('rejects a name that differs from the file stem', () => {
    expect(issueOf(parseRule('x', enc('---\nname: other\ndescription: d\n---\nbody')))).toBe(
      "frontmatter name 'other' must equal the file name 'x'",
    );
  });

  it.each(['name', 'description'])('rejects an opaque %s as not single-line', (key) => {
    const other = key === 'name' ? 'description: d' : 'name: x';
    expect(issueOf(parseRule('x', enc(`---\n${other}\n${key}:\n  - a\n---\nbody`)))).toBe(
      `key '${key}' must be a single-line value`,
    );
  });

  it.each(['---\nname: x\ndescription: d\n---\n', '---\nname: x\ndescription: d\n---\n \n\n'])(
    'rejects an empty body',
    (text) => {
      expect(issueOf(parseRule('x', enc(text)))).toBe('rule body is empty');
    },
  );

  it('rejects a file with no frontmatter', () => {
    expect(issueOf(parseRule('x', enc('# body only\n')))).toContain('no frontmatter');
  });

  it('accepts a scalar paths key', () => {
    expect('rule' in parseRule('x', ruleBytes('x', ['paths: "src/**/*.ts"']))).toBe(true);
  });

  it('accepts a nested paths list and unknown keys, bytes verbatim', () => {
    const bytes = ruleBytes('x', ['paths:', '  - "src/**"', '  - "test/**"', 'futurefield: 1']);
    const res = parseRule('x', bytes);
    expect('rule' in res && res.rule.bytes).toEqual(bytes);
    expect('rule' in res && res.rule.description).toBe('x rule');
  });

  it('reserves exactly check and severity', () => {
    expect([...RESERVED_RULE_KEYS]).toEqual(['check', 'severity']);
  });

  it.each(['check', 'severity'])('rejects the reserved key %s', (key) => {
    expect(issueOf(parseRule('x', ruleBytes('x', [`${key}: high`])))).toBe(
      `key '${key}' is reserved for rule checks (see #288)`,
    );
  });

  it('rejects a reserved key even when its value is nested', () => {
    expect(issueOf(parseRule('x', ruleBytes('x', ['check:', '  run: ls'])))).toBe(
      "key 'check' is reserved for rule checks (see #288)",
    );
  });
});

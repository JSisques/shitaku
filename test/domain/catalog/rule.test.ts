import { describe, expect, it } from 'vitest';
import { RuleNameSchema, parseRule } from '@/domain/catalog/rule.js';
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

  describe('check and severity', () => {
    const check = ['check:', '  type: pattern-absent', "  files: 'src/**/*.ts'", "  pattern: ':\\s*any\\b'"];

    it('exposes a valid check with its explicit severity', () => {
      const res = parseRule('x', ruleBytes('x', [...check, 'severity: warn']));
      expect('rule' in res && res.rule.severity).toBe('warn');
      expect('rule' in res && res.rule.check).toEqual({
        type: 'pattern-absent',
        files: ['src/**/*.ts'],
        pattern: ':\\s*any\\b',
      });
    });

    it('defaults the severity to error when a check has none', () => {
      const res = parseRule('x', ruleBytes('x', check));
      expect('rule' in res && res.rule.severity).toBe('error');
      expect('rule' in res && res.rule.check?.type).toBe('pattern-absent');
    });

    it('keeps the bytes verbatim, check and severity included', () => {
      const bytes = ruleBytes('x', [...check, 'severity: warn']);
      const res = parseRule('x', bytes);
      expect('rule' in res && res.rule.bytes).toEqual(bytes);
    });

    it('lets paths and check coexist in either order', () => {
      const paths = ['paths:', '  - "src/**"'];
      expect('rule' in parseRule('x', ruleBytes('x', [...paths, ...check]))).toBe(true);
      expect('rule' in parseRule('x', ruleBytes('x', [...check, ...paths]))).toBe(true);
    });

    it('produces exactly the pre-change object for a rule without a check', () => {
      const bytes = ruleBytes('x');
      const res = parseRule('x', bytes);
      expect(res).toEqual({ rule: { name: 'x', description: 'x rule', bytes, recommended: false } });
      expect('rule' in res && Object.keys(res.rule)).toEqual(['name', 'description', 'bytes', 'recommended']);
    });

    it.each([
      ['an unknown severity', [...check, 'severity: fatal'], "severity must be 'error' or 'warn'"],
      ['a severity without a check', ['severity: error'], 'severity requires a check'],
      ['a severity of another value without a check', ['severity: high'], 'severity requires a check'],
      ['an inline check', ['check: pattern-absent'], 'check must be a nested mapping'],
      ['a multi-line severity', [...check, 'severity:', '  - warn'], "key 'severity' must be a single-line value"],
    ])('rejects %s', (_title, extra, issue) => {
      expect(issueOf(parseRule('x', ruleBytes('x', extra)))).toBe(issue);
    });

    it('rejects an invalid check with its dotted path and reason', () => {
      const issue = issueOf(parseRule('x', ruleBytes('x', ['check:', '  type: run-script'])));
      expect(issue).toMatch(/^invalid check: type: /);
    });

    it('rejects an unknown field inside the check, naming it', () => {
      const issue = issueOf(parseRule('x', ruleBytes('x', [...check, '  extra: 1'])));
      expect(issue).toMatch(/^invalid check: extra: /);
    });

    it('surfaces a mapping reader issue as a rule issue', () => {
      expect(issueOf(parseRule('x', ruleBytes('x', ['check:', '  files: [a, b]'])))).toContain(
        "frontmatter key 'check'",
      );
      expect(issueOf(parseRule('x', ruleBytes('x', ['check:'])))).toContain("frontmatter key 'check'");
    });

    it.each(['check', 'severity'])('never calls %s reserved', (key) => {
      const extra = key === 'check' ? ['check:', '  type: run-script'] : ['severity: high'];
      expect(issueOf(parseRule('x', ruleBytes('x', extra)))).not.toMatch(/reserved/i);
    });
  });
});

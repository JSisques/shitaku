import { describe, expect, it } from 'vitest';
import { HookItemSchema, HookNameSchema } from '@/domain/catalog/hook.js';

const fmt = {
  name: 'fmt',
  description: 'Format after edits',
  event: 'PostToolUse',
  matcher: 'Edit|Write',
  command: 'prettier --write "$CLAUDE_PROJECT_DIR"',
  timeout: 30,
};
const messageOf = (value: unknown): string => {
  const res = HookItemSchema.safeParse(value);
  return res.success ? '' : res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
};

describe('HookNameSchema', () => {
  it.each(['fmt', 'a1', 'format-on-save'])('accepts %s', (name) => {
    expect(HookNameSchema.parse(name)).toBe(name);
  });

  it.each(['Fmt', '-x', 'a_b', '../evil', ''])('rejects %s, naming it', (name) => {
    const res = HookNameSchema.safeParse(name);
    expect(res.success ? '' : res.error.issues[0]?.message).toBe(`invalid hook name '${name}'`);
  });
});

describe('HookItemSchema', () => {
  it('accepts a full hook', () => {
    expect(HookItemSchema.parse(fmt)).toEqual(fmt);
  });

  it('accepts a hook with only the required fields', () => {
    const minimal = { name: 'lint', description: 'Lint', event: 'Stop', command: 'pnpm lint' };
    expect(HookItemSchema.parse(minimal)).toEqual(minimal);
  });

  it('accepts the explicit command handler type', () => {
    expect(HookItemSchema.safeParse({ ...fmt, type: 'command' }).success).toBe(true);
  });

  it.each(['name', 'description', 'event', 'command'])('requires %s', (field) => {
    const rest: Record<string, unknown> = { ...fmt };
    delete rest[field];
    expect(messageOf(rest)).toContain(field);
  });

  it.each([
    ['empty command', { command: '' }, 'command'],
    ['blank command', { command: '   ' }, 'command'],
    ['blank description', { description: ' ' }, 'description'],
    ['empty event', { event: '' }, 'event'],
    ['non-positive timeout', { timeout: 0 }, 'timeout'],
    ['negative timeout', { timeout: -5 }, 'timeout'],
    ['non-string matcher', { matcher: 3 }, 'matcher'],
    ['bad name', { name: 'Bad Name' }, 'name'],
  ])('rejects %s', (_title, patch, field) => {
    expect(messageOf({ ...fmt, ...patch })).toContain(field);
  });

  it('rejects a handler type other than command', () => {
    expect(messageOf({ ...fmt, type: 'prompt' })).toContain('type');
  });

  it('rejects unknown fields, including a second handler list', () => {
    expect(messageOf({ ...fmt, hooks: [{ type: 'command', command: 'x' }] })).toContain('hooks');
    expect(messageOf({ ...fmt, extra: true })).toContain('extra');
  });

  it.each([
    ['a GitHub token', 'curl -H "x: ghp_abcdefghijklmnopqrstuvwxyz0123456789" https://example.com'],
    ['an sk- key', 'tool --key sk-abcdefghijklmnopqrstuvwx'],
    ['a literal env assignment', 'API_TOKEN=abc123def456 run'],
    ['a literal bearer header', 'curl -H "Authorization: Bearer abc123def456ghi" https://example.com'],
    ['a literal password flag', 'tool PASSWORD=hunter2hunter2'],
    ['a literal assignment after a safe reference', 'API_TOKEN=${A} run DB_PASSWORD=hunter2hunter2'],
    ['a literal bearer after a safe reference', 'echo Bearer $T then Bearer abcdef123456'],
  ])('rejects a command containing %s', (_title, command) => {
    expect(messageOf({ ...fmt, command })).toContain('literal secret');
  });

  it('rejects a matcher containing a literal secret', () => {
    expect(messageOf({ ...fmt, matcher: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789' })).toContain('matcher');
  });

  it.each([
    'API_TOKEN=${API_TOKEN} run',
    'curl -H "Authorization: Bearer ${GITHUB_TOKEN}" https://example.com',
    'API_TOKEN="$API_TOKEN" run',
    'prettier --write "$CLAUDE_PROJECT_DIR"',
    'API_TOKEN=${A} DB_PASSWORD=$B run',
    'echo Bearer $T then Bearer ${U}',
  ])('allows placeholders and variable references in %s', (command) => {
    expect(HookItemSchema.safeParse({ ...fmt, command }).success).toBe(true);
  });
});

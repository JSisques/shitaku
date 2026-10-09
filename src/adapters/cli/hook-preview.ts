import type { HookPreview } from '@/ports/prompter.js';

const SHORT_ESCAPES: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\\': '\\\\' };

const isUnsafe = (code: number): boolean =>
  code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029 || code === 0x5c;

/**
 * JSON-style escapes for the characters a terminal would act on (C0, DEL, C1, line and paragraph
 * separators) and for the backslash itself, so a real newline and a typed `\n` cannot look alike.
 */
export function escapeForDisplay(text: string): string {
  return Array.from(text, (ch) =>
    isUnsafe(ch.charCodeAt(0)) ? (SHORT_ESCAPES[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`) : ch,
  ).join('');
}

/**
 * The lines that show one hook as it would be written: event, matcher, command and timeout. Control
 * characters are escaped so the screen cannot disagree with the bytes that reach the settings file.
 */
export function formatHookPreview(preview: HookPreview): string[] {
  return [
    `hook '${escapeForDisplay(preview.name)}' (${preview.scope} scope)`,
    `  event: ${escapeForDisplay(preview.event)}`,
    `  matcher: ${preview.matcher === null ? '(none)' : escapeForDisplay(preview.matcher)}`,
    `  command: ${escapeForDisplay(preview.command)}`,
    ...(preview.timeout === undefined ? [] : [`  timeout: ${preview.timeout}s`]),
  ];
}

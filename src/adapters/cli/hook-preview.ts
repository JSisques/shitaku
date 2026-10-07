import type { HookPreview } from '@/ports/prompter.js';

/** The lines that show one hook exactly as it would be written: event, matcher, command and timeout. */
export function formatHookPreview(preview: HookPreview): string[] {
  return [
    `hook '${preview.name}' (${preview.scope} scope)`,
    `  event: ${preview.event}`,
    `  matcher: ${preview.matcher ?? '(none)'}`,
    `  command: ${preview.command}`,
    ...(preview.timeout === undefined ? [] : [`  timeout: ${preview.timeout}s`]),
  ];
}

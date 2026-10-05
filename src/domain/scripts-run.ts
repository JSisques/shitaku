/** Entry file spawned for an installed script — never metadata such as script.json. */
export const SCRIPT_ENTRY = 'index.mjs';

/**
 * True when `name` looks like a filesystem path rather than a catalog script id.
 * Path-like names MUST be rejected before any spawn or metadata read.
 */
export function isPathLikeScriptName(name: string): boolean {
  if (name.length === 0) return true;
  if (name.includes('/') || name.includes('\\')) return true;
  if (name.includes('..')) return true;
  if (name.includes(' ') || name.includes('\t')) return true;
  // Windows drive letter: `C:demo` or `C:` — letter + colon at the start.
  if (/^[a-zA-Z]:/.test(name)) return true;
  if (name.startsWith('~')) return true;
  return false;
}

/** Relative paths under the project cwd to probe for a local tool binary. */
export function localBinRelativePaths(tool: string, platform: string): string[] {
  const base = `node_modules/.bin/${tool}`;
  return platform === 'win32' ? [`${base}.cmd`, base] : [base];
}

export type ToolInvocation =
  { kind: 'local-bin'; relativePath: string } | { kind: 'npx'; command: 'npx'; args: readonly [string] };

/** Prefer a present local `.bin` candidate; otherwise fall back to `npx <tool>`. */
export function resolveToolInvocation(
  tool: string,
  opts: { platform: string; binPresent: (relativePath: string) => boolean },
): ToolInvocation {
  for (const relativePath of localBinRelativePaths(tool, opts.platform)) {
    if (opts.binPresent(relativePath)) return { kind: 'local-bin', relativePath };
  }
  return { kind: 'npx', command: 'npx', args: [tool] };
}

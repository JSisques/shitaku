import { describe, expect, it } from 'vitest';
import {
  isPathLikeScriptName,
  localBinRelativePaths,
  resolveToolInvocation,
  SCRIPT_ENTRY,
} from '@/domain/scripts-run.js';

describe('isPathLikeScriptName', () => {
  it('accepts bare catalog-style names', () => {
    expect(isPathLikeScriptName('demo')).toBe(false);
    expect(isPathLikeScriptName('my-lint')).toBe(false);
  });

  it('rejects relative and absolute POSIX paths', () => {
    expect(isPathLikeScriptName('./demo')).toBe(true);
    expect(isPathLikeScriptName('../demo')).toBe(true);
    expect(isPathLikeScriptName('/abs/demo')).toBe(true);
    expect(isPathLikeScriptName('foo/bar')).toBe(true);
  });

  it('rejects Windows backslashes, drive letters, and UNC-style names', () => {
    expect(isPathLikeScriptName('.\\demo')).toBe(true);
    expect(isPathLikeScriptName('..\\demo')).toBe(true);
    expect(isPathLikeScriptName('C:\\scripts\\demo')).toBe(true);
    expect(isPathLikeScriptName('c:demo')).toBe(true);
    expect(isPathLikeScriptName('D:/scripts/demo')).toBe(true);
    expect(isPathLikeScriptName('\\\\server\\share\\demo')).toBe(true);
  });

  it('rejects names containing .. or spaces used as path tricks', () => {
    expect(isPathLikeScriptName('..')).toBe(true);
    expect(isPathLikeScriptName('demo..evil')).toBe(true);
    expect(isPathLikeScriptName('my script')).toBe(true);
  });
});

describe('SCRIPT_ENTRY', () => {
  it('is always index.mjs so metadata is never the spawn target', () => {
    expect(SCRIPT_ENTRY).toBe('index.mjs');
  });
});

describe('localBinRelativePaths', () => {
  it('lists the bare tool under node_modules/.bin on POSIX', () => {
    expect(localBinRelativePaths('knip', 'linux')).toEqual(['node_modules/.bin/knip']);
    expect(localBinRelativePaths('knip', 'darwin')).toEqual(['node_modules/.bin/knip']);
  });

  it('prefers the .cmd shim then the bare name on win32, including spaces in the tool name path segment', () => {
    expect(localBinRelativePaths('knip', 'win32')).toEqual(['node_modules/.bin/knip.cmd', 'node_modules/.bin/knip']);
  });
});

describe('resolveToolInvocation', () => {
  it('uses the first present local bin candidate', () => {
    expect(
      resolveToolInvocation('knip', {
        platform: 'linux',
        binPresent: (rel) => rel === 'node_modules/.bin/knip',
      }),
    ).toEqual({ kind: 'local-bin', relativePath: 'node_modules/.bin/knip' });
  });

  it('falls back to npx when no local bin exists', () => {
    expect(
      resolveToolInvocation('knip', {
        platform: 'linux',
        binPresent: () => false,
      }),
    ).toEqual({ kind: 'npx', command: 'npx', args: ['knip'] });
  });

  it('prefers the Windows .cmd shim when present', () => {
    expect(
      resolveToolInvocation('knip', {
        platform: 'win32',
        binPresent: (rel) => rel === 'node_modules/.bin/knip.cmd',
      }),
    ).toEqual({ kind: 'local-bin', relativePath: 'node_modules/.bin/knip.cmd' });
  });

  it('falls back to npx on win32 when neither shim exists', () => {
    expect(
      resolveToolInvocation('eslint', {
        platform: 'win32',
        binPresent: () => false,
      }),
    ).toEqual({ kind: 'npx', command: 'npx', args: ['eslint'] });
  });
});

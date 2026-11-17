import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const ISSUE = 'https://github.com/JSisques/shitaku/issues/238';

/** Stable tokens of the agents docs; a minor rewording keeps them, deleting the note does not. */
const NOTE: Record<string, Record<string, RegExp>> = {
  'README.md': {
    'single-line limit': /block[- ]scalar/i,
    'tracking issue': new RegExp(ISSUE),
    downgrade: /before downgrading[^\n]*agents/i,
    'grants tools': /tools or permissions/i,
    '--source trust': /Agents from a `--source` folder/,
  },
  'CONTRIBUTING.md': {
    'single-line limit': /block[- ]scalar/i,
    'tracking issue': new RegExp(ISSUE),
    'not validated': /not validated/i,
    'grants tools': /tools or permissions/i,
  },
  'website/src/content/docs/en/security.md': {
    'tracking issue': new RegExp(ISSUE),
    downgrade: /before downgrading/i,
    'grants tools': /tools or permissions/i,
    '--source trust': /--source/,
  },
  'website/src/content/docs/es/security.md': {
    'tracking issue': new RegExp(ISSUE),
    downgrade: /bajar de versión/i,
    'grants tools': /herramientas o permisos/i,
    '--source trust': /--source/,
  },
};

describe('agents docs', () => {
  describe.each(Object.entries(NOTE))('%s', (file, tokens) => {
    const text = readFileSync(join(ROOT, file), 'utf8');
    it.each(Object.entries(tokens))('states: %s', (_label, token) => {
      expect(text).toMatch(token);
    });
  });

  it.each(['README.md', 'CONTRIBUTING.md'])('does not document the init flag that ships later in %s', (file) => {
    expect(readFileSync(join(ROOT, file), 'utf8')).not.toMatch(/--agents|--kind agent/);
  });
});

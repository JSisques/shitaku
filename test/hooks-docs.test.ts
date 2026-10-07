import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');

/** Stable tokens of the hooks security note; a minor rewording keeps them, deleting the note does not. */
const NOTE: Record<string, Record<string, RegExp>> = {
  'README.md': {
    'hooks execute code': /hooks run code/i,
    'no literal secrets': /literal secret/i,
    '--source trust': /--source/,
    '--allow-hooks': /--allow-hooks/,
  },
  'CONTRIBUTING.md': {
    'hooks execute code': /full permissions/i,
    'no literal secrets': /literal secret/i,
    '--source trust': /--source/,
    '--allow-hooks': /--allow-hooks/,
  },
  'website/src/content/docs/en/security.md': {
    'hooks execute code': /full user permissions/i,
    'no literal secrets': /literal secrets/i,
    '--source trust': /--source/,
    '--allow-hooks': /--allow-hooks/,
  },
  'website/src/content/docs/es/security.md': {
    'hooks execute code': /permisos de usuario/i,
    'no literal secrets': /secretos literales/i,
    '--source trust': /--source/,
    '--allow-hooks': /--allow-hooks/,
  },
};

const FORMAT = ['`event`', '`matcher`', '`command`', '`timeout`', '`description`'];
const FORMAT_FILES = ['website/src/content/docs/en/security.md', 'website/src/content/docs/es/security.md'];
const ROW = /^\| `(?:event|matcher|command|timeout)`/m;
const KEPT = {
  'README.md': /mixes both is written as LF/,
  'CONTRIBUTING.md': /mixes both is written as LF/,
  'website/src/content/docs/en/security.md': /mixes both is written as LF/,
  'website/src/content/docs/es/security.md': /mezcla ambos se escribe con LF/,
};
const EMPTY_HOOKS = /"hooks": \{\}/;

describe('hooks security note', () => {
  describe.each(Object.entries(NOTE))('%s', (file, tokens) => {
    const text = readFileSync(join(ROOT, file), 'utf8');
    it.each(Object.entries(tokens))('states: %s', (_label, token) => {
      expect(text).toMatch(token);
    });
  });

  it.each(FORMAT_FILES)('describes the hook file format in %s', (file) => {
    const text = readFileSync(join(ROOT, file), 'utf8');
    for (const token of FORMAT) expect(text).toContain(token);
    expect(text).toMatch(ROW);
  });

  it.each(Object.entries(KEPT))('states the mixed line ending rule in %s', (file, token) => {
    expect(readFileSync(join(ROOT, file), 'utf8')).toMatch(token);
  });

  it.each(Object.keys(NOTE))('mentions the leftover empty hooks key in %s', (file) => {
    expect(readFileSync(join(ROOT, file), 'utf8')).toMatch(EMPTY_HOOKS);
  });

  it('tells readers to use ${VAR} references instead of secrets in every document', () => {
    for (const file of Object.keys(NOTE)) expect(readFileSync(join(ROOT, file), 'utf8')).toContain('${VAR}');
  });
});

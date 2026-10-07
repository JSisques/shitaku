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

describe('hooks security note', () => {
  describe.each(Object.entries(NOTE))('%s', (file, tokens) => {
    const text = readFileSync(join(ROOT, file), 'utf8');
    it.each(Object.entries(tokens))('states: %s', (_label, token) => {
      expect(text).toMatch(token);
    });
  });

  it('tells readers to use ${VAR} references instead of secrets in every document', () => {
    for (const file of Object.keys(NOTE)) expect(readFileSync(join(ROOT, file), 'utf8')).toContain('${VAR}');
  });
});

import type { ScriptItem } from '@/domain/catalog/script.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import { enc, faultyFs } from '@test/helpers/skills.js';

export { enc, faultyFs };

/** A catalog source that serves the given scripts and no MCPs/skills. */
export const scriptSource = (scripts: ScriptItem[]): CatalogSource => ({
  ref: () => ({ kind: 'bundled', location: '/catalog' }),
  load: () => Promise.resolve({ mcps: [], skills: [], scripts, commands: [], hooks: [], profiles: [], issues: [] }),
});

/** Four files; index.mjs is written last by apply so a half-written script never loads. */
export const SCRIPT_V1: ScriptItem = {
  name: 'lint',
  description: 'd',
  tools: [],
  files: [
    { path: 'index.mjs', bytes: enc('export default 1;\n') },
    { path: 'script.json', bytes: enc('{"name":"lint","description":"d","tools":[]}') },
    { path: 'assets/logo.bin', bytes: Uint8Array.from([0xff, 0x00, 0x89, 0x50]) },
    { path: 'refs/a.md', bytes: enc('a1') },
  ],
};

/** A newer version that drops refs/a.md and changes index.mjs. */
export const SCRIPT_V2: ScriptItem = {
  ...SCRIPT_V1,
  files: [
    { path: 'index.mjs', bytes: enc('export default 2;\n') },
    { path: 'script.json', bytes: enc('{"name":"lint","description":"d","tools":[]}') },
    { path: 'assets/logo.bin', bytes: Uint8Array.from([0xff, 0x00, 0x89, 0x50]) },
  ],
};

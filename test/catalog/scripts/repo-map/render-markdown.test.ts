import { beforeAll, describe, expect, it } from 'vitest';
import {
  loadRepoMapModule,
  simpleApp,
  snapshotFromTree,
  workspaceMonorepo,
  type BuildMapModule,
  type RenderMarkdownModule,
  type RepoMapDocument,
} from '@test/helpers/repo-map.js';

let mod: RenderMarkdownModule;
let render: RenderMarkdownModule['renderMarkdown'];
let build: BuildMapModule['buildRepoMap'];

beforeAll(async () => {
  mod = await loadRepoMapModule<RenderMarkdownModule>('render-markdown.mjs');
  render = mod.renderMarkdown;
  build = (await loadRepoMapModule<BuildMapModule>('build-map.mjs')).buildRepoMap;
});

const sectionOrder = (text: string): string[] =>
  text
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3));

const blockOf = (text: string, path: string): string =>
  (text.split(`### \`${path}\``)[1] ?? '').split('\n### ')[0]?.split('\n## ')[0] ?? '';

/** A small hand-made document with a known import graph: `src/core.ts` is imported by two modules. */
function smallDoc(): RepoMapDocument {
  const doc = build(snapshotFromTree(simpleApp));
  return {
    ...doc,
    modules: [
      {
        path: 'src/a.ts',
        language: 'typescript',
        imports: [
          { specifier: './core.js', kind: 'static', status: 'internal', resolved: 'src/core.ts' },
          { specifier: 'zod', kind: 'static', status: 'external', resolved: null },
          { specifier: './missing.js', kind: 'static', status: 'unresolved', resolved: null },
        ],
        exports: [{ name: 'a', kind: 'const', signature: 'export const a: number' }],
      },
      {
        path: 'src/b.ts',
        language: 'typescript',
        imports: [{ specifier: './core.js', kind: 'static', status: 'internal', resolved: 'src/core.ts' }],
        exports: [],
      },
      {
        path: 'src/core.ts',
        language: 'typescript',
        imports: [],
        exports: [
          { name: 'core', kind: 'function', signature: 'export function core(): void' },
          { name: 'Core', kind: 'interface', signature: 'export interface Core' },
          { name: 'default', kind: 'expression', signature: null },
        ],
      },
    ],
    graph: { edges: [], importedByCount: { 'src/a.ts': 0, 'src/b.ts': 0, 'src/core.ts': 2 } },
  };
}

describe('render-markdown sections', () => {
  it('exposes the documented budget constants', () => {
    expect(mod.MAX_TOKENS).toBe(8000);
    expect(mod.CHARS_PER_TOKEN).toBe(4);
  });

  it('starts with a header naming the schema, commit, package and the JSON pointer', () => {
    const doc = { ...smallDoc(), commit: 'abc123' };
    const header = render(doc, { maxDepth: 4 }).split('## ')[0] ?? '';
    expect(header).toContain('shitaku.catalog.repo-map/v1');
    expect(header).toContain('abc123');
    expect(header).toContain('simple-app');
    expect(header).toContain('repo-map.json');
  });

  it('prints none for a null commit and a null package name', () => {
    const doc = { ...smallDoc(), commit: null, root: { packageName: null } };
    const header = render(doc, { maxDepth: 4 }).split('## ')[0] ?? '';
    expect(header).toContain('Commit: none');
    expect(header).toContain('Package: none');
  });

  it('renders the sections in the documented order', () => {
    expect(sectionOrder(render(smallDoc(), { maxDepth: 4 }))).toEqual([
      'Stack',
      'Commands',
      'Workspaces',
      'Entry points',
      'Conventions',
      'Tree',
      'Modules',
    ]);
  });

  it('summarizes the stack, commands, workspaces, entry points and conventions', () => {
    const text = render(build(snapshotFromTree(workspaceMonorepo)), { maxDepth: 4 });
    expect(text).toContain('pnpm');
    expect(text).toContain('`pnpm -r build`');
    expect(text).toContain('@acme/core');
    expect(text).toContain('packages/core');
    expect(text).toContain('dist/index.js');
    expect(text).toContain('- Module system: ');
    expect(text).toContain('- Package manager: pnpm');
  });

  it('lists only directories in the tree, down to maxDepth', () => {
    const doc: RepoMapDocument = {
      ...smallDoc(),
      tree: [
        { path: '.', files: 1, totalFiles: 6 },
        { path: 'src', files: 2, totalFiles: 5 },
        { path: 'src/deep', files: 2, totalFiles: 3 },
        { path: 'src/deep/deeper', files: 1, totalFiles: 1 },
      ],
    };
    const shallow = render(doc, { maxDepth: 2 });
    expect(shallow).toContain('`src/deep`');
    expect(shallow).not.toContain('src/deep/deeper');
    const full = render(doc, { maxDepth: 4 });
    expect(full).toContain('`src/deep/deeper`');
    const treeSection = (full.split('## Tree\n')[1] ?? '').split('\n## ')[0] ?? '';
    expect(treeSection).not.toContain('.ts');
  });

  it('keeps the tree in path-segment order even when a sibling name sorts before the slash', () => {
    const doc: RepoMapDocument = {
      ...smallDoc(),
      tree: [
        { path: '.', files: 0, totalFiles: 3 },
        { path: 'src', files: 0, totalFiles: 2 },
        { path: 'src-x', files: 1, totalFiles: 1 },
        { path: 'src/a', files: 1, totalFiles: 1 },
      ],
    };
    const text = render(doc, { maxDepth: 4 });
    const treeLines = (text.split('## Tree\n')[1] ?? '').split('\n## ')[0]?.split('\n') ?? [];
    const order = treeLines.filter((line) => line.includes('src')).map((line) => line.trim());
    expect(order[0]).toContain('`src`');
    expect(order[1]).toContain('`src/a`');
    expect(order[2]).toContain('`src-x`');
  });

  it('orders modules by imported-by count descending, then by path', () => {
    const headings = render(smallDoc(), { maxDepth: 4 })
      .split('\n')
      .filter((line) => line.startsWith('### '));
    expect(headings).toEqual([
      '### `src/core.ts` (imported by 2)',
      '### `src/a.ts` (imported by 0)',
      '### `src/b.ts` (imported by 0)',
    ]);
  });

  it('lists internal resolved dependencies on a deps line and skips external and unresolved ones', () => {
    const text = render(smallDoc(), { maxDepth: 4 });
    const block = blockOf(text, 'src/a.ts');
    expect(block).toContain('deps: `src/core.ts`');
    expect(block).not.toContain('zod');
    expect(block).not.toContain('missing');
    expect(blockOf(text, 'src/core.ts')).not.toContain('deps:');
  });

  it('writes one line per export, using the signature or the name and kind when there is none', () => {
    const block = blockOf(render(smallDoc(), { maxDepth: 4 }), 'src/core.ts');
    expect(block).toContain('- export function core(): void\n');
    expect(block).toContain('- export interface Core\n');
    expect(block).toContain('- default (expression)\n');
  });

  it('has no omission note for a small repository', () => {
    expect(render(smallDoc(), { maxDepth: 4 })).not.toContain('## Omitted');
  });

  it('is a pure function that ends with exactly one trailing newline', () => {
    const doc = smallDoc();
    const first = render(doc, { maxDepth: 4 });
    expect(render(doc, { maxDepth: 4 })).toBe(first);
    expect(first.endsWith('\n')).toBe(true);
    expect(first.endsWith('\n\n')).toBe(false);
  });

  it('does not mutate its input', () => {
    const doc = smallDoc();
    const before = JSON.stringify(doc);
    render(doc, { maxDepth: 2 });
    expect(JSON.stringify(doc)).toBe(before);
  });
});

const CAP = 32000;
const pad = (n: number): string => String(n).padStart(4, '0');

/** Synthetic modules `src/m0000.ts`..; the lower the index, the more imported (with ties). */
function bigDoc(opts: { modules: number; exportsPer?: number; tree?: RepoMapDocument['tree'] }): RepoMapDocument {
  const base = smallDoc();
  const importedByCount: Record<string, number> = {};
  const modules = Array.from({ length: opts.modules }, (_, i) => {
    const path = `src/m${pad(i)}.ts`;
    importedByCount[path] = Math.floor((opts.modules - i) / 2);
    return {
      path,
      language: 'typescript',
      imports: [],
      exports: Array.from({ length: opts.exportsPer ?? 0 }, (__, j) => ({
        name: `fn${pad(i)}x${j}`,
        kind: 'function',
        signature: `export function fn${pad(i)}x${j}(argument: string, other: number): Promise<void>`,
      })),
    };
  });
  return { ...base, modules, graph: { edges: [], importedByCount }, ...(opts.tree ? { tree: opts.tree } : {}) };
}

/** Module blocks in display order with whether they were collapsed to a names line. */
function blocks(text: string): { path: string; collapsed: boolean; signatures: number }[] {
  const modulesSection = text.split('\n## Modules\n')[1] ?? '';
  return modulesSection
    .split('\n### ')
    .slice(1)
    .map((block) => ({
      path: /^`([^`]+)`/.exec(block)?.[1] ?? '',
      collapsed: block.includes('\nexports: '),
      signatures: block.split('\n').filter((line) => line.startsWith('- export ')).length,
    }));
}

const note = (text: string): string =>
  text.includes('\n## Omitted\n') ? `## Omitted\n${text.split('\n## Omitted\n')[1] ?? ''}` : '';

describe('render-markdown size cap', () => {
  it('holds a 2,000-module map to the cap with an omission note, deterministically and quickly', () => {
    const doc = bigDoc({ modules: 2000, exportsPer: 3 });
    const started = performance.now();
    const first = render(doc, { maxDepth: 4 });
    const elapsed = performance.now() - started;
    expect(first.length).toBeLessThanOrEqual(CAP);
    expect(first.endsWith('\n')).toBe(true);
    expect(first).toContain('## Omitted');
    expect(first).toContain('`repo-map.json` is complete');
    expect(render(doc, { maxDepth: 4 })).toBe(first);
    expect(elapsed).toBeLessThan(5000);
  });

  it('collapses signatures first, least important modules first', () => {
    const text = render(bigDoc({ modules: 60, exportsPer: 10 }), { maxDepth: 4 });
    const shown = blocks(text);
    expect(shown).toHaveLength(60);
    const flags = shown.map((block) => block.collapsed);
    expect(flags[0]).toBe(false);
    expect(flags[59]).toBe(true);
    // Collapsed modules form a suffix of the display order: the exact reverse of importance.
    const firstCollapsed = flags.indexOf(true);
    expect(flags.slice(firstCollapsed).every(Boolean)).toBe(true);
    expect(flags.slice(0, firstCollapsed).every((flag) => !flag)).toBe(true);
    expect(shown[firstCollapsed]?.signatures).toBe(0);
    const collapsedCount = flags.filter(Boolean).length;
    expect(note(text)).toContain(`Signatures collapsed to export names for ${collapsedCount} modules.`);
    expect(note(text)).not.toContain('Tree limited');
    expect(note(text)).not.toContain('not listed');
    expect(text).toContain('exports: fn0059x0, fn0059x1');
    expect(text.length).toBeLessThanOrEqual(CAP);
  });

  it('lowers the tree depth only after every signature was collapsed', () => {
    const tree: RepoMapDocument['tree'] = [{ path: '.', files: 0, totalFiles: 1200 }];
    for (let i = 0; i < 300; i++) {
      for (const path of [`a${i}`, `a${i}/b`, `a${i}/b/c`, `a${i}/b/c/d`]) tree.push({ path, files: 1, totalFiles: 1 });
    }
    const text = render(bigDoc({ modules: 3, exportsPer: 4, tree }), { maxDepth: 4 });
    const treeSection = (text.split('## Tree\n')[1] ?? '').split('\n## ')[0] ?? '';
    const depths = [...treeSection.matchAll(/^ *- `([^`]+)`/gm)].map((m) => (m[1] ?? '').split('/').length);
    const limit = /Tree limited to depth (\d+)\./.exec(note(text))?.[1];
    expect(limit).toBeDefined();
    expect(Number(limit)).toBeLessThan(4);
    expect(Number(limit)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...depths)).toBe(Number(limit));
    expect(note(text)).toContain('Signatures collapsed to export names for 3 modules.');
    expect(note(text)).not.toContain('not listed');
    expect(text.length).toBeLessThanOrEqual(CAP);
  });

  it('drops whole module blocks, least important first, after signatures and tree depth', () => {
    const text = render(bigDoc({ modules: 2000 }), { maxDepth: 4 });
    const shown = blocks(text);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(2000);
    expect(shown[0]?.path).toBe('src/m0000.ts');
    // The kept blocks are a prefix of the display order; the dropped ones are the tail.
    expect(shown.map((block) => block.path)).toEqual(
      Array.from({ length: shown.length }, (_, i) => `src/m${pad(i)}.ts`),
    );
    expect(note(text)).toContain(`${2000 - shown.length} modules not listed.`);
    expect(note(text)).not.toContain('Signatures collapsed');
    expect(text.length).toBeLessThanOrEqual(CAP);
  });

  it('cuts at a line boundary when the fixed sections alone exceed the cap', () => {
    const doc: RepoMapDocument = {
      ...bigDoc({ modules: 5, exportsPer: 2 }),
      commands: {
        packageManager: 'pnpm',
        scripts: Array.from({ length: 700 }, (_, i) => ({
          path: '.',
          name: `task${pad(i)}`,
          command: `node scripts/run-task.mjs --name task${pad(i)} --verbose`,
        })),
      },
    };
    const text = render(doc, { maxDepth: 4 });
    expect(text.length).toBeLessThanOrEqual(CAP);
    expect(text.endsWith('\n')).toBe(true);
    expect(note(text)).toContain('Output cut at the size limit.');
    // No half line: every task line that survived is complete.
    for (const line of text.split('\n').filter((l) => l.includes('task'))) {
      expect(line.endsWith('--verbose`')).toBe(true);
    }
    expect(render(doc, { maxDepth: 4 })).toBe(text);
  });

  it('keeps the omission note within its 512 character reservation in the worst case', () => {
    const doc: RepoMapDocument = {
      ...bigDoc({ modules: 9999, exportsPer: 3 }),
      commands: {
        packageManager: 'pnpm',
        scripts: Array.from({ length: 700 }, (_, i) => ({ path: '.', name: `t${pad(i)}`, command: 'x'.repeat(60) })),
      },
    };
    const text = render(doc, { maxDepth: 4 });
    const section = note(text);
    expect(section.length).toBeGreaterThan(0);
    expect(section.length + 1).toBeLessThanOrEqual(512);
    expect(text.length).toBeLessThanOrEqual(CAP);
  });

  it('leaves the document untouched, so the JSON stays complete', () => {
    const doc = bigDoc({ modules: 300, exportsPer: 5 });
    const before = JSON.stringify(doc);
    render(doc, { maxDepth: 4 });
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('does not add a note when the full digest is within the cap', () => {
    const text = render(bigDoc({ modules: 20, exportsPer: 2 }), { maxDepth: 4 });
    expect(text.length).toBeLessThanOrEqual(CAP);
    expect(text).not.toContain('## Omitted');
    expect(blocks(text).every((block) => !block.collapsed)).toBe(true);
  });
});

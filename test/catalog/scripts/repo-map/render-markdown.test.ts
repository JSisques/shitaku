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

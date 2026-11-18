import { beforeAll, describe, expect, it } from 'vitest';
import {
  loadRepoMapModule,
  snapshotFromTree,
  workspaceMonorepo,
  type Snapshot,
  type Tree,
} from '@test/helpers/repo-map.js';

type ProjectModule = {
  detectWorkspaces: (snapshot: Snapshot) => { name: string | null; path: string }[];
};

let project: ProjectModule;

beforeAll(async () => {
  project = await loadRepoMapModule<ProjectModule>('project.mjs');
});

const pkg = (value: Record<string, unknown>): string => JSON.stringify(value);

describe('detectWorkspaces', () => {
  it('reads the pnpm-workspace.yaml packages list and sorts by path', () => {
    expect(project.detectWorkspaces(snapshotFromTree(workspaceMonorepo))).toEqual([
      { name: '@acme/web', path: 'apps/web' },
      { name: '@acme/core', path: 'packages/core' },
    ]);
  });

  it.each([
    ['single quotes', "packages:\n  - 'pkgs/*'\n"],
    ['double quotes', 'packages:\n  - "pkgs/*"\n'],
    ['no quotes', 'packages:\n  - pkgs/*\n'],
    ['comments', "# workspaces\npackages: # list\n  - pkgs/* # all\n  # - ignored/*\n  - 'nothing/*'\n"],
    ['CRLF line endings', "packages:\r\n  - 'pkgs/*'\r\n"],
    ['no indentation', 'packages:\n- pkgs/*\n'],
  ])('parses a pnpm-workspace.yaml with %s', (_label, yaml) => {
    const tree: Tree = {
      'package.json': pkg({ name: 'root' }),
      'pnpm-workspace.yaml': yaml,
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'ignored/x/package.json': pkg({ name: 'x' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'a', path: 'pkgs/a' }]);
  });

  it('stops reading the pnpm list at the next top-level key', () => {
    const tree: Tree = {
      'pnpm-workspace.yaml': "packages:\n  - 'pkgs/*'\ncatalog:\n  - 'other/*'\n",
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'other/b/package.json': pkg({ name: 'b' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'a', path: 'pkgs/a' }]);
  });

  it('honours ! negation in the pnpm list', () => {
    const tree: Tree = {
      'pnpm-workspace.yaml': "packages:\n  - 'pkgs/*'\n  - '!pkgs/skip'\n",
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'pkgs/skip/package.json': pkg({ name: 'skip' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'a', path: 'pkgs/a' }]);
  });

  it('reads package.json workspaces as an array', () => {
    const tree: Tree = {
      'package.json': pkg({ name: 'root', workspaces: ['pkgs/*'] }),
      'pkgs/b/package.json': pkg({ name: 'b' }),
      'pkgs/a/package.json': pkg({ name: 'a' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([
      { name: 'a', path: 'pkgs/a' },
      { name: 'b', path: 'pkgs/b' },
    ]);
  });

  it('reads package.json workspaces as an object with packages', () => {
    const tree: Tree = {
      'package.json': pkg({ name: 'root', workspaces: { packages: ['libs/**'] } }),
      'libs/deep/er/package.json': pkg({ name: 'deeper' }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'deeper', path: 'libs/deep/er' }]);
  });

  it('only matches directories that hold a package.json and never the root', () => {
    const tree: Tree = {
      'package.json': pkg({ name: 'root', workspaces: ['pkgs/*', '.'] }),
      'pkgs/a/package.json': pkg({ name: 'a' }),
      'pkgs/empty/index.ts': '',
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'a', path: 'pkgs/a' }]);
  });

  it('gives name null for a manifest without a string name', () => {
    const tree: Tree = {
      'package.json': pkg({ workspaces: ['pkgs/*'] }),
      'pkgs/a/package.json': pkg({ version: '1.0.0' }),
      'pkgs/b/package.json': pkg({ name: 42 }),
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([
      { name: null, path: 'pkgs/a' },
      { name: null, path: 'pkgs/b' },
    ]);
  });

  it('ignores an invalid workspace manifest and an invalid root manifest', () => {
    const tree: Tree = {
      'package.json': '{ nope',
      'pnpm-workspace.yaml': 'packages:\n  - pkgs/*\n',
      'pkgs/ok/package.json': pkg({ name: 'ok' }),
      'pkgs/bad/package.json': '{ nope',
    };
    expect(project.detectWorkspaces(snapshotFromTree(tree))).toEqual([{ name: 'ok', path: 'pkgs/ok' }]);
  });

  it('returns no workspaces for a single package', () => {
    expect(project.detectWorkspaces(snapshotFromTree({ 'package.json': pkg({ name: 'solo' }) }))).toEqual([]);
  });
});

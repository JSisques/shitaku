import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claudeCodeTarget } from '@/adapters/claude-code/target.js';
import { NodeFileSystem } from '@/adapters/fs/node-fs.js';
import { classifyMissingSkills } from '@/application/agent-skills.js';
import type { Scope } from '@/ports/agent-target.js';
import { makeTmpPaths, type TmpPaths } from '@test/helpers/tmp-paths.js';

describe('classifyMissingSkills', () => {
  let tmp: TmpPaths;
  const real = new NodeFileSystem();
  const skillMd = (scope: Scope, name: string) =>
    join(scope === 'user' ? tmp.homeDir : tmp.cwd, '.claude', 'skills', name, 'SKILL.md');
  const put = async (path: string) => {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, 'x');
  };
  const run = (scope: Scope, missing: { agent: string; name: string }[], fs = real) =>
    classifyMissingSkills(
      { fs, target: claudeCodeTarget, paths: { homeDir: tmp.homeDir, cwd: tmp.cwd } },
      scope,
      missing,
    );
  beforeEach(async () => {
    tmp = await makeTmpPaths();
  });
  afterEach(() => tmp.cleanup());

  it('warns for a skill found nowhere', async () => {
    expect(await run('project', [{ agent: 'a', name: 'ghost' }])).toEqual({
      warnings: ['agent a requires skill ghost, which is not in the catalog'],
      notes: [],
    });
  });

  it('notes a skill with SKILL.md in the run scope', async () => {
    await put(skillMd('project', 'local'));
    expect(await run('project', [{ agent: 'a', name: 'local' }])).toEqual({
      warnings: [],
      notes: ['agent a requires skill local, found on disk, not managed by shitaku'],
    });
  });

  it('notes a skill that only exists in user scope when the run scope is project', async () => {
    await put(skillMd('user', 'local'));
    expect((await run('project', [{ agent: 'a', name: 'local' }])).notes).toHaveLength(1);
  });

  it('warns for a skill that only exists in project scope when the run scope is user', async () => {
    await put(skillMd('project', 'local'));
    expect(await run('user', [{ agent: 'a', name: 'local' }])).toMatchObject({
      notes: [],
      warnings: [expect.any(String)],
    });
  });

  it('warns for a directory without SKILL.md', async () => {
    await mkdir(join(tmp.cwd, '.claude', 'skills', 'local'), { recursive: true });
    expect((await run('project', [{ agent: 'a', name: 'local' }])).warnings).toHaveLength(1);
  });

  it.each(['../x', 'Foo', 'a/b'])('warns for the unsafe name %s without probing the disk', async (name) => {
    const exists = vi.fn(real.exists.bind(real));
    const fs = Object.assign(Object.create(real) as NodeFileSystem, { exists });
    const result = await run('project', [{ agent: 'a', name }], fs);
    expect(result.warnings).toEqual([`agent a requires skill ${name}, which is not in the catalog`]);
    expect(result.notes).toEqual([]);
    expect(exists).not.toHaveBeenCalled();
  });

  it('keeps the order of the missing list inside warnings and notes', async () => {
    await put(skillMd('project', 'l1'));
    await put(skillMd('project', 'l2'));
    const result = await run('project', [
      { agent: 'a', name: 'g1' },
      { agent: 'a', name: 'l1' },
      { agent: 'b', name: 'g2' },
      { agent: 'b', name: 'l2' },
    ]);
    expect(result.warnings.map((w) => w.match(/skill (\S+?),/)![1])).toEqual(['g1', 'g2']);
    expect(result.notes.map((n) => n.match(/skill (\S+?),/)![1])).toEqual(['l1', 'l2']);
  });
});

import { describe, expect, it } from 'vitest';
import { diagnose, requiredEnvNames, type ItemObservation } from '@/domain/plan/doctor-plan.js';
import type { StatusState } from '@/domain/plan/status-plan.js';
import type { Scope } from '@/ports/agent-target.js';

const PROJECT_FILE = '/repo/.mcp.json';
const USER_FILE = '/home/.claude.json';

interface Overrides {
  scope?: Scope;
  path?: string;
  config?: ItemObservation['config'];
  entry?: unknown;
  state?: StatusState;
}

const mcp = (name: string, o: Overrides = {}): ItemObservation => {
  const scope = o.scope ?? 'user';
  return {
    item: {
      kind: 'mcp',
      scope,
      path: o.path ?? (scope === 'user' ? USER_FILE : PROJECT_FILE),
      name,
      hash: 'h',
      installId: 'i1',
    },
    config: o.config ?? 'present',
    current: { kind: 'hash', hash: 'h' },
    entry: 'entry' in o ? o.entry : { command: 'x' },
    state: o.state ?? 'installed',
  };
};

const skill = (name: string, state: StatusState = 'installed', scope: Scope = 'user'): ItemObservation => ({
  item: { kind: 'skill', scope, path: `/skills/${name}`, name, hash: 'h', installId: 'i1' },
  config: 'present',
  current: { kind: 'hash', hash: 'h' },
  state,
});

const command = (name: string, state: StatusState = 'installed', scope: Scope = 'project'): ItemObservation => ({
  item: { kind: 'command', scope, path: `/repo/.claude/commands/${name}.md`, name, hash: 'h', installId: 'i1' },
  config: 'present',
  current: state === 'missing' ? { kind: 'absent' } : { kind: 'hash', hash: 'h' },
  state,
});

const script = (
  name: string,
  o: {
    scope?: Scope;
    state?: StatusState;
    tools?: { tool: string; localBinPresent: boolean }[];
  } = {},
): ItemObservation => ({
  item: {
    kind: 'script',
    scope: o.scope ?? 'project',
    path: `/repo/.shitaku/scripts/${name}`,
    name,
    hash: 'h',
    installId: 'i1',
  },
  config: 'present',
  current: { kind: 'hash', hash: 'h' },
  state: o.state ?? 'installed',
  scriptTools: o.tools ?? [],
});

const run = (observations: ItemObservation[], env: Record<string, string | undefined> = {}) =>
  diagnose({ observations, env, projectConfigPath: PROJECT_FILE }).findings;

describe('requiredEnvNames', () => {
  it('collects placeholders without defaults from nested env, headers and args', () => {
    const entry = {
      command: 'x',
      args: ['--token', '${ARG_TOKEN}'],
      env: { A: '${ENV_VAR}' },
      headers: { Authorization: 'Bearer ${HEADER_VAR}' },
    };
    expect(requiredEnvNames(entry).sort()).toEqual(['ARG_TOKEN', 'ENV_VAR', 'HEADER_VAR']);
  });

  it('excludes placeholders with a default and deduplicates names', () => {
    const entry = { env: { A: '${HOST:-localhost}', B: '${TOKEN}', C: '${TOKEN}' } };
    expect(requiredEnvNames(entry)).toEqual(['TOKEN']);
  });

  it('returns nothing for undefined or placeholder-free entries', () => {
    expect(requiredEnvNames(undefined)).toEqual([]);
    expect(requiredEnvNames({ command: 'x', args: [1, null, true] })).toEqual([]);
  });
});

describe('diagnose: presence problems', () => {
  it('reports no findings for a healthy setup', () => {
    expect(run([mcp('fs'), skill('demo')])).toEqual([]);
  });

  it('reports one config-missing per file with a null name', () => {
    const findings = run([
      mcp('a', { scope: 'project', config: 'missing', state: 'missing', entry: undefined }),
      mcp('b', { scope: 'project', config: 'missing', state: 'missing', entry: undefined }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'problem',
      code: 'config-missing',
      scope: 'project',
      kind: 'mcp',
      name: null,
      path: PROJECT_FILE,
    });
    expect(findings[0]?.fix).not.toBe('');
  });

  it('reports config-unreadable once per file and still diagnoses other items', () => {
    const findings = run([
      mcp('a', { scope: 'project', config: 'unreadable', state: 'modified', entry: undefined }),
      mcp('b', { scope: 'project', config: 'unreadable', state: 'modified', entry: undefined }),
      skill('demo', 'missing'),
    ]);
    expect(findings.map((f) => [f.code, f.name])).toEqual([
      ['config-unreadable', null],
      ['skill-missing', 'demo'],
    ]);
  });

  it('reports mcp-missing when the config is readable but the entry is absent', () => {
    const findings = run([mcp('fs', { state: 'missing', entry: undefined })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ code: 'mcp-missing', name: 'fs', path: USER_FILE, severity: 'problem' });
  });

  it('reports skill-missing with the skill path', () => {
    const findings = run([skill('demo', 'missing'), skill('other')]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ code: 'skill-missing', kind: 'skill', name: 'demo', path: '/skills/demo' });
  });

  it('reports command-missing as a problem naming the command file', () => {
    const findings = run([command('review', 'missing'), command('other')]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: 'command-missing',
      severity: 'problem',
      kind: 'command',
      name: 'review',
      path: '/repo/.claude/commands/review.md',
      fix: 'run shitaku init again to reinstall the command',
    });
    expect(findings[0]?.message).toContain('project command review is missing at /repo/.claude/commands/review.md');
  });

  it('reports no finding for a healthy command and an info finding for a modified one', () => {
    expect(run([command('review')])).toEqual([]);
    expect(run([command('review', 'modified')])).toMatchObject([
      { code: 'modified', severity: 'info', kind: 'command' },
    ]);
  });
});

describe('diagnose: env-unset', () => {
  const api = { env: { T: '${API_TOKEN}', H: '${API_HOST:-localhost}' } };

  it('reports an unset required variable by name only', () => {
    const findings = run([mcp('api', { entry: api })], {});
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ code: 'env-unset', variable: 'API_TOKEN', name: 'api' });
    expect(findings[0]?.message).toContain('not set in the current environment');
  });

  it('treats an empty string as unset', () => {
    const findings = run([mcp('api', { entry: api })], { API_TOKEN: '' });
    expect(findings.map((f) => f.variable)).toEqual(['API_TOKEN']);
  });

  it('reports nothing when the variable is set', () => {
    expect(run([mcp('api', { entry: api })], { API_TOKEN: 's3cret' })).toEqual([]);
  });

  it('does not leak any env value into findings', () => {
    const findings = run([mcp('api', { entry: { env: { A: '${SET_ONE}', B: '${OTHER}' } } })], { SET_ONE: 's3cret' });
    expect(JSON.stringify(findings)).not.toContain('s3cret');
    expect(findings.map((f) => f.variable)).toEqual(['OTHER']);
  });
});

describe('diagnose: duplicate-mcp', () => {
  it('reports a name present in user config and in the current project config', () => {
    const findings = run([mcp('fs'), mcp('fs', { scope: 'project' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ code: 'duplicate-mcp', name: 'fs', scope: 'project', path: PROJECT_FILE });
  });

  it('ignores a project install recorded for another repository', () => {
    expect(run([mcp('fs'), mcp('fs', { scope: 'project', path: '/other/.mcp.json' })])).toEqual([]);
  });

  it('ignores different names and absent entries', () => {
    expect(run([mcp('fs'), mcp('git', { scope: 'project' })])).toEqual([]);
    const absent = run([mcp('fs'), mcp('fs', { scope: 'project', state: 'missing', entry: undefined })]);
    expect(absent.map((f) => f.code)).toEqual(['mcp-missing']);
  });
});

describe('diagnose: script-tool-missing', () => {
  it('reports missing local tools as info only', () => {
    const findings = run([
      script('lint', {
        tools: [
          { tool: 'knip', localBinPresent: false },
          { tool: 'eslint', localBinPresent: true },
        ],
      }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'info',
      code: 'script-tool-missing',
      kind: 'script',
      name: 'lint',
      tool: 'knip',
    });
    expect(findings[0]?.message).toContain('knip');
    expect(findings[0]?.message).toContain('lint');
  });

  it('reports nothing when every required tool is present locally', () => {
    expect(run([script('lint', { tools: [{ tool: 'knip', localBinPresent: true }] })])).toEqual([]);
  });
});

describe('diagnose: info findings and sorting', () => {
  it('reports modified and out-of-date as info and ignores other states', () => {
    const findings = run([skill('a', 'modified'), skill('b', 'out-of-date'), skill('c', 'unknown')]);
    expect(findings.map((f) => [f.severity, f.code, f.name])).toEqual([
      ['info', 'modified', 'a'],
      ['info', 'out-of-date', 'b'],
    ]);
  });

  it('sorts problems first, then scope, kind, name, code and variable', () => {
    const findings = run([
      skill('z', 'modified', 'project'),
      skill('b', 'missing', 'user'),
      mcp('api', { scope: 'project', entry: { env: { B: '${VAR_B}', A: '${VAR_A}' } } }),
      skill('a', 'missing', 'project'),
      skill('a', 'modified', 'user'),
    ]);
    expect(findings.map((f) => [f.severity, f.scope, f.kind, f.name, f.code, f.variable])).toEqual([
      ['problem', 'project', 'mcp', 'api', 'env-unset', 'VAR_A'],
      ['problem', 'project', 'mcp', 'api', 'env-unset', 'VAR_B'],
      ['problem', 'project', 'skill', 'a', 'skill-missing', undefined],
      ['problem', 'user', 'skill', 'b', 'skill-missing', undefined],
      ['info', 'project', 'skill', 'z', 'modified', undefined],
      ['info', 'user', 'skill', 'a', 'modified', undefined],
    ]);
  });
});

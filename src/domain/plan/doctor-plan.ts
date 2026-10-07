import { extractPlaceholders } from '@/domain/placeholders.js';
import type { OwnedItem } from '@/domain/manifest.js';
import type { ItemKind, Observed, StatusState } from '@/domain/plan/status-plan.js';
import type { Scope } from '@/ports/agent-target.js';

export type DoctorCode =
  | 'config-missing'
  | 'config-unreadable'
  | 'mcp-missing'
  | 'skill-missing'
  | 'command-missing'
  | 'hook-missing'
  | 'env-unset'
  | 'duplicate-mcp' // severity 'problem'
  | 'modified'
  | 'out-of-date' // severity 'info'
  | 'script-tool-missing'; // severity 'info'

export interface Finding {
  severity: 'problem' | 'info';
  code: DoctorCode;
  scope: Scope;
  kind: ItemKind;
  /** Null for config-level findings. */
  name: string | null;
  path: string;
  /** `env-unset` only: the variable NAME, never its value. */
  variable?: string;
  /** `script-tool-missing` only: the required tool name. */
  tool?: string;
  message: string;
  fix: string;
}

export interface ItemObservation {
  item: OwnedItem;
  /** Skills, scripts and commands are always `present`. */
  config: 'present' | 'missing' | 'unreadable';
  current: Observed;
  /** The installed MCP entry, when present. */
  entry?: unknown;
  state: StatusState;
  /** For scripts: required tools and whether each exists under local `node_modules/.bin`. */
  scriptTools?: { tool: string; localBinPresent: boolean }[];
}

export interface DiagnoseInput {
  observations: ItemObservation[];
  env: Record<string, string | undefined>;
  /** The current project's MCP config file, used to detect duplicates against user scope. */
  projectConfigPath: string;
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Names of the variables an installed entry requires: placeholders without a default, found in any string value. */
export function requiredEnvNames(entry: unknown): string[] {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const p of extractPlaceholders(value)) if (!p.hasDefault) names.add(p.name);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(visit);
    }
  };
  visit(entry);
  return [...names];
}

const label = (o: ItemObservation): string => `${o.item.scope} ${o.item.kind} ${o.item.name}`;

function configFinding(o: ItemObservation): Finding {
  const missing = o.config === 'missing';
  return {
    severity: 'problem',
    code: missing ? 'config-missing' : 'config-unreadable',
    scope: o.item.scope,
    kind: o.item.kind,
    name: null,
    path: o.item.path,
    message: missing
      ? `${o.item.scope} config file ${o.item.path} does not exist`
      : `${o.item.scope} config file ${o.item.path} cannot be read or parsed`,
    fix: missing
      ? 'run shitaku init again to recreate the file, or shitaku undo to drop the install'
      : 'fix the JSON syntax in the file, or restore it from a backup',
  };
}

function itemFindings(o: ItemObservation, env: DiagnoseInput['env']): Finding[] {
  const base = { scope: o.item.scope, kind: o.item.kind, name: o.item.name, path: o.item.path };
  if (o.item.kind === 'skill' && o.state === 'missing') {
    return [
      {
        ...base,
        severity: 'problem',
        code: 'skill-missing',
        message: `${label(o)} is missing at ${o.item.path}`,
        fix: 'run shitaku init again to reinstall the skill',
      },
    ];
  }
  if (o.item.kind === 'command' && o.state === 'missing') {
    return [
      {
        ...base,
        severity: 'problem',
        code: 'command-missing',
        message: `${label(o)} is missing at ${o.item.path}`,
        fix: 'run shitaku init again to reinstall the command',
      },
    ];
  }
  if (o.item.kind === 'hook' && o.state === 'missing') {
    // An edited handler is no longer located, so it reads as missing too: identity is by exact content.
    return [
      {
        ...base,
        severity: 'problem',
        code: 'hook-missing',
        message: `${label(o)} (${o.item.hook?.event ?? 'unknown event'}) is missing from ${o.item.path}`,
        fix: 'run shitaku init again to reinstall the hook',
      },
    ];
  }
  if (o.item.kind === 'mcp' && o.entry === undefined) {
    return [
      {
        ...base,
        severity: 'problem',
        code: 'mcp-missing',
        message: `${label(o)} is missing from ${o.item.path}`,
        fix: 'run shitaku init again to reinstall the MCP entry',
      },
    ];
  }
  const found: Finding[] = [];
  for (const variable of requiredEnvNames(o.entry)) {
    const value = env[variable];
    if (value !== undefined && value !== '') continue;
    found.push({
      ...base,
      severity: 'problem',
      code: 'env-unset',
      variable,
      message: `${label(o)}: ${variable} is not set in the current environment`,
      fix: `export ${variable} before starting your agent`,
    });
  }
  if (o.item.kind === 'script') {
    for (const t of o.scriptTools ?? []) {
      if (t.localBinPresent) continue;
      found.push({
        ...base,
        severity: 'info',
        code: 'script-tool-missing',
        tool: t.tool,
        message: `${label(o)}: tool '${t.tool}' is not in local node_modules/.bin (npx may still work)`,
        fix: `install '${t.tool}' as a local dependency, or rely on npx when running the script`,
      });
    }
  }
  if (o.state === 'modified' || o.state === 'out-of-date') {
    found.push({
      ...base,
      severity: 'info',
      code: o.state,
      message: `${label(o)}: ${o.state === 'modified' ? 'modified since install' : 'the catalog has a newer version'}`,
      fix:
        o.state === 'modified'
          ? 'run shitaku init --force to restore the installed version'
          : 'run shitaku init to update',
    });
  }
  return found;
}

function duplicateFindings(observations: ItemObservation[], projectConfigPath: string): Finding[] {
  const present = observations.filter((o) => o.item.kind === 'mcp' && o.config === 'present' && o.entry !== undefined);
  const userNames = new Set(present.filter((o) => o.item.scope === 'user').map((o) => o.item.name));
  return present
    .filter((o) => o.item.scope === 'project' && o.item.path === projectConfigPath && userNames.has(o.item.name))
    .map((o) => ({
      severity: 'problem',
      code: 'duplicate-mcp',
      scope: 'project',
      kind: 'mcp',
      name: o.item.name,
      path: o.item.path,
      message: `${label(o)} is also installed in user scope`,
      fix: 'remove one of the two entries so the MCP is configured once',
    }));
}

function sortKey(f: Finding): string[] {
  return [f.severity === 'problem' ? '0' : '1', f.scope, f.kind, f.name ?? '', f.code, f.variable ?? '', f.tool ?? ''];
}

const compareFindings = (a: Finding, b: Finding): number => {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < ka.length; i++) {
    const c = compare(ka[i] as string, kb[i] as string);
    if (c !== 0) return c;
  }
  return 0;
};

/** Turns observations into findings. Problems depend only on the manifest and installed files, never on the catalog. */
export function diagnose(input: DiagnoseInput): { findings: Finding[] } {
  const configFindings = new Map<string, Finding>();
  const findings: Finding[] = [];
  for (const o of input.observations) {
    if (o.config !== 'present') {
      configFindings.set(`${o.item.scope}\0${o.item.path}`, configFinding(o));
    } else {
      findings.push(...itemFindings(o, input.env));
    }
  }
  findings.push(...configFindings.values(), ...duplicateFindings(input.observations, input.projectConfigPath));
  return { findings: findings.sort(compareFindings) };
}

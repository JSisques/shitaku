import type { AgentTarget, McpServerEntry, Scope } from '@/ports/agent-target.js';
import type { Paths } from '@/ports/paths.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import { hashEntry, sha256 } from '@/domain/hash.js';
import type { ScriptChange } from '@/domain/plan/script-plan.js';
import type { SkillChange } from '@/domain/plan/skill-plan.js';
import { mergeAtPath, readAtPath } from '@/domain/json-merge.js';

export type Action = 'create' | 'update' | 'skip' | 'conflict';

export interface PlannedItem {
  name: string;
  action: Action;
  entry: McpServerEntry;
  reason?: string;
}

export interface FileChange {
  path: string;
  scope: Scope;
  beforeHash: string | null;
  before: string | null;
  after: string;
  items: PlannedItem[];
}

/** Whether a required variable is set; the value itself never enters the plan. */
export interface EnvStatus {
  name: string;
  set: boolean;
}

export interface ChangePlan {
  files: FileChange[];
  requiredEnv: EnvStatus[];
  /** Names of every env variable the planned items declare; the apply-time leak scan checks their values. */
  declaredEnv: string[];
  /** One entry per requested skill, in request order. */
  skills: SkillChange[];
  /** One entry per requested script, in request order. */
  scripts: ScriptChange[];
}

export interface BuildPlanInput {
  items: McpItem[];
  target: AgentTarget;
  scope: Scope;
  paths: Paths;
  /** Current content of the target file, null when it does not exist. */
  existing: string | null;
  env: Record<string, string | undefined>;
  /** Replace same-name entries whose content differs. */
  force?: boolean;
  /** Hashes of the entries shitaku installed in this file, by name (derived from the manifest). */
  owned?: Record<string, string>;
}

export const writesFile = (file: FileChange): boolean =>
  file.items.some((i) => i.action === 'create' || i.action === 'update');

/** Decides what to do with one entry given what the file holds now. */
function classify(
  present: unknown,
  entry: McpServerEntry,
  owned: Record<string, string>,
  name: string,
  force: boolean,
): Pick<PlannedItem, 'action' | 'reason'> {
  if (present === undefined) return { action: 'create' };
  const presentHash = hashEntry(present);
  if (presentHash === hashEntry(entry)) return { action: 'skip', reason: 'already installed' };
  if (force) return { action: 'update', reason: 'overwritten by --force' };
  if (owned[name] === presentHash) return { action: 'update', reason: 'installed by shitaku' };
  return { action: 'conflict', reason: 'a different entry with this name exists' };
}

function mergeWrites(items: PlannedItem[], keyPath: string[], text: string | null): string {
  const writes = Object.fromEntries(
    items.filter((p) => p.action === 'create' || p.action === 'update').map((p) => [p.name, p.entry]),
  );
  return Object.keys(writes).length > 0 ? mergeAtPath(text, keyPath, writes) : (text ?? '');
}

/** Re-plans a file against fresh content: items that would write are re-classified; the others stay as planned. */
export function replanFile(
  file: FileChange,
  fresh: string | null,
  keyPath: string[],
  owned: Record<string, string>,
  force: boolean,
): FileChange {
  const current = readAtPath(fresh, keyPath);
  const items = file.items.map((i): PlannedItem =>
    i.action === 'create' || i.action === 'update'
      ? { name: i.name, entry: i.entry, ...classify(current[i.name], i.entry, owned, i.name, force) }
      : i,
  );
  return {
    ...file,
    beforeHash: fresh === null ? null : sha256(fresh),
    before: fresh,
    after: mergeWrites(items, keyPath, fresh),
    items,
  };
}

export function buildPlan(input: BuildPlanInput): ChangePlan {
  const { items, target, scope, paths, existing, env, force = false, owned = {} } = input;
  const keyPath = target.serversKeyPath(scope);
  const current = readAtPath(existing, keyPath);

  const planned: PlannedItem[] = items.map((item) => {
    const entry = target.toEntry(item);
    if (!target.supports(item))
      return { name: item.name, action: 'skip', entry, reason: `not available for ${target.id}` };
    return { name: item.name, entry, ...classify(current[item.name], entry, owned, item.name, force) };
  });

  const after = mergeWrites(planned, keyPath, existing);

  const required = new Map<string, boolean>();
  for (const item of items.filter((i) => target.supports(i))) {
    for (const v of item.env.filter((e) => e.required))
      required.set(v.name, env[v.name] !== undefined && env[v.name] !== '');
  }

  const file: FileChange = {
    path: target.configPath(scope, paths),
    scope,
    beforeHash: existing === null ? null : sha256(existing),
    before: existing,
    after,
    items: planned,
  };
  const declaredEnv = [...new Set(items.filter((i) => target.supports(i)).flatMap((i) => i.env.map((e) => e.name)))];
  return {
    files: [file],
    requiredEnv: [...required].map(([name, set]) => ({ name, set })),
    declaredEnv,
    skills: [],
    scripts: [],
  };
}

// Pure, array-aware edit of the `hooks` key of a Claude Code settings.json. Never reorders or rewrites anything it does not own.
import { canonicalJson } from '@/domain/hash.js';
import { ConfigError, detectIndent } from '@/domain/json-merge.js';

type JsonObject = Record<string, unknown>;

/** One hook handler as written into a matcher group, e.g. `{ type: 'command', command, timeout? }`. */
export type HookHandler = JsonObject;

/** Where a handler lives: its event and matcher group (`null` = the `matcher` key is absent). */
export interface HookSpec {
  event: string;
  matcher: string | null;
  handler: HookHandler;
}

export interface AddHookResult {
  text: string;
  action: 'create' | 'skip';
  createdEvent: boolean;
  createdGroup: boolean;
}

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

const fail = (file: string, reason: string): never => {
  throw new ConfigError(`${file}: ${reason}`);
};

function parseRoot(text: string | null, file: string): JsonObject {
  if (text === null) return {};
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return fail(file, `config is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  return isObject(doc) ? doc : fail(file, 'config root must be a JSON object');
}

/** The `hooks` object of the document, or `undefined` when absent. */
function readHooks(root: JsonObject, file: string): JsonObject | undefined {
  const hooks = root.hooks;
  if (hooks === undefined) return undefined;
  return isObject(hooks) ? hooks : fail(file, "'hooks' must be a JSON object");
}

/** The matcher groups of an event, or `undefined` when the event is absent. Each group is shape-checked. */
function readGroups(hooks: JsonObject, event: string, file: string): JsonObject[] | undefined {
  const groups = hooks[event];
  if (groups === undefined) return undefined;
  const path = `hooks.${event}`;
  if (!Array.isArray(groups)) return fail(file, `'${path}' must be an array`);
  groups.forEach((group: unknown, i) => {
    if (!isObject(group)) return fail(file, `'${path}[${i}]' must be a JSON object`);
    if (!Array.isArray(group.hooks)) return fail(file, `'${path}[${i}].hooks' must be an array`);
    if ('matcher' in group && typeof group.matcher !== 'string') {
      return fail(file, `'${path}[${i}].matcher' must be a string`);
    }
  });
  // Validated above: the live array is returned so callers edit the document in place.
  return groups as JsonObject[];
}

const matcherOf = (group: JsonObject): string | null => (typeof group.matcher === 'string' ? group.matcher : null);

const serialize = (root: JsonObject, original: string | null): string =>
  JSON.stringify(root, null, original === null ? 2 : detectIndent(original)) +
  (original === null || original.endsWith('\n') ? '\n' : '');

/** Appends the handler to the first group with an equal matcher. A deep-equal handler is a no-op `skip`. */
export function addHook(text: string | null, file: string, spec: HookSpec): AddHookResult {
  const root = parseRoot(text, file);
  const hooks = readHooks(root, file) ?? {};
  const existing = readGroups(hooks, spec.event, file);
  const groups = existing ?? [];
  const wanted = canonicalJson(spec.handler);
  const same = groups.filter((group) => matcherOf(group) === spec.matcher);

  const present = same.some((group) => (group.hooks as unknown[]).some((h) => canonicalJson(h) === wanted));
  if (present && text !== null) return { text, action: 'skip', createdEvent: false, createdGroup: false };

  const target = same[0];
  if (target) (target.hooks as unknown[]).push(spec.handler);
  else groups.push({ ...(spec.matcher === null ? {} : { matcher: spec.matcher }), hooks: [spec.handler] });
  hooks[spec.event] = groups;
  root.hooks = hooks;
  return { text: serialize(root, text), action: 'create', createdEvent: existing === undefined, createdGroup: !target };
}

export interface RemoveHookResult {
  text: string;
  removed: boolean;
}

export interface UpdateHookResult {
  text: string;
  updated: boolean;
}

/** Whether shitaku created the event array or the matcher group; only those may be dropped again. */
export interface CreatedFlags {
  createdEvent: boolean;
  createdGroup: boolean;
}

interface Located {
  hooks: JsonObject;
  groups: JsonObject[];
  group: JsonObject;
  index: number;
}

/** Finds the handler by canonical equality in the first group with an equal matcher that holds it. */
function locate(root: JsonObject, file: string, spec: HookSpec): Located | undefined {
  const hooks = readHooks(root, file);
  const groups = hooks && readGroups(hooks, spec.event, file);
  if (!hooks || !groups) return undefined;
  const wanted = canonicalJson(spec.handler);
  for (const group of groups) {
    if (matcherOf(group) !== spec.matcher) continue;
    const index = (group.hooks as unknown[]).findIndex((h) => canonicalJson(h) === wanted);
    if (index >= 0) return { hooks, groups, group, index };
  }
  return undefined;
}

/** Whether the handler is present, located by exact content. Read-only; fails closed like the edits on bad shapes. */
export function hasHook(text: string, file: string, spec: HookSpec): boolean {
  return locate(parseRoot(text, file), file, spec) !== undefined;
}

/** Removes the handler. Its group and event are dropped only when shitaku created them and they are now empty. */
export function removeHook(text: string, file: string, spec: HookSpec, created: CreatedFlags): RemoveHookResult {
  const root = parseRoot(text, file);
  const found = locate(root, file, spec);
  if (!found) return { text, removed: false };
  const { hooks, groups, group, index } = found;
  (group.hooks as unknown[]).splice(index, 1);
  if (created.createdGroup && (group.hooks as unknown[]).length === 0) groups.splice(groups.indexOf(group), 1);
  if (created.createdEvent && groups.length === 0) delete hooks[spec.event];
  return { text: serialize(root, text), removed: true };
}

/** Replaces the handler in `spec` with `next`, in place. Reports `updated: false` when it cannot be located. */
export function updateHook(text: string | null, file: string, spec: HookSpec, next: HookHandler): UpdateHookResult {
  const root = parseRoot(text, file);
  const found = locate(root, file, spec);
  if (text === null || !found) return { text: text ?? '', updated: false };
  (found.group.hooks as unknown[])[found.index] = next;
  return { text: serialize(root, text), updated: true };
}

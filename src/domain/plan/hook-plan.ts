import { hashEntry, sha256 } from '@/domain/hash.js';
import { addHook, updateHook, type HookHandler, type HookSpec } from '@/domain/hook-merge.js';
import type { OwnedHook } from '@/domain/manifest.js';
import type { Action } from '@/domain/plan/change-plan.js';
import type { Scope } from '@/ports/agent-target.js';

/** A hook never conflicts: it is appended next to whatever the user owns, so there is no `conflict` action. */
export type HookAction = Exclude<Action, 'conflict'>;

/** One catalog hook as the plan sees it: where it goes (`HookSpec`) and the name that owns it in the manifest. */
export interface HookPlanEntry extends HookSpec {
  name: string;
}

export interface PlannedHook extends HookPlanEntry {
  action: HookAction;
  reason?: string;
  /** Hash of `{ event, matcher, handler }`, what the manifest records as the entry hash. */
  entryHash: string;
  /** The handler an update replaces. */
  previous?: HookHandler;
  /** Whether the install creates the event array / matcher group; carried through an update. */
  createdEvent: boolean;
  createdGroup: boolean;
}

/** The plan for one settings file: every hook headed there, and the text the file holds after applying them. */
export interface HookFileChange {
  path: string;
  scope: Scope;
  beforeHash: string | null;
  before: string | null;
  after: string;
  items: PlannedHook[];
}

export interface BuildHookPlanInput {
  path: string;
  scope: Scope;
  /** Current content of the settings file, null when it does not exist. */
  existing: string | null;
  hooks: HookPlanEntry[];
  /** hook name -> what shitaku last wrote in this file (derived from the manifest). */
  owned: Record<string, OwnedHook>;
}

export const hookEntryHash = ({ event, matcher, handler }: HookSpec): string => hashEntry({ event, matcher, handler });

/** Whether an apply writes this file: a skip leaves it alone. */
export const writesHookFile = (change: HookFileChange): boolean => change.items.some((i) => i.action !== 'skip');

/** Plans one hook against the running text; returns the planned item and the text after it. */
function planHook(text: string | null, path: string, entry: HookPlanEntry, owned: OwnedHook | undefined) {
  const entryHash = hookEntryHash(entry);
  const added = addHook(text, path, entry);
  if (added.action === 'skip') {
    const item: PlannedHook = {
      ...entry,
      action: 'skip',
      reason: 'already installed',
      entryHash,
      createdEvent: false,
      createdGroup: false,
    };
    return { item, text: added.text };
  }
  // An update replaces in place, so it only applies where the owned handler still sits at the same event and matcher.
  if (owned !== undefined && owned.event === entry.event && owned.matcher === entry.matcher) {
    const updated = updateHook(text, path, { ...entry, handler: owned.handler }, entry.handler);
    if (updated.updated) {
      const { createdEvent, createdGroup } = owned;
      const item: PlannedHook = {
        ...entry,
        action: 'update',
        reason: 'installed by shitaku',
        entryHash,
        previous: owned.handler,
        createdEvent,
        createdGroup,
      };
      return { item, text: updated.text };
    }
  }
  const { createdEvent, createdGroup } = added;
  return {
    item: { ...entry, action: 'create', entryHash, createdEvent, createdGroup } satisfies PlannedHook,
    text: added.text,
  };
}

export function buildHookPlan({ path, scope, existing, hooks, owned }: BuildHookPlanInput): HookFileChange {
  let text = existing;
  const items: PlannedHook[] = [];
  for (const entry of hooks) {
    const planned = planHook(text, path, entry, owned[entry.name]);
    items.push(planned.item);
    text = planned.text;
  }
  return {
    path,
    scope,
    beforeHash: existing === null ? null : sha256(existing),
    before: existing,
    after: text ?? '',
    items,
  };
}

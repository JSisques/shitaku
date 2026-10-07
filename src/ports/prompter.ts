import type { CommandItem } from '@/domain/catalog/command.js';
import type { HookItem } from '@/domain/catalog/hook.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { ScriptItem } from '@/domain/catalog/script.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import type { ChangePlan } from '@/domain/plan/change-plan.js';
import type { Scope } from './agent-target.js';

/** The user dismissed a prompt (Ctrl+C or escape); the command stops without writing. */
export class PromptCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

/** A planned item that cannot be installed without replacing something the user has. */
export interface ConflictInfo {
  kind: 'mcp' | 'skill' | 'script' | 'command';
  name: string;
  reason: string;
}

/** The exact handler a hook would add to a settings file; shown before anything is written. */
export interface HookPreview {
  name: string;
  scope: Scope;
  /** The settings file the handler goes into. */
  path: string;
  event: string;
  matcher: string | null;
  command: string;
  timeout?: number;
}

export interface Prompter {
  /** May return an empty selection; the caller requires at least one item across kinds. */
  selectMcps(options: McpItem[]): Promise<string[]>;
  /** Only asked when the catalog has skills. May return an empty selection. */
  selectSkills(options: SkillItem[]): Promise<string[]>;
  /** Only asked when the catalog has scripts. May return an empty selection. */
  selectScripts(options: ScriptItem[]): Promise<string[]>;
  /** Only asked when the catalog has commands. May return an empty selection. */
  selectCommands(options: CommandItem[]): Promise<string[]>;
  /** Only asked when the catalog has hooks. May return an empty selection. */
  selectHooks(options: HookItem[]): Promise<string[]>;
  selectScope(): Promise<Scope>;
  resolveConflict(conflict: ConflictInfo): Promise<'overwrite' | 'skip'>;
  confirm(plan: ChangePlan): Promise<boolean>;
  /** Shows the exact commands the hooks run and asks whether to install them. */
  confirmHooks(previews: HookPreview[]): Promise<boolean>;
  info(message: string): void;
}

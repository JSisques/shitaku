import { confirm, isCancel, log, multiselect, select } from '@clack/prompts';
import type { CommandItem } from '@/domain/catalog/command.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { ScriptItem } from '@/domain/catalog/script.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import type { ChangePlan } from '@/domain/plan/change-plan.js';
import type { Scope } from '@/ports/agent-target.js';
import { PromptCancelled } from '@/ports/prompter.js';
import type { ConflictInfo, Prompter } from '@/ports/prompter.js';

/** Unwraps a clack answer, turning a dismissed prompt into PromptCancelled. */
function answer<T>(value: T | symbol): T {
  if (isCancel(value)) throw new PromptCancelled();
  return value as T;
}

const CONFLICT_LABELS: Record<ConflictInfo['kind'], string> = {
  mcp: 'MCP',
  skill: 'Skill',
  script: 'Script',
  command: 'Command',
};

export class ClackPrompter implements Prompter {
  async selectMcps(options: McpItem[]): Promise<string[]> {
    return answer<string[]>(
      await multiselect({
        message: 'Which MCP servers do you want to install?',
        options: options.map((m) => ({ value: m.name, label: m.name, hint: m.description })),
        required: false,
      }),
    );
  }

  async selectSkills(options: SkillItem[]): Promise<string[]> {
    return answer<string[]>(
      await multiselect({
        message: 'Which skills do you want to install?',
        options: options.map((s) => ({ value: s.name, label: s.name, hint: s.description })),
        required: false,
      }),
    );
  }

  async selectScripts(options: ScriptItem[]): Promise<string[]> {
    return answer<string[]>(
      await multiselect({
        message: 'Which scripts do you want to install?',
        options: options.map((s) => ({ value: s.name, label: s.name, hint: s.description })),
        required: false,
      }),
    );
  }

  async selectCommands(options: CommandItem[]): Promise<string[]> {
    return answer<string[]>(
      await multiselect({
        message: 'Which slash commands do you want to install?',
        options: options.map((c) => ({ value: c.name, label: c.name, hint: c.description })),
        required: false,
      }),
    );
  }

  async selectScope(): Promise<Scope> {
    return answer<Scope>(
      await select<Scope>({
        message: 'Where should they be installed?',
        options: [
          { value: 'project', label: 'Project', hint: './.mcp.json, ./.claude/skills, ./.shitaku/scripts' },
          { value: 'user', label: 'User', hint: '~/.claude.json, ~/.claude/skills, stateDir/scripts' },
        ],
      }),
    );
  }

  async resolveConflict(conflict: ConflictInfo): Promise<'overwrite' | 'skip'> {
    const tree = conflict.kind === 'skill' || conflict.kind === 'script';
    return answer<'overwrite' | 'skip'>(
      await select<'overwrite' | 'skip'>({
        message: `${CONFLICT_LABELS[conflict.kind]} '${conflict.name}' already exists with different content (${conflict.reason}). What now?`,
        options: [
          { value: 'skip', label: 'Keep the existing one' },
          {
            value: 'overwrite',
            label: tree ? 'Replace the whole directory (backed up)' : 'Overwrite it',
          },
        ],
      }),
    );
  }

  async confirm(plan: ChangePlan): Promise<boolean> {
    const targets =
      plan.files.filter((f) => f.items.length > 0).length +
      plan.skills.length +
      plan.scripts.length +
      plan.commands.length;
    return answer<boolean>(
      await confirm({ message: `Apply the changes to ${targets} location${targets === 1 ? '' : 's'}?` }),
    );
  }

  info(message: string): void {
    log.info(message);
  }
}

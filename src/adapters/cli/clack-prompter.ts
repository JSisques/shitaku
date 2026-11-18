import { confirm, isCancel, log, multiselect, select } from '@clack/prompts';
import type { AgentItem } from '@/domain/catalog/agent.js';
import type { CommandItem } from '@/domain/catalog/command.js';
import type { HookItem } from '@/domain/catalog/hook.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { RuleItem } from '@/domain/catalog/rule.js';
import type { ScriptItem } from '@/domain/catalog/script.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import type { ChangePlan } from '@/domain/plan/change-plan.js';
import { writesHookFile } from '@/domain/plan/hook-plan.js';
import { formatHookPreview } from '@/adapters/cli/hook-preview.js';
import type { Scope } from '@/ports/agent-target.js';
import { PromptCancelled } from '@/ports/prompter.js';
import type { ConflictInfo, HookPreview, Prompter } from '@/ports/prompter.js';

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
  agent: 'Agent',
  rule: 'Rule',
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

  async selectAgents(options: AgentItem[]): Promise<string[]> {
    return answer<string[]>(
      await multiselect({
        message: 'Which agents do you want to install? (agents can grant tools or permissions)',
        options: options.map((a) => ({ value: a.name, label: a.name, hint: a.description })),
        required: false,
      }),
    );
  }

  async selectRules(options: RuleItem[]): Promise<string[]> {
    return answer<string[]>(
      await multiselect({
        message: 'Which rules do you want to install? (rules instruct the agent; recommended ones are preselected)',
        options: options.map((r) => ({
          value: r.name,
          label: r.name,
          hint: r.recommended ? `${r.description} (recommended)` : r.description,
        })),
        initialValues: options.filter((r) => r.recommended).map((r) => r.name),
        required: false,
      }),
    );
  }

  async selectHooks(options: HookItem[]): Promise<string[]> {
    return answer<string[]>(
      await multiselect({
        message: 'Which hooks do you want to install? (hooks run commands with your permissions)',
        options: options.map((h) => ({ value: h.name, label: h.name, hint: h.description })),
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
      plan.commands.length +
      plan.agents.length +
      plan.rules.length +
      plan.hooks.filter(writesHookFile).length;
    return answer<boolean>(
      await confirm({ message: `Apply the changes to ${targets} location${targets === 1 ? '' : 's'}?` }),
    );
  }

  async confirmHooks(previews: HookPreview[]): Promise<boolean> {
    log.info(previews.flatMap(formatHookPreview).join('\n'));
    return answer<boolean>(
      await confirm({
        message: `These hooks run commands with your permissions. Install ${previews.length} hook${previews.length === 1 ? '' : 's'}?`,
      }),
    );
  }

  info(message: string): void {
    log.info(message);
  }
}

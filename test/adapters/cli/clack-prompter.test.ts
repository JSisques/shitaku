import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clack from '@clack/prompts';
import { ClackPrompter } from '@/adapters/cli/clack-prompter.js';
import type { CommandItem } from '@/domain/catalog/command.js';
import type { HookItem } from '@/domain/catalog/hook.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import type { ChangePlan } from '@/domain/plan/change-plan.js';
import { PromptCancelled, type HookPreview } from '@/ports/prompter.js';

const CANCEL = Symbol('clack:cancel');
// Clack types its cancel symbol privately; `never` lets the mocks resolve with it.
const CANCELLED = CANCEL as never;

vi.mock('@clack/prompts', () => ({
  multiselect: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  log: { info: vi.fn() },
  isCancel: (value: unknown) => value === CANCEL,
}));

const multiselect = vi.mocked(clack.multiselect);
const select = vi.mocked(clack.select);
const confirm = vi.mocked(clack.confirm);
const info = vi.mocked(clack.log.info);

// Only the lengths of `files`, `skills`, `scripts`, `commands` and the writing `hooks` matter to the prompter, so the plan is built from placeholders.
const planOf = (files: number, skills: number, emptyFiles = 0, scripts = 0, commands = 0, hooks = 0): ChangePlan =>
  ({
    files: [
      ...Array.from({ length: files }, () => ({ items: [{}] })),
      ...Array.from({ length: emptyFiles }, () => ({ items: [] })),
    ],
    skills: Array.from({ length: skills }, () => ({})),
    scripts: Array.from({ length: scripts }, () => ({})),
    commands: Array.from({ length: commands }, () => ({})),
    hooks: [
      ...Array.from({ length: hooks }, () => ({ items: [{ action: 'create' }] })),
      { items: [{ action: 'skip' }] },
    ],
  }) as unknown as ChangePlan;

const mcp = (name: string, description: string): McpItem => ({ name, description }) as McpItem;
const command = (name: string, description: string): CommandItem => ({ name, description }) as CommandItem;
const hook = (name: string, description: string): HookItem => ({ name, description }) as HookItem;
const skill = (name: string, description: string): SkillItem => ({ name, description }) as SkillItem;

describe('ClackPrompter', () => {
  let prompter: ClackPrompter;

  beforeEach(() => {
    vi.clearAllMocks();
    prompter = new ClackPrompter();
  });

  describe('selectMcps', () => {
    it('offers each MCP with its description as a hint and returns the selection', async () => {
      multiselect.mockResolvedValueOnce(['github']);

      const result = await prompter.selectMcps([mcp('github', 'GitHub MCP'), mcp('context7', 'Docs')]);

      expect(result).toEqual(['github']);
      expect(multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          options: [
            { value: 'github', label: 'github', hint: 'GitHub MCP' },
            { value: 'context7', label: 'context7', hint: 'Docs' },
          ],
          required: false,
        }),
      );
    });

    it('accepts an empty selection', async () => {
      multiselect.mockResolvedValueOnce([]);

      await expect(prompter.selectMcps([])).resolves.toEqual([]);
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      multiselect.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.selectMcps([])).rejects.toBeInstanceOf(PromptCancelled);
    });
  });

  describe('selectSkills', () => {
    it('offers each skill with its description as a hint and returns the selection', async () => {
      multiselect.mockResolvedValueOnce(['example-skill']);

      const result = await prompter.selectSkills([skill('example-skill', 'An example')]);

      expect(result).toEqual(['example-skill']);
      expect(multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          options: [{ value: 'example-skill', label: 'example-skill', hint: 'An example' }],
          required: false,
        }),
      );
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      multiselect.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.selectSkills([])).rejects.toBeInstanceOf(PromptCancelled);
    });
  });

  describe('selectCommands', () => {
    it('offers each command with its description as a hint and returns the selection', async () => {
      multiselect.mockResolvedValueOnce(['review']);

      const result = await prompter.selectCommands([command('review', 'Review a diff'), command('lint', 'Lint')]);

      expect(result).toEqual(['review']);
      expect(multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Which slash commands do you want to install?',
          options: [
            { value: 'review', label: 'review', hint: 'Review a diff' },
            { value: 'lint', label: 'lint', hint: 'Lint' },
          ],
          required: false,
        }),
      );
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      multiselect.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.selectCommands([])).rejects.toBeInstanceOf(PromptCancelled);
    });
  });

  describe('selectHooks', () => {
    it('offers each hook with its description as a hint and warns that hooks run code', async () => {
      multiselect.mockResolvedValueOnce(['fmt']);

      const result = await prompter.selectHooks([hook('fmt', 'Format after edits'), hook('guard', 'Stop guard')]);

      expect(result).toEqual(['fmt']);
      expect(multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Which hooks do you want to install? (hooks run commands with your permissions)',
          options: [
            { value: 'fmt', label: 'fmt', hint: 'Format after edits' },
            { value: 'guard', label: 'guard', hint: 'Stop guard' },
          ],
          required: false,
        }),
      );
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      multiselect.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.selectHooks([])).rejects.toBeInstanceOf(PromptCancelled);
    });
  });

  describe('selectScope', () => {
    it('offers project and user scopes and returns the choice', async () => {
      select.mockResolvedValueOnce('user');

      await expect(prompter.selectScope()).resolves.toBe('user');
      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          options: [expect.objectContaining({ value: 'project' }), expect.objectContaining({ value: 'user' })],
        }),
      );
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      select.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.selectScope()).rejects.toBeInstanceOf(PromptCancelled);
    });
  });

  describe('resolveConflict', () => {
    it('words an MCP conflict and offers to keep or overwrite it', async () => {
      select.mockResolvedValueOnce('overwrite');

      const result = await prompter.resolveConflict({ kind: 'mcp', name: 'github', reason: 'url differs' });

      expect(result).toBe('overwrite');
      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "MCP 'github' already exists with different content (url differs). What now?",
          options: [
            { value: 'skip', label: 'Keep the existing one' },
            { value: 'overwrite', label: 'Overwrite it' },
          ],
        }),
      );
    });

    it('words a skill conflict and warns that the whole directory is replaced', async () => {
      select.mockResolvedValueOnce('skip');

      const result = await prompter.resolveConflict({ kind: 'skill', name: 'example-skill', reason: 'modified' });

      expect(result).toBe('skip');
      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Skill 'example-skill' already exists with different content (modified). What now?",
          options: [
            { value: 'skip', label: 'Keep the existing one' },
            { value: 'overwrite', label: 'Replace the whole directory (backed up)' },
          ],
        }),
      );
    });

    it('words a script conflict like a skill tree replace', async () => {
      select.mockResolvedValueOnce('overwrite');

      await prompter.resolveConflict({ kind: 'script', name: 'lint', reason: 'modified' });

      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Script 'lint' already exists with different content (modified). What now?",
          options: [
            { value: 'skip', label: 'Keep the existing one' },
            { value: 'overwrite', label: 'Replace the whole directory (backed up)' },
          ],
        }),
      );
    });

    it('words a command conflict as a single-file overwrite', async () => {
      select.mockResolvedValueOnce('overwrite');

      await prompter.resolveConflict({ kind: 'command', name: 'review', reason: 'modified' });

      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Command 'review' already exists with different content (modified). What now?",
          options: [
            { value: 'skip', label: 'Keep the existing one' },
            { value: 'overwrite', label: 'Overwrite it' },
          ],
        }),
      );
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      select.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.resolveConflict({ kind: 'mcp', name: 'x', reason: 'y' })).rejects.toBeInstanceOf(
        PromptCancelled,
      );
    });
  });

  describe('confirm', () => {
    it.each([
      { files: 1, skills: 0, scripts: 0, emptyFiles: 0, message: 'Apply the changes to 1 location?' },
      { files: 2, skills: 1, scripts: 0, emptyFiles: 0, message: 'Apply the changes to 3 locations?' },
      { files: 1, skills: 0, scripts: 2, emptyFiles: 0, message: 'Apply the changes to 3 locations?' },
      { files: 1, skills: 0, scripts: 0, emptyFiles: 2, message: 'Apply the changes to 1 location?' },
      { files: 0, skills: 0, scripts: 0, commands: 2, emptyFiles: 0, message: 'Apply the changes to 2 locations?' },
      { files: 1, skills: 0, scripts: 0, hooks: 1, emptyFiles: 0, message: 'Apply the changes to 2 locations?' },
      { files: 0, skills: 0, scripts: 0, hooks: 0, emptyFiles: 1, message: 'Apply the changes to 0 locations?' },
    ])(
      'counts $files file(s), $skills skill(s), $scripts script(s), $commands command(s), $hooks hook file(s)',
      async (c) => {
        confirm.mockResolvedValueOnce(true);

        const result = await prompter.confirm(planOf(c.files, c.skills, c.emptyFiles, c.scripts, c.commands, c.hooks));

        expect(result).toBe(true);
        expect(confirm).toHaveBeenCalledWith({ message: c.message });
      },
    );

    it('returns false when the user declines', async () => {
      confirm.mockResolvedValueOnce(false);

      await expect(prompter.confirm(planOf(1, 0))).resolves.toBe(false);
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      confirm.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.confirm(planOf(1, 0))).rejects.toBeInstanceOf(PromptCancelled);
    });
  });

  describe('confirmHooks', () => {
    const previews: HookPreview[] = [
      {
        name: 'fmt',
        scope: 'project',
        path: '/p/.claude/settings.json',
        event: 'PostToolUse',
        matcher: 'Edit|Write',
        command: 'prettier -w .',
        timeout: 30,
      },
      {
        name: 'guard',
        scope: 'user',
        path: '/h/.claude/settings.json',
        event: 'Stop',
        matcher: null,
        command: './g.sh',
      },
    ];

    it('shows the exact event, matcher and command of every hook, then asks', async () => {
      confirm.mockResolvedValueOnce(true);

      await expect(prompter.confirmHooks(previews)).resolves.toBe(true);

      expect(info).toHaveBeenCalledWith(
        [
          "hook 'fmt' (project scope)",
          '  event: PostToolUse',
          '  matcher: Edit|Write',
          '  command: prettier -w .',
          '  timeout: 30s',
          "hook 'guard' (user scope)",
          '  event: Stop',
          '  matcher: (none)',
          '  command: ./g.sh',
        ].join('\n'),
      );
      expect(confirm).toHaveBeenCalledWith({
        message: 'These hooks run commands with your permissions. Install 2 hooks?',
      });
    });

    it('returns false when the user declines and singularizes the message', async () => {
      confirm.mockResolvedValueOnce(false);

      await expect(prompter.confirmHooks(previews.slice(0, 1))).resolves.toBe(false);
      expect(confirm).toHaveBeenCalledWith({
        message: 'These hooks run commands with your permissions. Install 1 hook?',
      });
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      confirm.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.confirmHooks(previews)).rejects.toBeInstanceOf(PromptCancelled);
    });
  });

  describe('info', () => {
    it('logs the message through clack', () => {
      prompter.info('hello');

      expect(info).toHaveBeenCalledWith('hello');
    });
  });
});

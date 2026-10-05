import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clack from '@clack/prompts';
import { ClackPrompter } from '@/adapters/cli/clack-prompter.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { SkillItem } from '@/domain/catalog/skill.js';
import type { ChangePlan } from '@/domain/plan/change-plan.js';
import { PromptCancelled } from '@/ports/prompter.js';

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

// Only the lengths of `files`, `skills` and `scripts` matter to the prompter, so the plan is built from placeholders.
const planOf = (files: number, skills: number, emptyFiles = 0, scripts = 0): ChangePlan =>
  ({
    files: [
      ...Array.from({ length: files }, () => ({ items: [{}] })),
      ...Array.from({ length: emptyFiles }, () => ({ items: [] })),
    ],
    skills: Array.from({ length: skills }, () => ({})),
    scripts: Array.from({ length: scripts }, () => ({})),
  }) as unknown as ChangePlan;

const mcp = (name: string, description: string): McpItem => ({ name, description }) as McpItem;
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
    ])('counts $files file(s), $skills skill(s) and $scripts script(s)', async (c) => {
      confirm.mockResolvedValueOnce(true);

      const result = await prompter.confirm(planOf(c.files, c.skills, c.emptyFiles, c.scripts));

      expect(result).toBe(true);
      expect(confirm).toHaveBeenCalledWith({ message: c.message });
    });

    it('returns false when the user declines', async () => {
      confirm.mockResolvedValueOnce(false);

      await expect(prompter.confirm(planOf(1, 0))).resolves.toBe(false);
    });

    it('throws PromptCancelled when the prompt is dismissed', async () => {
      confirm.mockResolvedValueOnce(CANCELLED);

      await expect(prompter.confirm(planOf(1, 0))).rejects.toBeInstanceOf(PromptCancelled);
    });
  });

  describe('info', () => {
    it('logs the message through clack', () => {
      prompter.info('hello');

      expect(info).toHaveBeenCalledWith('hello');
    });
  });
});

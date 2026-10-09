import { join } from 'node:path';
import type { HookItem } from '@/domain/catalog/hook.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { AgentTarget, McpServerEntry } from '@/ports/agent-target.js';

export const claudeCodeTarget: AgentTarget = {
  id: 'claude-code',

  supports: (item: McpItem) => item.targets === undefined || item.targets.includes('claude-code'),

  configPath(scope, paths) {
    return scope === 'user' ? join(paths.homeDir, '.claude.json') : join(paths.cwd, '.mcp.json');
  },

  serversKeyPath: () => ['mcpServers'],

  skillsDir: (scope, paths) => join(scope === 'user' ? paths.homeDir : paths.cwd, '.claude', 'skills'),

  commandsDir: (scope, paths) => join(scope === 'user' ? paths.homeDir : paths.cwd, '.claude', 'commands'),

  settingsPath: (scope, paths) => join(scope === 'user' ? paths.homeDir : paths.cwd, '.claude', 'settings.json'),

  toHookHandler: ({ command, timeout }: HookItem) => ({ type: 'command', command, ...(timeout && { timeout }) }),

  toEntry({ server }: McpItem): McpServerEntry {
    if (server.type === 'stdio') {
      return { type: 'stdio', command: server.command, args: server.args, ...(server.env && { env: server.env }) };
    }
    return { type: server.type, url: server.url, ...(server.headers && { headers: server.headers }) };
  },
};

import type { McpItem } from '@/domain/catalog/schema.js';
import type { Paths } from './paths.js';

export type Scope = 'project' | 'user';

/** The JSON object stored under the target's servers key; placeholders stay verbatim. */
export type McpServerEntry = Record<string, unknown>;

export interface AgentTarget {
  id: 'claude-code';
  supports(item: McpItem): boolean;
  configPath(scope: Scope, paths: Paths): string;
  serversKeyPath(scope: Scope): string[];
  toEntry(item: McpItem): McpServerEntry;
  /** Directory that holds one subdirectory per installed skill. */
  skillsDir(scope: Scope, paths: Paths): string;
  /** Directory that holds one flat `.md` file per installed command. */
  commandsDir(scope: Scope, paths: Paths): string;
}

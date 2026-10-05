/** Project scripts install under `<cwd>/.shitaku/scripts` — never agent skill dirs. */
export function projectScriptsRoot(cwd: string): string {
  return `${cwd}/.shitaku/scripts`;
}

/** User scripts install under `<stateDir>/scripts` (shitaku state), never `~/.claude/skills`. */
export function userScriptsRoot(stateDirPath: string): string {
  return `${stateDirPath}/scripts`;
}

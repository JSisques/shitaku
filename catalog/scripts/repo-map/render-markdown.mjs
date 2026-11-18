/**
 * Markdown digest of a repo-map document: a pure function of the JSON, no IO. Sections come in a
 * fixed order and modules are listed most-imported first. All string comparisons use `<` and
 * `>` (code-unit order), never `localeCompare`, so the output is byte-stable on any machine.
 */

export const MAX_TOKENS = 8000;
export const CHARS_PER_TOKEN = 4;

/**
 * @typedef {{ path: string, files: number, totalFiles: number }} TreeEntry
 * @typedef {{ name: string, kind: string, signature: string | null }} ExportEntry
 * @typedef {{ specifier: string, status: string, resolved: string | null }} ImportEntry
 * @typedef {{ path: string, imports: ImportEntry[], exports: ExportEntry[] }} ModuleEntry
 */

/**
 * @param {string} a
 * @param {string} b
 */
const compareCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** @param {string[]} values */
const list = (values) => (values.length === 0 ? 'none' : values.join(', '));

/** @param {string[]} values */
const codeList = (values) => list(values.map((value) => `\`${value}\``));

/**
 * @param {Record<string, unknown>} stack
 * @param {string} key
 * @returns {string[]}
 */
function stackNames(stack, key) {
  const value = stack[key];
  return Array.isArray(value) ? value.map(String) : [];
}

/** @param {any} map */
function renderHeader(map) {
  return [
    '# Repository map',
    '',
    `- Schema: ${map.schema}`,
    `- Commit: ${map.commit ?? 'none'}`,
    `- Package: ${map.root.packageName ?? 'none'}`,
    '- Full data: `repo-map.json` (complete; this digest may omit details)',
    '',
  ].join('\n');
}

/** @param {any} map */
function renderStack(map) {
  const stack = map.stack;
  const languages = /** @type {{ name: string, files: number }[]} */ (stack.languages ?? []);
  const typescript = stack.typescript ?? { config: false, version: null };
  return [
    '## Stack',
    '',
    `- Languages: ${list(languages.map((language) => `${language.name} (${language.files})`))}`,
    `- Package manager: ${stack.packageManager ?? 'none'}`,
    `- Node: ${stack.node ?? 'none'}`,
    `- TypeScript: ${typescript.config === true ? `yes (${typescript.version ?? 'unknown version'})` : 'no'}`,
    `- Frameworks: ${list(stackNames(stack, 'frameworks'))}`,
    `- Test runners: ${list(stackNames(stack, 'testRunners'))}`,
    `- Linters: ${list(stackNames(stack, 'linters'))}`,
    `- Formatters: ${list(stackNames(stack, 'formatters'))}`,
    `- Bundlers: ${list(stackNames(stack, 'bundlers'))}`,
    '',
  ].join('\n');
}

/** @param {any} map */
function renderCommands(map) {
  /** @type {{ path: string, name: string, command: string }[]} */
  const scripts = map.commands.scripts;
  const lines = scripts.map(
    (script) => `- ${script.path === '.' ? '' : `(${script.path}) `}${script.name}: \`${script.command}\``,
  );
  return ['## Commands', '', ...(lines.length === 0 ? ['- none'] : lines), ''].join('\n');
}

/** @param {any} map */
function renderWorkspaces(map) {
  /** @type {{ name: string | null, path: string }[]} */
  const workspaces = map.workspaces;
  const lines = workspaces.map((workspace) => `- ${workspace.name ?? '(unnamed)'}: \`${workspace.path}\``);
  return ['## Workspaces', '', ...(lines.length === 0 ? ['- none'] : lines), ''].join('\n');
}

/** @param {any} map */
function renderEntryPoints(map) {
  /** @type {{ path: string, package: string | null, field: string, key: string | null, file: string }[]} */
  const entries = map.entryPoints;
  const lines = entries.map((entry) => {
    const label = entry.key === null ? entry.field : `${entry.field} ${entry.key}`;
    const owner = entry.path === '.' ? '' : ` (${entry.package ?? entry.path})`;
    return `- ${label}${owner}: \`${entry.file}\``;
  });
  return ['## Entry points', '', ...(lines.length === 0 ? ['- none'] : lines), ''].join('\n');
}

/** @param {any} map */
function renderConventions(map) {
  const conventions = map.conventions;
  const tests = conventions.testFiles ?? { pattern: null, dirs: [] };
  return [
    '## Conventions',
    '',
    `- Module system: ${conventions.moduleSystem ?? 'none'}`,
    `- Test files: ${tests.pattern ?? 'none'} (dirs: ${codeList(tests.dirs ?? [])})`,
    `- Relative import extensions: ${conventions.relativeImportExtensions ?? 'none'}`,
    `- Path aliases: ${codeList(conventions.pathAliases ?? [])}`,
    `- TypeScript strict: ${conventions.tsStrict === null || conventions.tsStrict === undefined ? 'unknown' : String(conventions.tsStrict)}`,
    '',
  ].join('\n');
}

/**
 * Directories only, ordered by path segments so a child always follows its parent.
 * @param {TreeEntry[]} tree
 * @param {number} depth directories deeper than this are left out; the root is depth 0
 */
function renderTree(tree, depth) {
  const rows = tree
    .map((entry) => ({ entry, segments: entry.path === '.' ? [] : entry.path.split('/') }))
    .filter((row) => row.segments.length <= depth)
    .sort((a, b) => {
      const shared = Math.min(a.segments.length, b.segments.length);
      for (let i = 0; i < shared; i++) {
        const order = compareCodeUnits(a.segments[i] ?? '', b.segments[i] ?? '');
        if (order !== 0) return order;
      }
      return a.segments.length - b.segments.length;
    });
  const lines = rows.map(
    ({ entry, segments }) =>
      `${'  '.repeat(segments.length)}- \`${entry.path}\` (${entry.files} files, ${entry.totalFiles} total)`,
  );
  return ['## Tree', '', ...(lines.length === 0 ? ['- none'] : lines), ''].join('\n');
}

/**
 * Internal resolved dependencies of a module, deduplicated and sorted.
 * @param {ModuleEntry} module
 */
function dependencies(module) {
  const targets = new Set();
  for (const item of module.imports) {
    if (item.status === 'internal' && item.resolved !== null) targets.add(item.resolved);
  }
  return [...targets].sort(compareCodeUnits);
}

/**
 * One module block: heading, optional deps line and one line per export.
 * @param {ModuleEntry} module
 * @param {number} importedBy
 */
function renderModuleBlock(module, importedBy) {
  const lines = [`### \`${module.path}\` (imported by ${importedBy})`];
  const deps = dependencies(module);
  if (deps.length > 0) lines.push(`deps: ${codeList(deps)}`);
  for (const entry of module.exports) {
    lines.push(`- ${entry.signature ?? `${entry.name} (${entry.kind})`}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {any} map the repo-map JSON document
 * @param {{ maxDepth: number }} options
 * @returns {string}
 */
export function renderMarkdown(map, options) {
  /** @type {ModuleEntry[]} */
  const modules = map.modules;
  /** @type {Record<string, number>} */
  const importedBy = map.graph.importedByCount;
  const ordered = [...modules].sort(
    (a, b) => (importedBy[b.path] ?? 0) - (importedBy[a.path] ?? 0) || compareCodeUnits(a.path, b.path),
  );
  const blocks = ordered.map((module) => renderModuleBlock(module, importedBy[module.path] ?? 0));

  const parts = [
    renderHeader(map),
    renderStack(map),
    renderCommands(map),
    renderWorkspaces(map),
    renderEntryPoints(map),
    renderConventions(map),
    renderTree(map.tree, options.maxDepth),
    `## Modules\n\n${blocks.join('\n')}`,
  ];
  return `${parts.join('\n').trimEnd()}\n`;
}

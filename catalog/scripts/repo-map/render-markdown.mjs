/**
 * Markdown digest of a repo-map document: a pure function of the JSON, no IO. Sections come in a
 * fixed order and modules are listed most-imported first. All string comparisons use `<` and
 * `>` (code-unit order), never `localeCompare`, so the output is byte-stable on any machine.
 */

export const MAX_TOKENS = 8000;
export const CHARS_PER_TOKEN = 4;
/** Characters held back for the omission note (and its separator) when truncation is needed. */
const NOTE_RESERVE = 512;

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
 * One module block: heading, optional deps line and one line per export. A collapsed block
 * replaces the per-export lines with a single `exports: a, b, c` names line.
 * @param {ModuleEntry} module
 * @param {number} importedBy
 * @param {boolean} collapsed
 */
function renderModuleBlock(module, importedBy, collapsed) {
  const lines = [`### \`${module.path}\` (imported by ${importedBy})`];
  const deps = dependencies(module);
  if (deps.length > 0) lines.push(`deps: ${codeList(deps)}`);
  if (collapsed) {
    if (module.exports.length > 0) lines.push(`exports: ${module.exports.map((entry) => entry.name).join(', ')}`);
  } else {
    for (const entry of module.exports) {
      lines.push(`- ${entry.signature ?? `${entry.name} (${entry.kind})`}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** The deepest directory level of the tree; the root is level 0. @param {TreeEntry[]} tree */
function deepestLevel(tree) {
  let deepest = 0;
  for (const entry of tree) {
    if (entry.path !== '.') deepest = Math.max(deepest, entry.path.split('/').length);
  }
  return deepest;
}

/**
 * The note appended when anything was left out. At most NOTE_RESERVE characters, whatever the
 * counts are, because its lines are fixed text plus a few integers.
 * @param {{ collapsed: number, depth: number | null, dropped: number, cut: boolean }} omitted
 */
function renderOmitted(omitted) {
  const lines = ['## Omitted', ''];
  if (omitted.collapsed > 0) lines.push(`- Signatures collapsed to export names for ${omitted.collapsed} modules.`);
  if (omitted.depth !== null) lines.push(`- Tree limited to depth ${omitted.depth}.`);
  if (omitted.dropped > 0) lines.push(`- ${omitted.dropped} modules not listed.`);
  if (omitted.cut) lines.push('- Output cut at the size limit.');
  lines.push('', '`repo-map.json` is complete and lists everything.');
  return `${lines.join('\n')}\n`;
}

/**
 * Render the digest. When it would exceed the cap, four stages run in order until it fits, each
 * measured against running lengths (blocks are rendered once, never re-rendered in a loop):
 * collapse signatures, lower the tree depth, drop module blocks (all least important first),
 * and finally cut at a line boundary.
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
  const full = ordered.map((module) => renderModuleBlock(module, importedBy[module.path] ?? 0, false));
  const collapsedBlocks = ordered.map((module) => renderModuleBlock(module, importedBy[module.path] ?? 0, true));
  const blocks = [...full];

  const fixed = [
    renderHeader(map),
    renderStack(map),
    renderCommands(map),
    renderWorkspaces(map),
    renderEntryPoints(map),
    renderConventions(map),
  ].join('\n');
  const modulesHead = '## Modules\n\n';

  let depth = Math.min(options.maxDepth, deepestLevel(map.tree));
  let tree = renderTree(map.tree, depth);
  let kept = blocks.length;
  // Upper bound of the final length: the join separators plus every kept block and its separator.
  let blocksLength = blocks.reduce((sum, block) => sum + block.length, 0) + Math.max(0, blocks.length - 1);
  const total = () => fixed.length + 1 + tree.length + 1 + modulesHead.length + blocksLength;
  const assemble = () => `${[fixed, tree, `${modulesHead}${blocks.slice(0, kept).join('\n')}`].join('\n').trimEnd()}\n`;

  if (total() <= MAX_TOKENS * CHARS_PER_TOKEN) return assemble();

  const budget = MAX_TOKENS * CHARS_PER_TOKEN - NOTE_RESERVE;
  const omitted = { collapsed: 0, depth: /** @type {number | null} */ (null), dropped: 0, cut: false };

  /** @type {boolean[]} */
  const collapsed = [];
  // Stage 1: signatures to names, least important first (the reverse of display order).
  for (let i = blocks.length - 1; i >= 0 && total() > budget; i--) {
    const shorter = collapsedBlocks[i] ?? '';
    if (shorter.length >= (blocks[i]?.length ?? 0)) continue;
    blocksLength -= (blocks[i]?.length ?? 0) - shorter.length;
    blocks[i] = shorter;
    collapsed[i] = true;
  }

  // Stage 2: one tree level at a time, down to depth 1.
  while (total() > budget && depth > 1) {
    depth--;
    tree = renderTree(map.tree, depth);
    omitted.depth = depth;
  }

  // Stage 3: whole module blocks, least important first.
  while (total() > budget && kept > 0) {
    kept--;
    blocksLength -= (blocks[kept]?.length ?? 0) + (kept > 0 ? 1 : 0);
    omitted.dropped++;
  }

  // Report only what a reader can see: collapsed modules that were then dropped count once, as dropped.
  omitted.collapsed = collapsed.slice(0, kept).filter(Boolean).length;

  // Stage 4: safety net when the fixed sections alone exceed the budget.
  let body = assemble();
  if (body.length > budget) {
    const head = body.slice(0, budget);
    body = head.slice(0, head.lastIndexOf('\n') + 1);
    omitted.cut = true;
  }
  return `${body.trimEnd()}\n\n${renderOmitted(omitted)}`;
}

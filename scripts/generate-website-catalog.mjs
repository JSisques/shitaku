// Emits Starlight catalog pages from `catalog/` into website content trees.
// With `--check`, fails when committed pages drift from the emitter output.
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as prettier from 'prettier';

const root = join(import.meta.dirname, '..');
const catalogDir = join(root, 'catalog');
const locales = ['en', 'es'];
const generatedKinds = ['mcps', 'skills', 'profiles', 'scripts'];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function skillDescription(name) {
  const text = readFileSync(join(catalogDir, 'skills', name, 'SKILL.md'), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  const line = frontmatter.split(/\r?\n/).find((l) => l.startsWith('description:'));
  if (!line) throw new Error(`skills/${name}/SKILL.md has no single-line description`);
  return line
    .slice('description:'.length)
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2');
}

function yamlEscape(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function frontmatter(title, description) {
  return `---\ntitle: ${yamlEscape(title)}\ndescription: ${yamlEscape(description)}\n---\n`;
}

function placeholderNames(value, found = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) {
      found.add(match[1]);
    }
    return found;
  }
  if (Array.isArray(value)) {
    for (const entry of value) placeholderNames(entry, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) placeholderNames(entry, found);
  }
  return found;
}

function cell(value) {
  return String(value ?? '').replaceAll('|', '\\|');
}

function renderMcp(name) {
  const mcp = readJson(join(catalogDir, 'mcps', `${name}.json`));
  const env = Array.isArray(mcp.env) ? mcp.env : [];
  const placeholders = [...placeholderNames(mcp.server)];
  const server = mcp.server ?? {};
  const serverRows = Object.entries(server)
    .filter(([key]) => key !== 'env' && key !== 'headers')
    .map(([key, value]) => `| \`${key}\` | \`${cell(typeof value === 'string' ? value : JSON.stringify(value))}\` |`);

  if (server.headers && typeof server.headers === 'object') {
    for (const [header, value] of Object.entries(server.headers)) {
      serverRows.push(`| \`headers.${header}\` | \`${cell(value)}\` |`);
    }
  }
  if (server.env && typeof server.env === 'object') {
    for (const [envName, value] of Object.entries(server.env)) {
      serverRows.push(`| \`env.${envName}\` | \`${cell(value)}\` |`);
    }
  }

  const envRows =
    env.length > 0
      ? env.map(
          (entry) =>
            `| \`\${${entry.name}}\` | ${entry.required === false ? 'no' : 'yes'} | ${cell(entry.description)} |`,
        )
      : placeholders.map((varName) => `| \`\${${varName}}\` | yes | Referenced by the server definition |`);

  const sections = [
    frontmatter(name, mcp.description),
    `# \`${name}\``,
    '',
    mcp.description,
    '',
    '## Server',
    '',
    '| Field | Value |',
    '| --- | --- |',
    ...serverRows,
    '',
  ];

  if (envRows.length > 0) {
    sections.push(
      '## Environment',
      '',
      '| Name | Required | Description |',
      '| --- | --- | --- |',
      ...envRows,
      '',
      'Secrets appear only as `${VAR}` placeholder names — never as values.',
      '',
    );
  }

  return `${sections.join('\n').trimEnd()}\n`;
}

function renderSkill(name) {
  const description = skillDescription(name);
  return `${frontmatter(name, description)}# \`${name}\`

${description}

This page is generated from \`catalog/skills/${name}/SKILL.md\`.
`;
}

function renderScript(name) {
  const meta = readJson(join(catalogDir, 'scripts', name, 'script.json'));
  const description = meta.description;
  const tools = Array.isArray(meta.tools) ? meta.tools : [];
  const lines = [
    frontmatter(name, description),
    `# \`${name}\``,
    '',
    description,
    '',
    'This page is generated from `catalog/scripts/' + name + '/script.json`.',
    '',
  ];
  if (tools.length > 0) {
    lines.push('## Tools', '', ...tools.map((tool) => `- \`${tool}\``), '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function renderProfile(name) {
  const profile = readJson(join(catalogDir, 'profiles', `${name}.json`));
  const description = profile.description ?? name;
  const mcps = profile.mcps ?? [];
  const skills = profile.skills ?? [];
  const scripts = profile.scripts ?? [];
  const extendsFrom = profile.extends ?? [];

  const lines = [
    frontmatter(name, description),
    `# \`${name}\``,
    '',
    ':::caution[Not installable]',
    'Profiles are browse-only. The CLI cannot select a profile by name yet.',
    ':::',
    '',
    description,
    '',
  ];

  if (extendsFrom.length > 0) {
    lines.push('## Extends', '', ...extendsFrom.map((item) => `- \`${item}\``), '');
  }
  if (mcps.length > 0) {
    lines.push('## MCP servers', '', ...mcps.map((item) => `- \`${item}\``), '');
  }
  if (skills.length > 0) {
    lines.push('## Skills', '', ...skills.map((item) => `- \`${item}\``), '');
  }
  if (scripts.length > 0) {
    lines.push('## Scripts', '', ...scripts.map((item) => `- \`${item}\``), '');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

async function formatMarkdown(rel, content) {
  const filepath = join(root, rel);
  const options = (await prettier.resolveConfig(filepath)) ?? {};
  return prettier.format(content, { ...options, filepath });
}

async function expectedFiles() {
  const items = readJson(join(catalogDir, 'catalog.json')).items ?? {};
  /** @type {Map<string, string>} */
  const files = new Map();

  for (const locale of locales) {
    for (const name of items.mcps ?? []) {
      const rel = join('website/src/content/docs', locale, 'catalog/mcps', `${name}.md`);
      files.set(rel, await formatMarkdown(rel, renderMcp(name)));
    }
    for (const name of items.skills ?? []) {
      const rel = join('website/src/content/docs', locale, 'catalog/skills', `${name}.md`);
      files.set(rel, await formatMarkdown(rel, renderSkill(name)));
    }
    for (const name of items.scripts ?? []) {
      const rel = join('website/src/content/docs', locale, 'catalog/scripts', `${name}.md`);
      files.set(rel, await formatMarkdown(rel, renderScript(name)));
    }
    for (const name of items.profiles ?? []) {
      const rel = join('website/src/content/docs', locale, 'catalog/profiles', `${name}.md`);
      files.set(rel, await formatMarkdown(rel, renderProfile(name)));
    }
  }

  return files;
}

function listGeneratedOnDisk() {
  const found = [];
  for (const locale of locales) {
    for (const kind of generatedKinds) {
      const dir = join(root, 'website/src/content/docs', locale, 'catalog', kind);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      for (const entry of readdirSync(dir)) {
        if (entry.endsWith('.md')) found.push(join('website/src/content/docs', locale, 'catalog', kind, entry));
      }
    }
  }
  return found;
}

function writeAll(files) {
  const expectedPaths = new Set(files.keys());
  for (const rel of listGeneratedOnDisk()) {
    if (!expectedPaths.has(rel)) rmSync(join(root, rel));
  }
  for (const [rel, content] of files) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

function checkAll(files) {
  const problems = [];
  const expectedPaths = new Set(files.keys());

  for (const [rel, content] of files) {
    const abs = join(root, rel);
    let current;
    try {
      current = readFileSync(abs, 'utf8');
    } catch {
      problems.push(`missing ${rel}`);
      continue;
    }
    if (current !== content) problems.push(`drift ${rel}`);
  }

  for (const rel of listGeneratedOnDisk()) {
    if (!expectedPaths.has(rel)) problems.push(`unexpected ${rel}`);
  }

  return problems;
}

async function main() {
  const files = await expectedFiles();
  const check = process.argv.includes('--check');

  if (check) {
    const problems = checkAll(files);
    if (problems.length > 0) {
      console.error('generate-website-catalog: website catalog pages are out of date (drift).');
      for (const problem of problems) console.error(`  - ${problem}`);
      console.error('Run `pnpm run docs:website-catalog` to regenerate.');
      return 1;
    }
    console.log('generate-website-catalog: website catalog pages are up to date');
    return 0;
  }

  writeAll(files);
  console.log(`generate-website-catalog: wrote ${files.size} pages under website/src/content/docs/{en,es}/catalog/`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`generate-website-catalog: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  },
);

// Regenerates the README catalog tables from `catalog/`. With `--check`, fails when the README is out of date.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as prettier from 'prettier';

const root = join(import.meta.dirname, '..');
const catalogDir = join(root, 'catalog');
const readmePath = join(root, 'README.md');

const SECTIONS = ['mcps', 'skills', 'scripts'];

const startMarker = (section) => `<!-- catalog:${section}:start -->`;
const endMarker = (section) => `<!-- catalog:${section}:end -->`;

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

function scriptDescription(name) {
  const meta = readJson(join(catalogDir, 'scripts', name, 'script.json'));
  if (typeof meta.description !== 'string' || meta.description.length === 0) {
    throw new Error(`scripts/${name}/script.json has no description`);
  }
  return meta.description;
}

function rows(section, items) {
  return [...items]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      description:
        section === 'mcps'
          ? readJson(join(catalogDir, 'mcps', `${name}.json`)).description
          : section === 'skills'
            ? skillDescription(name)
            : scriptDescription(name),
    }));
}

function table(entries) {
  const cell = (value) => String(value ?? '').replaceAll('|', '\\|');
  return [
    '| Name | Description |',
    '| --- | --- |',
    ...entries.map((e) => `| \`${e.name}\` | ${cell(e.description)} |`),
  ].join('\n');
}

function replaceBetweenMarkers(readme, section, content) {
  const start = startMarker(section);
  const end = endMarker(section);
  const from = readme.indexOf(start);
  const to = readme.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`README.md is missing the ${start} ... ${end} markers`);
  }
  return `${readme.slice(0, from + start.length)}\n\n${content}\n\n${readme.slice(to)}`;
}

async function render() {
  const items = readJson(join(catalogDir, 'catalog.json')).items ?? {};
  let readme = readFileSync(readmePath, 'utf8');
  for (const section of SECTIONS) {
    readme = replaceBetweenMarkers(readme, section, table(rows(section, items[section] ?? [])));
  }
  const options = (await prettier.resolveConfig(readmePath)) ?? {};
  return prettier.format(readme, { ...options, filepath: readmePath });
}

async function main() {
  const expected = await render();
  const current = readFileSync(readmePath, 'utf8');
  if (process.argv.includes('--check')) {
    if (expected !== current) {
      console.error('generate-catalog-table: README.md is out of date. Run `pnpm run docs:catalog`.');
      return 1;
    }
    console.log('generate-catalog-table: README.md catalog tables are up to date');
    return 0;
  }
  if (expected !== current) writeFileSync(readmePath, expected);
  console.log(`generate-catalog-table: README.md ${expected === current ? 'already up to date' : 'updated'}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`generate-catalog-table: ${error.message}`);
    process.exit(1);
  },
);

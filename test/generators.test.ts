import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SCRIPTS = { catalog: 'generate-catalog-table.mjs', website: 'generate-website-catalog.mjs' } as const;
const SECTIONS = ['mcps', 'skills', 'scripts', 'commands', 'hooks'];
const PAGES = 'website/src/content/docs';

interface Sandbox {
  dir: string;
  write: (rel: string, content: string) => void;
  read: (rel: string) => string;
  run: (script: keyof typeof SCRIPTS, ...args: string[]) => { status: number | null; stderr: string };
}

const sandboxes: string[] = [];

/** A throwaway repo root: the real generators, a tiny catalog and a README with the catalog markers. */
function sandbox(options: {
  commands: string[];
  hooks?: Record<string, object>;
  readmeSections?: string[];
  profile?: object;
}): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), 'shitaku-gen-'));
  sandboxes.push(dir);
  const write = (rel: string, content: string): void => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  };
  for (const file of Object.values(SCRIPTS)) {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    copyFileSync(join(ROOT, 'scripts', file), join(dir, 'scripts', file));
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  copyFileSync(join(ROOT, '.prettierrc'), join(dir, '.prettierrc'));

  const items = {
    mcps: [],
    skills: [],
    scripts: [],
    profiles: options.profile ? ['team'] : [],
    commands: options.commands,
    ...(options.hooks ? { hooks: Object.keys(options.hooks) } : {}),
  };
  write('catalog/catalog.json', JSON.stringify({ version: 1, items }));
  for (const name of options.commands) {
    write(`catalog/commands/${name}.md`, `---\ndescription: Review ${name} changes | fast\n---\n\nBody of ${name}.\n`);
  }
  for (const [name, hook] of Object.entries(options.hooks ?? {})) {
    write(`catalog/hooks/${name}.json`, JSON.stringify({ name, ...hook }));
  }
  if (options.profile) write('catalog/profiles/team.json', JSON.stringify(options.profile));
  const markers = (options.readmeSections ?? SECTIONS).map(
    (s) => `### ${s}\n\n<!-- catalog:${s}:start -->\n<!-- catalog:${s}:end -->\n`,
  );
  write('README.md', `# Demo\n\n${markers.join('\n')}`);

  return {
    dir,
    write,
    read: (rel) => readFileSync(join(dir, rel), 'utf8'),
    run: (script, ...args) => {
      const result = spawnSync(process.execPath, [join(dir, 'scripts', SCRIPTS[script]), ...args], {
        cwd: dir,
        encoding: 'utf8',
      });
      return { status: result.status, stderr: result.stderr };
    },
  };
}

afterEach(() => {
  for (const dir of sandboxes.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('docs:catalog (README tables)', () => {
  it('renders a commands table with the description and passes check', () => {
    const box = sandbox({ commands: ['review', 'ship'] });
    expect(box.run('catalog').status).toBe(0);
    const readme = box.read('README.md');
    expect(readme).toContain('| `review` | Review review changes \\| fast |');
    expect(readme).toContain('| `ship`   | Review ship changes \\| fast   |');
    expect(box.run('catalog', '--check').status).toBe(0);
  });

  it('fails check when a command description drifts from the README', () => {
    const box = sandbox({ commands: ['review'] });
    box.run('catalog');
    box.write('catalog/commands/review.md', '---\ndescription: Changed upstream\n---\n\nBody\n');
    const check = box.run('catalog', '--check');
    expect(check.status).toBe(1);
    expect(check.stderr).toContain('README.md is out of date');
  });

  it('passes with an empty command catalog and says so instead of an empty table', () => {
    const box = sandbox({ commands: [] });
    expect(box.run('catalog').status).toBe(0);
    const readme = box.read('README.md');
    expect(readme).toContain('No slash commands in the bundled catalog yet.');
    expect(readme).not.toContain('| Name');
    expect(box.run('catalog', '--check').status).toBe(0);
  });

  it('fails with a clear message when the README has no commands markers', () => {
    const box = sandbox({ commands: [], readmeSections: ['mcps', 'skills', 'scripts'] });
    const run = box.run('catalog');
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('<!-- catalog:commands:start -->');
  });
});

describe('docs:website-catalog (command pages)', () => {
  it('emits en and es command pages that say slash command, and check passes', () => {
    const box = sandbox({ commands: ['review'] });
    expect(box.run('website').status).toBe(0);
    const en = box.read(`${PAGES}/en/catalog/commands/review.md`);
    const es = box.read(`${PAGES}/es/catalog/commands/review.md`);
    expect(en).toContain("title: 'review'");
    expect(en).toContain('Review review changes | fast');
    expect(en).toContain('slash command');
    expect(en).toContain('`catalog/commands/review.md`');
    expect(es).toContain('comando slash');
    expect(es).toContain('`/review`');
    expect(box.run('website', '--check').status).toBe(0);
  });

  it('fails check on drift, on a missing page, and on a page for a removed command', () => {
    const box = sandbox({ commands: ['review'] });
    box.run('website');

    box.write('catalog/commands/review.md', '---\ndescription: Changed upstream\n---\n\nBody\n');
    const drift = box.run('website', '--check');
    expect(drift.status).toBe(1);
    expect(drift.stderr).toContain(`drift ${PAGES}/en/catalog/commands/review.md`);
    expect(drift.stderr).toContain(`drift ${PAGES}/es/catalog/commands/review.md`);

    box.run('website');
    rmSync(join(box.dir, `${PAGES}/es/catalog/commands/review.md`));
    expect(box.run('website', '--check').stderr).toContain(`missing ${PAGES}/es/catalog/commands/review.md`);

    box.run('website');
    box.write('catalog/catalog.json', JSON.stringify({ version: 1, items: { commands: [] } }));
    expect(box.run('website', '--check').stderr).toContain(`unexpected ${PAGES}/en/catalog/commands/review.md`);
    expect(box.run('website').status).toBe(0);
    expect(existsSync(join(box.dir, `${PAGES}/en/catalog/commands/review.md`))).toBe(false);
  });

  it('succeeds with an empty command catalog and writes no command pages', () => {
    const box = sandbox({ commands: [] });
    expect(box.run('website').status).toBe(0);
    expect(existsSync(join(box.dir, `${PAGES}/en/catalog/commands`))).toBe(false);
    expect(box.run('website', '--check').status).toBe(0);
  });

  it('lists profile commands under the not-installable callout, and only when present', () => {
    const withCommands = sandbox({ commands: ['review'], profile: { name: 'team', commands: ['review'] } });
    withCommands.run('website');
    const page = withCommands.read(`${PAGES}/en/catalog/profiles/team.md`);
    expect(page).toContain(':::caution[Not installable]');
    expect(page).toContain('## Slash commands\n\n- `review`');
    expect(withCommands.read(`${PAGES}/es/catalog/profiles/team.md`)).toContain('## Slash commands\n\n- `review`');

    const without = sandbox({ commands: [], profile: { name: 'team' } });
    without.run('website');
    expect(without.read(`${PAGES}/en/catalog/profiles/team.md`)).not.toContain('Slash commands');
  });
});

const FMT = {
  description: 'Format edited files | quietly',
  event: 'PostToolUse',
  matcher: 'Edit|Write',
  command: 'prettier --write "$CLAUDE_FILE_PATHS" || true',
  timeout: 30,
};

describe('docs:catalog (hook table)', () => {
  it('renders a hooks table with the description and passes check', () => {
    const box = sandbox({ commands: [], hooks: { format: FMT, audit: { ...FMT, description: 'Audit' } } });
    expect(box.run('catalog').status).toBe(0);
    const readme = box.read('README.md');
    expect(readme).toMatch(/\| `audit` +\| Audit +\|/);
    expect(readme).toContain('| `format` | Format edited files \\| quietly');
    expect(box.run('catalog', '--check').status).toBe(0);
  });

  it('fails check when a hook description drifts from the README', () => {
    const box = sandbox({ commands: [], hooks: { fmt: FMT } });
    box.run('catalog');
    box.write('catalog/hooks/fmt.json', JSON.stringify({ name: 'fmt', ...FMT, description: 'Changed upstream' }));
    const check = box.run('catalog', '--check');
    expect(check.status).toBe(1);
    expect(check.stderr).toContain('README.md is out of date');
  });

  it('says so for an empty or unlisted hook catalog instead of rendering an empty table', () => {
    for (const hooks of [{}, undefined]) {
      const box = sandbox({ commands: [], hooks });
      expect(box.run('catalog').status).toBe(0);
      const readme = box.read('README.md');
      expect(readme).toContain('No hooks in the bundled catalog yet.');
      expect(readme).not.toContain('| Name');
      expect(box.run('catalog', '--check').status).toBe(0);
    }
  });

  it('fails with a clear message when the README has no hooks markers', () => {
    const box = sandbox({ commands: [], readmeSections: ['mcps', 'skills', 'scripts', 'commands'] });
    const run = box.run('catalog');
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('<!-- catalog:hooks:start -->');
  });
});

describe('docs:website-catalog (hook pages)', () => {
  it('emits en and es hook pages with event, matcher, command, timeout and a warning, and check passes', () => {
    const box = sandbox({ commands: [], hooks: { fmt: FMT } });
    expect(box.run('website').status).toBe(0);
    const en = box.read(`${PAGES}/en/catalog/hooks/fmt.md`);
    const es = box.read(`${PAGES}/es/catalog/hooks/fmt.md`);
    for (const page of [en, es]) {
      expect(page).toContain("title: 'fmt'");
      expect(page).toContain('Format edited files | quietly');
      expect(page).toContain('`PostToolUse`');
      expect(page).toContain('`Edit\\|Write`');
      expect(page).toContain('prettier --write "$CLAUDE_FILE_PATHS" || true');
      expect(page).toContain('`30`');
      expect(page).toContain(':::caution');
      expect(page).toContain('`catalog/hooks/fmt.json`');
    }
    expect(en).toContain('full user permissions');
    expect(es).toContain('permisos');
    expect(box.run('website', '--check').status).toBe(0);
  });

  it('shows that an omitted matcher matches everything and an omitted timeout is not set', () => {
    const bare = { description: FMT.description, event: FMT.event, command: FMT.command };
    const box = sandbox({ commands: [], hooks: { bare } });
    box.run('website');
    const en = box.read(`${PAGES}/en/catalog/hooks/bare.md`);
    expect(en).toMatch(/\| Matcher\s+\| all/);
    expect(en).toMatch(/\| Timeout\s+\| not set/);
    expect(box.read(`${PAGES}/es/catalog/hooks/bare.md`)).toMatch(/\| Matcher\s+\| todos/);
  });

  it('keeps a command with backticks or pipes verbatim inside a fence that cannot be closed early', () => {
    const command = 'echo ```x``` | cat';
    const box = sandbox({ commands: [], hooks: { tricky: { ...FMT, command } } });
    box.run('website');
    expect(box.read(`${PAGES}/en/catalog/hooks/tricky.md`)).toContain(`\`\`\`\`\n${command}\n\`\`\`\``);
    expect(box.run('website', '--check').status).toBe(0);
  });

  it('fails check on drift, on a missing page, and on a page for a removed hook', () => {
    const box = sandbox({ commands: [], hooks: { fmt: FMT } });
    box.run('website');

    box.write('catalog/hooks/fmt.json', JSON.stringify({ name: 'fmt', ...FMT, command: 'changed' }));
    const drift = box.run('website', '--check');
    expect(drift.status).toBe(1);
    expect(drift.stderr).toContain(`drift ${PAGES}/en/catalog/hooks/fmt.md`);
    expect(drift.stderr).toContain(`drift ${PAGES}/es/catalog/hooks/fmt.md`);

    box.run('website');
    rmSync(join(box.dir, `${PAGES}/es/catalog/hooks/fmt.md`));
    expect(box.run('website', '--check').stderr).toContain(`missing ${PAGES}/es/catalog/hooks/fmt.md`);

    box.run('website');
    box.write('catalog/catalog.json', JSON.stringify({ version: 1, items: { hooks: [] } }));
    expect(box.run('website', '--check').stderr).toContain(`unexpected ${PAGES}/en/catalog/hooks/fmt.md`);
    expect(box.run('website').status).toBe(0);
    expect(existsSync(join(box.dir, `${PAGES}/en/catalog/hooks/fmt.md`))).toBe(false);
  });

  it('succeeds with an empty or unlisted hook catalog and writes no hook pages', () => {
    for (const hooks of [{}, undefined]) {
      const box = sandbox({ commands: [], hooks });
      expect(box.run('website').status).toBe(0);
      expect(existsSync(join(box.dir, `${PAGES}/en/catalog/hooks`))).toBe(false);
      expect(box.run('website', '--check').status).toBe(0);
    }
  });

  it('lists profile hooks under the not-installable callout, and only when present', () => {
    const withHooks = sandbox({ commands: [], hooks: { fmt: FMT }, profile: { name: 'team', hooks: ['fmt'] } });
    withHooks.run('website');
    const page = withHooks.read(`${PAGES}/en/catalog/profiles/team.md`);
    expect(page).toContain(':::caution[Not installable]');
    expect(page).toContain('## Hooks\n\n- `fmt`');
    expect(withHooks.read(`${PAGES}/es/catalog/profiles/team.md`)).toContain('## Hooks\n\n- `fmt`');

    const without = sandbox({ commands: [], profile: { name: 'team' } });
    without.run('website');
    expect(without.read(`${PAGES}/en/catalog/profiles/team.md`)).not.toContain('## Hooks');
  });
});

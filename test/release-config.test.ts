import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('ci.yml reuse contract', () => {
  const ci = read('.github/workflows/ci.yml');

  it('is callable from other workflows and still runs on pull_request', () => {
    expect(ci).toMatch(/^on:\n(?:[ ]+.*\n|\n)*?[ ]+workflow_call:/m);
    expect(ci).toMatch(/^[ ]+pull_request:\n[ ]+branches: \[main\]/m);
  });

  it('never runs on push', () => {
    expect(ci).not.toMatch(/^[ ]+push:/m);
  });

  it('has no path filters, so docs-only pull requests still run', () => {
    expect(ci).not.toMatch(/^[ ]+paths(-ignore)?:/m);
  });

  it('uses a literal ci- concurrency group and cancels only pull_request runs', () => {
    expect(ci).toContain('group: ci-${{ github.ref }}');
    expect(ci).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });

  it('declares a single ci job with read-only contents', () => {
    const jobsBlock = ci.slice(ci.indexOf('\njobs:'));
    const jobNames = [...jobsBlock.matchAll(/^ {2}([\w-]+):\s*$/gm)].map((match) => match[1]);
    expect(jobNames).toEqual(['ci']);
    expect(ci).toMatch(/^permissions:\n[ ]+contents: read$/m);
  });
});

describe('CHANGELOG.md ignores', () => {
  it('is ignored by Prettier', async () => {
    const info = await prettier.getFileInfo(join(ROOT, 'CHANGELOG.md'), {
      ignorePath: join(ROOT, '.prettierignore'),
    });
    expect(info.ignored).toBe(true);
  });

  it('is ignored by ESLint', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    expect(await eslint.isPathIgnored(join(ROOT, 'CHANGELOG.md'))).toBe(true);
  });
});

describe('cd.yml release workflow contract', () => {
  const cd = read('.github/workflows/cd.yml');

  it('is named CD and is dispatched manually with a boolean dry_run input defaulting to false', () => {
    expect(cd).toMatch(/^name: CD$/m);
    expect(cd).toMatch(/^[ ]+workflow_dispatch:/m);
    expect(cd).toMatch(/^[ ]+dry_run:\n(?:[ ]+.*\n)*?[ ]+type: boolean\n[ ]+default: false/m);
  });

  it('never runs on push', () => {
    expect(cd).not.toMatch(/^[ ]+push:/m);
  });

  it('reuses ci.yml in job ci and runs release after it, only on main', () => {
    expect(cd).toContain('uses: ./.github/workflows/ci.yml');
    expect(cd).toContain('needs: ci');
    expect(cd).toContain("if: github.ref == 'refs/heads/main'");
  });

  it('grants id-token: write exactly once and keeps ci read-only', () => {
    expect(cd.match(/id-token: write/g)).toHaveLength(1);
    expect(cd).toMatch(/^ {2}ci:\n(?: {4}.*\n)*? {4}permissions:\n {6}contents: read\n/m);
    expect(cd).toMatch(/^permissions: \{\}$/m);
  });

  it('holds every write scope only in the release job', () => {
    const releaseBlock = cd.slice(cd.indexOf('\n  release:'));
    const beforeRelease = cd.slice(0, cd.indexOf('\n  release:'));
    expect(beforeRelease).not.toMatch(/: write/);
    for (const scope of ['contents', 'issues', 'pull-requests', 'packages', 'id-token']) {
      expect(releaseBlock).toContain(`${scope}: write`);
    }
  });

  it('does not cancel a running release and serializes per ref', () => {
    expect(cd).toContain('group: release-${{ github.ref }}');
    expect(cd).toContain('cancel-in-progress: false');
    expect(cd).not.toContain('cancel-in-progress: true');
  });

  it('checks out full history without persisted credentials and disables git hooks', () => {
    expect(cd).toContain('fetch-depth: 0');
    expect(cd).toContain('persist-credentials: false');
    expect(cd).toContain("HUSKY: '0'");
  });

  it('installs npm 11 and passes --dry-run only through the dry_run input', () => {
    expect(cd).toContain("npm install -g 'npm@>=11.5.1 <12'");
    expect(cd).toContain("inputs.dry_run && '--dry-run' || ''");
    expect(cd).toContain('pnpm exec semantic-release');
  });

  it('uses no npm token and no registry-url', () => {
    expect(cd).not.toContain('NPM_TOKEN');
    expect(cd).not.toContain('registry-url');
  });
});

describe('.releaserc.json', () => {
  const rc = JSON.parse(read('.releaserc.json')) as {
    branches: string[];
    tagFormat: string;
    plugins: (string | [string, Record<string, unknown>])[];
  };
  const names = rc.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
  const options = (name: string): Record<string, unknown> => {
    const entry = rc.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === name);
    return Array.isArray(entry) ? entry[1] : {};
  };

  it('releases from main with v-prefixed tags', () => {
    expect(rc.branches).toEqual(['main']);
    expect(rc.tagFormat).toBe('v${version}');
  });

  it('orders plugins: npm before exec before github; changelog and npm before git', () => {
    const at = (name: string): number => names.indexOf(name);
    expect(at('@semantic-release/npm')).toBeGreaterThan(-1);
    expect(at('@semantic-release/npm')).toBeLessThan(at('@semantic-release/exec'));
    expect(at('@semantic-release/exec')).toBeLessThan(at('@semantic-release/github'));
    expect(at('@semantic-release/changelog')).toBeLessThan(at('@semantic-release/git'));
    expect(at('@semantic-release/npm')).toBeLessThan(at('@semantic-release/git'));
  });

  it('uses the conventionalcommits preset for analysis and notes', () => {
    expect(options('@semantic-release/commit-analyzer').preset).toBe('conventionalcommits');
    expect(options('@semantic-release/release-notes-generator').preset).toBe('conventionalcommits');
  });

  it('commits only CHANGELOG.md and package.json with a [skip ci] message', () => {
    const git = options('@semantic-release/git');
    expect(git.assets).toEqual(['CHANGELOG.md', 'package.json']);
    expect(git.message).toMatch(/^chore\(release\): \$\{nextRelease\.version\} \[skip ci\]/);
  });

  it('publishes to GitHub Packages through exec with a per-command registry and userconfig', () => {
    const cmd = options('@semantic-release/exec').publishCmd;
    expect(cmd).toContain('--registry https://npm.pkg.github.com');
    expect(cmd).toContain('--userconfig .github/github-packages.npmrc');
  });

  it('keeps default release rules', () => {
    expect(JSON.stringify(rc)).not.toContain('releaseRules');
  });
});

describe('registry configuration', () => {
  it('keeps publishConfig registry-less', () => {
    const pkg = JSON.parse(read('package.json')) as { publishConfig: Record<string, unknown> };
    expect(pkg.publishConfig.registry).toBeUndefined();
    expect(pkg.publishConfig.access).toBe('public');
  });

  it('authenticates GitHub Packages through a ${GITHUB_TOKEN} placeholder only', () => {
    const npmrc = read('.github/github-packages.npmrc');
    expect(npmrc).toContain('//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}');
    expect(npmrc).not.toMatch(/_authToken=(?!\$\{GITHUB_TOKEN\})\S/);
  });
});

describe('release documentation', () => {
  const docs = read('docs/releasing.md');

  it('documents the bootstrap, trusted publisher and the cd.yml rename warning', () => {
    expect(docs).toContain('0.1.0');
    expect(docs).toContain('v0.1.0');
    expect(docs).toContain('JSisques/shitaku');
    expect(docs.toLowerCase()).toContain('trusted publisher');
    expect(docs).toContain('Allow npm publish');
    expect(docs).toMatch(/never rename[^\n]*`cd\.yml`/i);
  });

  it('documents dry runs, failure recovery and the pending-run caveat', () => {
    expect(docs).toContain('dry_run');
    expect(docs.toLowerCase()).toContain('recovery');
    expect(docs.toLowerCase()).toContain('pending');
  });

  it('is linked from the README', () => {
    expect(read('README.md')).toContain('docs/releasing.md');
  });
});

describe('smoke-pack script', () => {
  it('packs with --ignore-scripts so lifecycle output (husky prepare) cannot corrupt the JSON', () => {
    expect(read('scripts/smoke-pack.mjs')).toContain("'pack', '--ignore-scripts'");
  });
});

describe('website workflow isolation', () => {
  it('has an isolated website.yml Pages workflow', () => {
    const website = read('.github/workflows/website.yml');
    expect(website).toMatch(/^name:\s*Website$/m);
    expect(website).toMatch(/actions\/deploy-pages|peaceiris\/actions-gh-pages|upload-pages-artifact/);
    expect(website).toContain('website/**');
    expect(website).toContain('catalog/**');
    expect(website).toContain('scripts/generate-website-catalog.mjs');
    expect(website).toContain('.github/workflows/website.yml');
  });

  it('keeps ci.yml free of website build, install, and Pages deploy', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).not.toMatch(
      /website\/package\.json|website:build|docs:website-catalog|deploy-pages|upload-pages-artifact|peaceiris\/actions-gh-pages/i,
    );
    expect(ci).not.toContain('working-directory: website');
  });

  it('keeps cd.yml free of website.yml and Pages deploy', () => {
    const cd = read('.github/workflows/cd.yml');
    expect(cd).not.toContain('website.yml');
    expect(cd).not.toMatch(/deploy-pages|upload-pages-artifact|peaceiris\/actions-gh-pages/i);
  });

  it('excludes website/ from the published package files list', () => {
    const pkg = JSON.parse(read('package.json')) as { files: string[]; scripts?: Record<string, string> };
    expect(pkg.files).not.toContain('website');
    expect(pkg.files.every((entry) => !entry.startsWith('website'))).toBe(true);
    expect(pkg.scripts?.['website:build']).toBeUndefined();
  });

  it('runs the catalog emitter before the Astro build in website.yml', () => {
    const website = read('.github/workflows/website.yml');
    const emitAt = website.indexOf('docs:website-catalog');
    const buildAt = website.indexOf('pnpm run build');
    expect(emitAt).toBeGreaterThan(-1);
    expect(buildAt).toBeGreaterThan(emitAt);
  });
});

describe('website catalog emitter', () => {
  const script = join(ROOT, 'scripts/generate-website-catalog.mjs');
  const samplePage = 'website/src/content/docs/en/catalog/mcps/github.md';

  it('declares docs:website-catalog and docs:website-catalog:check scripts', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['docs:website-catalog']).toBe('node scripts/generate-website-catalog.mjs');
    expect(pkg.scripts?.['docs:website-catalog:check']).toBe('node scripts/generate-website-catalog.mjs --check');
  });

  it('passes --check when committed catalog pages match the emitter', () => {
    const result = execFileSync(process.execPath, [script, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(result).toMatch(/up to date/i);
  });

  it('fails --check when a committed catalog page drifts', () => {
    const original = read(samplePage);
    writeFileSync(join(ROOT, samplePage), `${original}\n<!-- drifted -->\n`);
    try {
      try {
        execFileSync(process.execPath, [script, '--check'], {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        expect.unreachable('check should have failed');
      } catch (error) {
        const err = error as { status?: number; stderr?: string; stdout?: string };
        expect(err.status).toBe(1);
        expect(`${err.stderr ?? ''}${err.stdout ?? ''}`).toMatch(/out of date|drift/i);
      }
    } finally {
      writeFileSync(join(ROOT, samplePage), original);
    }
  });

  it('emits profile pages with a not-installable callout and only ${VAR} secret names', () => {
    const profile = read('website/src/content/docs/en/catalog/profiles/base.md');
    expect(profile).toMatch(/not installable|not-installable|browse-only/i);
    const github = read(samplePage);
    expect(github).toContain('${GITHUB_TOKEN}');
    expect(github).not.toMatch(/ghp_[A-Za-z0-9]+/);
  });

  it('writes the same English catalog descriptions into the es locale tree', () => {
    const en = read('website/src/content/docs/en/catalog/mcps/github.md');
    const es = read('website/src/content/docs/es/catalog/mcps/github.md');
    const enBody = en.split('\n---\n').slice(2).join('\n---\n');
    const esBody = es.split('\n---\n').slice(2).join('\n---\n');
    expect(esBody).toBe(enBody);
  });
});

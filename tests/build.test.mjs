import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { ROOT, TARGETS, packageFiles, syncBundle, writeZip } from '../scripts/build.mjs';

function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'tactic-bundles-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixture(t) {
  const root = temporary(t);
  for (const name of ['skills', 'platforms', 'assets', 'plugin.json', 'mcp.json', 'LICENSE']) {
    cpSync(join(ROOT, name), join(root, name), { recursive: true });
  }
  return root;
}

test('platform layouts preserve endpoint and use host-specific authentication', () => {
  for (const target of TARGETS.filter((target) => target !== 'cowork')) {
    const { files } = packageFiles(ROOT, target);
    let server;
    if (target === 'claude') {
      assert.ok(files['.claude-plugin/plugin.json']);
      assert.equal(files['plugin.json'], undefined);
      assert.equal(files['mcp.json'], undefined);
      server = JSON.parse(files['.mcp.json']).mcpServers.tactic;
      assert.equal(server.type, 'http');
    } else {
      assert.ok(files['plugin.json']);
      assert.equal(files['.claude-plugin/plugin.json'], undefined);
      server = JSON.parse(files['mcp.json']).mcpServers.tactic;
      assert.equal(server.type, 'streamable-http');
    }
    assert.equal(server.url, 'https://ai.gettactic.com/mcp');
    if (target === 'chatgpt') {
      assert.deepEqual(server.extensions['com.openai'].auth, {
        type: 'oauth', client: { mode: 'dcr' }, baseScopes: ['tactic', 'offline_access'],
      });
    } else assert.equal(server.extensions, undefined);
  }
});

test('all platforms contain identical skills and resolve icon paths', () => {
  const skills = (files) => Object.fromEntries(Object.entries(files).filter(([name]) => name.startsWith('skills/')));
  const expected = skills(packageFiles(ROOT, 'portable').files);
  assert.ok(Object.keys(expected).length >= 2);
  for (const target of TARGETS) assert.deepEqual(skills(packageFiles(ROOT, target).files), expected);
  for (const [name, data] of Object.entries(expected)) assert.deepEqual(data, readFileSync(join(ROOT, name)));
  const { files } = packageFiles(ROOT, 'chatgpt');
  const ui = JSON.parse(files['plugin.json']).extensions['com.openai'].interface;
  for (const key of ['logo', 'composerIcon']) assert.ok(files[ui[key].replace(/^\.\//, '')]);
});

test('ZIPs are reproducible and extract to the exact files without a wrapper', (t) => {
  const root = temporary(t);
  for (const target of TARGETS) {
    const { files } = packageFiles(ROOT, target);
    const first = join(root, 'first.zip');
    const second = join(root, 'second.zip');
    writeZip(first, files);
    writeZip(second, files);
    assert.deepEqual(readFileSync(first), readFileSync(second));
    const extracted = Object.fromEntries(Object.entries(unzipSync(readFileSync(first)))
      .map(([name, data]) => [name, Buffer.from(data)]));
    assert.deepEqual(extracted, files);
  }
});

test('check detects stale and extra files without writing', (t) => {
  const directory = join(temporary(t), 'bundle');
  const files = { 'plugin.json': Buffer.from('{}') };
  assert.equal(syncBundle(directory, files, true), false);
  assert.equal(existsSync(directory), false);
  syncBundle(directory, files, false);
  assert.equal(syncBundle(directory, files, true), true);
  const extra = join(directory, 'unexpected.txt');
  writeFileSync(extra, 'stale');
  assert.equal(syncBundle(directory, files, true), false);
  assert.equal(existsSync(extra), true);
  syncBundle(directory, files, false);
  assert.equal(existsSync(extra), false);
  writeFileSync(join(directory, 'plugin.json'), 'modified');
  assert.equal(syncBundle(directory, files, true), false);
  assert.equal(readFileSync(join(directory, 'plugin.json'), 'utf8'), 'modified');
});

test('unrelated files, credentials and executables are excluded', (t) => {
  const root = fixture(t);
  const skill = join(root, 'skills/tactic-plan-office-week');
  writeFileSync(join(root, '.env'), 'TOKEN=not-a-real-secret');
  for (const name of ['debug.json', 'run.sh', '.private.md']) writeFileSync(join(skill, name), 'unwanted');
  const { files } = packageFiles(root, 'portable');
  assert.ok(!Object.keys(files).some((name) => /\.env|debug|run\.sh|\.private/.test(name)));
});

test('symlinked skills and references, including broken links, are rejected', (t) => {
  const root = fixture(t);
  const external = join(root, 'skills/external');
  symlinkSync(join(ROOT, 'skills/tactic-plan-office-week'), external);
  assert.throws(() => packageFiles(root, 'portable'), /Symlinks/);
  rmSync(external);
  symlinkSync(join(root, 'missing'), join(root, 'skills/tactic-plan-office-week/references'));
  assert.throws(() => packageFiles(root, 'portable'), /Symlinks/);
});

test('invalid skill frontmatter and unsafe versions fail before packaging', (t) => {
  const root = fixture(t);
  const entry = join(root, 'skills/tactic-plan-office-week/SKILL.md');
  const original = readFileSync(entry);
  writeFileSync(entry, 'No frontmatter');
  assert.throws(() => packageFiles(root, 'portable'), /Missing frontmatter/);
  writeFileSync(entry, original);
  const path = join(root, 'plugin.json');
  const manifest = JSON.parse(readFileSync(path));
  manifest.version = '../outside';
  writeFileSync(path, JSON.stringify(manifest));
  assert.throws(() => packageFiles(root, 'portable'), /filename-safe/);
});

test('ZIP timestamps do not depend on the machine timezone', (t) => {
  const root = temporary(t);
  const script = `import {writeZip} from ${JSON.stringify(new URL('../scripts/build.mjs', import.meta.url).href)};
    writeZip(process.argv[1], {'hello.txt': Buffer.from('hello')});`;
  const paths = ['Pacific/Honolulu', 'Europe/Rome'].map((timezone, i) => {
    const path = join(root, `${i}.zip`);
    execFileSync(process.execPath, ['--input-type=module', '-e', script, path], {
      env: { ...process.env, TZ: timezone },
    });
    return path;
  });
  assert.deepEqual(readFileSync(paths[0]), readFileSync(paths[1]));
});

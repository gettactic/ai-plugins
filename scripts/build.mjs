#!/usr/bin/env node
// Build host-specific plugins from shared sources. No network access required.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { zipSync } from 'fflate';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const TARGETS = ['portable', 'chatgpt', 'claude', 'cowork', 'copilot-studio-setup'];
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const portablePath = (root, path) => relative(root, path).split(sep).join('/');

function rejectSymlink(path) {
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error(`Symlinks are not bundle sources or outputs: ${path}`);
  }
}

function readFile(path) {
  rejectSymlink(path);
  return readFileSync(path);
}

const readJson = (root, path) => JSON.parse(readFile(join(root, path)).toString('utf8'));

// Walk explicitly allowed directories only, rejecting links before traversal.
function walk(directory) {
  rejectSymlink(directory);
  return readdirSync(directory).sort().flatMap((name) => {
    const path = join(directory, name);
    rejectSymlink(path);
    return lstatSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function packageFiles(root, target) {
  if (!TARGETS.includes(target)) throw new Error(`Unknown target: ${target}`);
  const manifest = readJson(root, 'plugin.json');
  const mcp = readJson(root, 'mcp.json');
  const version = manifest.version ?? '';
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) {
    throw new Error('plugin.json needs a filename-safe semantic version');
  }
  if (manifest.name !== 'tactic') throw new Error('The published plugin identity must remain tactic');

  const files = {
    'README.md': readFile(join(root, 'platforms/bundle-readme.md')),
    LICENSE: readFile(join(root, 'LICENSE')),
    'assets/icon.png': readFile(join(root, 'assets/icon.png')),
  };
  const skills = join(root, 'skills');
  rejectSymlink(skills);
  const skillNames = readdirSync(skills).filter((name) => !name.startsWith('.')).sort();
  if (!skillNames.length) throw new Error('At least one skill is required');
  for (const name of skillNames) {
    const skill = join(skills, name);
    rejectSymlink(skill);
    if (!lstatSync(skill).isDirectory()) throw new Error(`Expected a skill directory: ${skill}`);
    const entry = join(skill, 'SKILL.md');
    const content = readFile(entry);
    const frontmatter = content.toString('utf8').match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatter) throw new Error(`Missing frontmatter: ${entry}`);
    if (!frontmatter[1].split('\n').includes(`name: ${name}`)) {
      throw new Error(`Skill name must match its folder: ${entry}`);
    }
    if (!/^description: \S.+$/m.test(frontmatter[1])) {
      throw new Error(`Missing skill description: ${entry}`);
    }
    files[portablePath(root, entry)] = content;
    // Only package Markdown references, never credentials, caches or executables.
    // lstat also detects broken symlinks (existsSync would miss those).
    const refs = join(skill, 'references');
    if (lstatSync(refs, { throwIfNoEntry: false })) {
      for (const path of walk(refs)) {
        if (path.endsWith('.md') && !relative(refs, path).split(sep).some((part) => part.startsWith('.'))) {
          files[portablePath(root, path)] = readFile(path);
        }
      }
    }
  }

  if (target === 'copilot-studio-setup') {
    const studioFiles = {
      'README.md': readFile(join(root, 'platforms/copilot-studio-readme.md')),
      'connection.txt': Buffer.from(`Name: Tactic\nDescription: ${manifest.description}\nServer URL: ${mcp.mcpServers.tactic.url}\nTransport: Streamable HTTP\nAuthentication: OAuth 2.0 with dynamic client registration and PKCE\n\nThese are setup values to enter in Studio, not an import manifest.\nUse Dynamic discovery where available. Never select anonymous/None.\n`),
      LICENSE: files.LICENSE,
      'assets/icon.png': files['assets/icon.png'],
    };
    for (const name of skillNames) {
      const prefix = `skills/${name}/`;
      const skillFiles = Object.fromEntries(Object.entries(files)
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, bytes]) => [path.slice(prefix.length), bytes]));
      studioFiles[`uploads/tactic-copilot-studio-${name.slice('tactic-'.length)}-${version}.zip`] = zipBytes(skillFiles);
    }
    return { version, files: studioFiles };
  } else if (target === 'cowork') {
    const server = mcp.mcpServers.tactic;
    if (server.type !== 'streamable-http' || new URL(server.url).protocol !== 'https:') {
      throw new Error('Cowork requires a remote HTTPS Streamable HTTP server');
    }
    const cowork = readJson(root, 'platforms/cowork.json');
    if (!/^[1-9]\d*\.\d+\.\d+$/.test(cowork.version ?? '')) {
      throw new Error('Cowork requires a three-part numeric app version with major version at least 1');
    }
    // Copilot Chat can't use DCR: the agent and the connector sign in through the same
    // OAuthPluginVault registration from the Teams Developer Portal.
    const plugin = readJson(root, 'platforms/copilot-plugin.json');
    const runtime = plugin.runtimes.find(({ type }) => type === 'RemoteMCPServer');
    if (runtime?.spec.url !== server.url) throw new Error('platforms/copilot-plugin.json must use the mcp.json server URL');
    if (runtime.auth?.type !== 'OAuthPluginVault' || !runtime.auth.reference_id) {
      throw new Error('platforms/copilot-plugin.json needs an OAuthPluginVault reference_id');
    }
    cowork.agentSkills = skillNames.map((name) => ({ folder: `./skills/${name}` }));
    cowork.agentConnectors = [{
      id: 'tactic', displayName: 'Tactic', description: manifest.description,
      toolSource: {
        remoteMcpServer: {
          mcpServerUrl: server.url,
          authorization: { type: 'OAuthPluginVault', referenceId: runtime.auth.reference_id },
        },
      },
    }];
    cowork.copilotAgents = { declarativeAgents: [{ id: 'tacticAgent', file: 'declarativeAgent.json' }] };
    files['declarativeAgent.json'] = jsonBytes(readJson(root, 'platforms/copilot-agent.json'));
    files['ai-plugin.json'] = jsonBytes(plugin);
    delete files['README.md'];
    delete files.LICENSE;
    delete files['assets/icon.png'];
    files['manifest.json'] = jsonBytes(cowork);
    for (const name of ['color.png', 'outline.png']) {
      files[name] = readFile(join(root, 'assets/cowork', name));
    }
    return { version: cowork.version, files };
  } else if (target === 'claude') {
    delete manifest.$schema;
    Object.assign(manifest, readJson(root, 'platforms/claude.json'));
    files['.claude-plugin/plugin.json'] = jsonBytes(manifest);
    for (const server of Object.values(mcp.mcpServers)) {
      if (server.type !== 'streamable-http') {
        throw new Error('Claude adapter currently supports remote HTTP only');
      }
      server.type = 'http';
    }
    files['.mcp.json'] = jsonBytes({ mcpServers: mcp.mcpServers });
  } else {
    if (target === 'chatgpt') {
      manifest.extensions = { 'com.openai': readJson(root, 'platforms/openai.json') };
      mcp.mcpServers.tactic.extensions = { 'com.openai': readJson(root, 'platforms/openai-auth.json') };
    }
    files['plugin.json'] = jsonBytes(manifest);
    files['mcp.json'] = jsonBytes(mcp);
  }
  return { version, files };
}

export function zipBytes(files) {
  const entries = {};
  for (const name of Object.keys(files).sort()) {
    entries[name] = [files[name], {
      // ZIP timestamps have no timezone. Use fixed local date components.
      mtime: new Date(2020, 0, 1, 0, 0, 0),
      os: 3,
      attrs: 0o100644 * 65536,
    }];
  }
  return Buffer.from(zipSync(entries, { level: 9 }));
}

export function writeZip(path, files) {
  writeFileSync(path, zipBytes(files));
}

export function syncBundle(directory, files, check) {
  const actual = {};
  if (lstatSync(directory, { throwIfNoEntry: false })) {
    for (const path of walk(directory)) actual[portablePath(directory, path)] = readFile(path);
  }
  if (isDeepStrictEqual(actual, files)) return true;
  if (check) return false;
  // This directory is generated and owned by this builder.
  rmSync(directory, { recursive: true, force: true });
  for (const [name, data] of Object.entries(files)) {
    const path = join(directory, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
  }
  return true;
}

function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
  const stale = [];
  const checksums = [];
  // Reject symlinked output parents before deleting/writing generated files.
  for (const name of ['bundles', 'dist']) {
    const path = join(ROOT, name);
    if (lstatSync(path, { throwIfNoEntry: false })) rejectSymlink(path);
  }
  for (const target of TARGETS) {
    const { version, files } = packageFiles(ROOT, target);
    if (!syncBundle(join(ROOT, 'bundles', target), files, values.check)) stale.push(target);
    if (!values.check) {
      const dist = join(ROOT, 'dist');
      mkdirSync(dist, { recursive: true });
      const filename = `tactic-${target}-${version}.zip`;
      const path = join(dist, filename);
      if (existsSync(path)) rejectSymlink(path);
      writeZip(path, files);
      checksums.push(`${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${filename}\n`);
      console.log(portablePath(ROOT, path));
      // Expose the Studio skill uploads directly as well as in the setup kit.
      if (target === 'copilot-studio-setup') {
        for (const [name, bytes] of Object.entries(files).filter(([name]) => name.startsWith('uploads/'))) {
          const filename = name.slice('uploads/'.length);
          const path = join(dist, filename);
          if (lstatSync(path, { throwIfNoEntry: false })) rejectSymlink(path);
          writeFileSync(path, bytes);
          checksums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${filename}\n`);
          console.log(portablePath(ROOT, path));
        }
      }
    }
  }
  if (values.check) {
    if (stale.length) throw new Error(`Stale bundles: ${stale.join(', ')}; run npm run build`);
    console.log('All tracked bundles match shared sources.');
  } else {
    writeFileSync(join(ROOT, 'dist/SHA256SUMS'), checksums.join(''));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

// Inspect the actual upload ZIP, not just the source tree. No tenant access.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import { unzipSync } from 'fflate';
import { parseDocument } from 'yaml';
import { ROOT } from './build.mjs';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, 'schemas/microsoft-teams-v1.29.json'))));

export function inspectCoworkZip(bytes) {
  const files = unzipSync(bytes);
  assert.ok(files['manifest.json'], 'manifest.json must be at the ZIP root');
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString('utf8'));
  assert.ok(validate(manifest), JSON.stringify(validate.errors, null, 2));
  assert.match(manifest.version, /^[1-9]\d*\.\d+\.\d+$/, 'Microsoft app version must have major version at least 1');
  for (const file of Object.values(manifest.icons)) assert.ok(files[file], `Missing icon: ${file}`);
  const skills = [];
  const names = new Set();
  for (const { folder } of manifest.agentSkills ?? []) {
    const path = folder.replace(/^\.\//, '');
    const file = `${path}/SKILL.md`;
    assert.ok(files[file], `Missing skill: ${file}`);
    const text = Buffer.from(files[file]).toString('utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    assert.ok(match, `Missing YAML frontmatter delimiters: ${file}`);
    const document = parseDocument(match[1]);
    assert.equal(document.errors.length, 0, `Invalid YAML in ${file}: ${document.errors.map((e) => e.message).join('; ')}`);
    const metadata = document.toJS();
    assert.ok(metadata && typeof metadata === 'object', `Expected YAML mapping: ${file}`);
    assert.equal(metadata.name, basename(path), `Skill name must match folder: ${file}`);
    assert.match(metadata.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(metadata.name.length <= 64, `Skill name too long: ${file}`);
    assert.ok(typeof metadata.description === 'string' && metadata.description.trim().length > 0 && metadata.description.length <= 1024,
      `Description must be a nonempty string of at most 1024 characters: ${file}`);
    assert.ok(!names.has(metadata.name), `Duplicate skill name: ${metadata.name}`);
    names.add(metadata.name);
    skills.push({ file, name: metadata.name, yaml: 'valid' });
  }
  return {
    result: 'Local ZIP checks passed; Microsoft tenant validation is still required',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    manifestVersion: manifest.manifestVersion,
    version: manifest.version,
    files: Object.keys(files).sort(),
    skills,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const version = JSON.parse(readFileSync(join(ROOT, 'platforms/cowork.json'))).version;
    const file = process.argv[2] ?? join(ROOT, 'dist', `tactic-cowork-${version}.zip`);
    console.log(JSON.stringify(inspectCoworkZip(readFileSync(file)), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

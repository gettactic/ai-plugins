import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import sharp from 'sharp';
import { ROOT, packageFiles, zipBytes } from '../scripts/build.mjs';
import { inspectCoworkZip } from '../scripts/validate-cowork.mjs';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, 'schemas/microsoft-teams-v1.29.json'))));

test('actual Cowork ZIP contains parseable YAML; malformed and mismatched metadata fail', () => {
  const { files } = packageFiles(ROOT, 'cowork');
  assert.equal(inspectCoworkZip(zipBytes(files)).skills.length, 2);
  const path = 'skills/tactic-plan-office-week/SKILL.md';
  for (const [content, message] of [
    ['No frontmatter', /Missing YAML frontmatter/],
    ['---\nname: tactic-plan-office-week\ndescription: invalid: mapping\n---\n', /Invalid YAML/],
    ['---\nname: other-name\ndescription: Valid text\n---\n', /Skill name must match folder/],
    ['---\nname: tactic-plan-office-week\ndescription: [not, text]\n---\n', /Description must be/],
  ]) {
    assert.throws(() => inspectCoworkZip(zipBytes({ ...files, [path]: Buffer.from(content) })), message);
  }
});

test('Cowork package passes Microsoft schema and resolves all skills and icons', () => {
  const { version, files } = packageFiles(ROOT, 'cowork');
  const manifest = JSON.parse(files['manifest.json']);
  assert.ok(validate(manifest), JSON.stringify(validate.errors, null, 2));
  assert.equal(manifest.version, version);
  assert.equal(manifest.manifestVersion, '1.29');
  assert.equal(manifest.id, JSON.parse(readFileSync(join(ROOT, 'platforms/cowork.json'))).id);
  assert.deepEqual(manifest.agentConnectors[0].toolSource.remoteMcpServer, {
    mcpServerUrl: JSON.parse(readFileSync(join(ROOT, 'mcp.json'))).mcpServers.tactic.url,
  });
  assert.equal(files['plugin.json'], undefined);
  assert.equal(files['mcp.json'], undefined);
  assert.equal(files['.claude-plugin/plugin.json'], undefined);
  for (const icon of Object.values(manifest.icons)) assert.ok(files[icon]);
  for (const { folder } of manifest.agentSkills) {
    const path = folder.replace(/^\.\//, '');
    const name = path.split('/').at(-1);
    assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(name.length <= 64);
    const skill = files[`${path}/SKILL.md`].toString();
    assert.ok(skill.startsWith(`---\nname: ${name}\n`));
    const description = skill.match(/^description: (.+)$/m)[1];
    assert.ok(description.length <= 1024);
    const companions = Object.entries(files).filter(([file]) => file.startsWith(`${path}/`) && !file.endsWith('/SKILL.md'));
    assert.ok(companions.length <= 20);
    assert.ok(companions.every(([, data]) => data.length <= 5 * 1024 * 1024));
    assert.ok(companions.reduce((size, [, data]) => size + data.length, 0) <= 10 * 1024 * 1024);
  }
  // Ensure the schema check really rejects unknown fields, not just parses JSON.
  assert.equal(validate({ ...manifest, packageName: 'not-supported' }), false);
});

test('Cowork PNGs have Microsoft dimensions and the correct backgrounds', async () => {
  const { files } = packageFiles(ROOT, 'cowork');
  for (const [name, size] of [['color.png', 192], ['outline.png', 32]]) {
    const metadata = await sharp(files[name]).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
  }
  const color = await sharp(files['color.png']).ensureAlpha().raw().toBuffer();
  assert.deepEqual([...color.subarray(0, 4)], [255, 255, 255, 255]);
  for (let i = 3; i < color.length; i += 4) assert.equal(color[i], 255);
  const outline = await sharp(files['outline.png']).ensureAlpha().raw().toBuffer();
  assert.equal(outline[3], 0);
  assert.ok(outline.some((value, i) => i % 4 === 3 && value > 0));
  for (let i = 0; i < outline.length; i += 4) {
    if (outline[i + 3] > 0) assert.deepEqual([...outline.subarray(i, i + 3)], [255, 255, 255]);
  }
});

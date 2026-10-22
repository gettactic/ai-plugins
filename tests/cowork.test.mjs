import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import sharp from 'sharp';
import { ROOT, packageFiles, zipBytes } from '../scripts/build.mjs';
import { inspectCoworkZip } from '../scripts/validate-cowork.mjs';
import { pinTools } from '../scripts/copilot-tools.mjs';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, 'schemas/microsoft-teams-v1.29.json'))));
const compileSchema = (name) => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas', name)));
  delete schema.$id;
  delete schema.id;
  return ajv.compile(schema);
};
const validateAgent = compileSchema('declarative-agent-v1.6.json');
const validatePlugin = compileSchema('copilot-plugin-v2.4.json');

test('actual Cowork ZIP contains parseable YAML; malformed and mismatched metadata fail', () => {
  const { files } = packageFiles(ROOT, 'cowork');
  assert.equal(inspectCoworkZip(zipBytes(files)).skills.length, 2);
  const invalidVersion = { ...JSON.parse(files['manifest.json']), version: '0.2.1' };
  assert.throws(() => inspectCoworkZip(zipBytes({
    ...files, 'manifest.json': Buffer.from(JSON.stringify(invalidVersion)),
  })), /major version at least 1/);
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
  const plugin = JSON.parse(readFileSync(join(ROOT, 'platforms/copilot-plugin.json')));
  assert.deepEqual(manifest.agentConnectors[0].toolSource.remoteMcpServer, {
    mcpServerUrl: JSON.parse(readFileSync(join(ROOT, 'mcp.json'))).mcpServers.tactic.url,
    authorization: { type: 'OAuthPluginVault', referenceId: plugin.runtimes[0].auth.reference_id },
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

test('Copilot Chat agent passes Microsoft schemas and pins every tool with its widget', () => {
  const { files } = packageFiles(ROOT, 'cowork');
  const manifest = JSON.parse(files['manifest.json']);
  const agent = JSON.parse(files['declarativeAgent.json']);
  const plugin = JSON.parse(files['ai-plugin.json']);
  assert.ok(validateAgent(agent), JSON.stringify(validateAgent.errors, null, 2));
  assert.ok(validatePlugin(plugin), JSON.stringify(validatePlugin.errors, null, 2));
  assert.deepEqual(manifest.copilotAgents.declarativeAgents, [{ id: 'tacticAgent', file: 'declarativeAgent.json' }]);
  assert.deepEqual(agent.actions.map(({ file }) => file), ['ai-plugin.json']);
  assert.ok(agent.instructions.length <= 8000);

  const [runtime] = plugin.runtimes;
  const tools = runtime.spec.mcp_tool_description.tools;
  assert.deepEqual(runtime.run_for_functions, tools.map(({ name }) => name));
  assert.deepEqual(plugin.functions.map(({ name }) => name), runtime.run_for_functions);
  for (const tool of tools.filter(({ name }) => name.startsWith('show_'))) {
    assert.match(tool._meta?.ui?.resourceUri ?? '', /^ui:\/\/tactic\//, `${tool.name} needs its widget binding`);
  }
});

test('pinTools keeps the widget binding and drops widget-only tools', () => {
  const plugin = { runtimes: [{ type: 'RemoteMCPServer', spec: { url: 'https://example.com/mcp' } }] };
  const pinned = pinTools(plugin, [
    {
      name: 'show_card',
      description: 'Shows a card.',
      inputSchema: { $schema: 'x', type: 'object', properties: { a: { $id: 'y', type: 'string' } } },
      _meta: { ui: { resourceUri: 'ui://tactic/show_card.html' }, securitySchemes: [] },
    },
    { name: 'get_workplace_request_upload_url', description: 'Widget only.' },
    { name: 'get_users_working_locations_at_week', description: 'Gets locations.' },
  ]);
  const [card, locations] = pinned.runtimes[0].spec.mcp_tool_description.tools;
  assert.deepEqual(pinned.runtimes[0].run_for_functions, ['show_card', 'get_users_working_locations_at_week']);
  assert.deepEqual(card.inputSchema, { type: 'object', properties: { a: { type: 'string' } } });
  assert.deepEqual(card._meta, { ui: { resourceUri: 'ui://tactic/show_card.html' } });
  assert.match(locations.description, /^Gets the reservations .*Gets locations\.$/);
});

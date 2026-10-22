#!/usr/bin/env node
// Refresh the tools pinned in platforms/copilot-plugin.json from a saved MCP tools/list response.
// Copilot Chat uses these copies for tool selection and widgets instead of the live list.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './build.mjs';

// Only callable from widgets, never by the model.
const WIDGET_ONLY = new Set(['get_workplace_request_upload_url']);

// Copilot matches tools on their descriptions; name the reservation lookup explicitly.
const DESCRIPTION_PREFIXES = {
  get_users_working_locations_at_week: 'Gets the reservations (desk, room and parking bookings) and working locations of one or more users '
    + 'for a week. Use it for "my reservations", "my bookings", "what have I booked", "when am I in the office" '
    + 'and "where are my colleagues this week". ',
};

const stripSchemaIds = (value) => {
  if (Array.isArray(value)) return value.map(stripSchemaIds);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== '$schema' && key !== '$id')
      .map(([key, item]) => [key, stripSchemaIds(item)]));
  }
  return value;
};

export function pinTools(plugin, tools) {
  const pinned = tools.filter(({ name }) => !WIDGET_ONLY.has(name)).map((tool) => {
    const entry = {};
    for (const key of ['name', 'description', 'inputSchema', 'annotations']) {
      if (key in tool) entry[key] = stripSchemaIds(tool[key]);
    }
    entry.description = (DESCRIPTION_PREFIXES[tool.name] ?? '') + entry.description;
    // Without the widget binding Copilot calls the tool but never renders its card.
    if (tool._meta?.ui) {
      entry._meta = { ui: tool._meta.ui };
      if (tool._meta['ui/resourceUri']) entry._meta['ui/resourceUri'] = tool._meta['ui/resourceUri'];
    }
    return entry;
  });
  const runtime = plugin.runtimes.find(({ type }) => type === 'RemoteMCPServer');
  plugin.functions = pinned.map(({ name, description }) => ({ name, description }));
  runtime.run_for_functions = pinned.map(({ name }) => name);
  runtime.spec.mcp_tool_description = { tools: pinned };
  return plugin;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: npm run tools:copilot -- <tools-list-response.json>');
    const response = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const tools = response.result?.tools ?? response.tools;
    if (!Array.isArray(tools)) throw new Error('Expected a tools/list response with result.tools');
    const path = join(ROOT, 'platforms/copilot-plugin.json');
    const plugin = pinTools(JSON.parse(readFileSync(path, 'utf8')), tools);
    writeFileSync(path, `${JSON.stringify(plugin, null, 2)}\n`);
    console.log(`Pinned ${plugin.functions.length} tools; bump the Cowork app version and run npm run build`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

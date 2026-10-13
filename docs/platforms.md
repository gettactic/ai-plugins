# Platform packaging and installation

Documentation checked on 2026-10-13. These are development packages, not approved
directory listings. Building a bundle does not deploy the MCP server.

## OpenAI / ChatGPT / Codex

Build and use `dist/tactic-chatgpt-<version>.zip`. This contains root `plugin.json`,
`mcp.json`, skills, and assets. OpenAI presentation/review fields come from
`platforms/openai.json`; its documented per-server OAuth configuration comes from
`platforms/openai-auth.json`. OAuth uses dynamic client registration with the
`tactic` and `offline_access` scopes.

Use the OpenAI developer portal's plugin validation and submission flow for the
ZIP. The new skills need to be tested in addition to the existing tool review
cases. OAuth and widgets require a live deployed backend and a demo account;
the ZIP only describes the connection and workflows.

Known schema discrepancy: the generic Agent Plugins 1.0 MCP schema rejects the
per-server `extensions` field, while OpenAI explicitly documents it for OAuth.
The portable package conforms to the generic shape; the ChatGPT variant retains
OpenAI's documented field. Do not describe generic schema validation of a copy
with that extension removed as full validation of the ChatGPT package. Portal
validation remains necessary.

Reference: https://developers.openai.com/plugins/build/plugins

## Claude

Private test: upload `dist/tactic-claude-<version>.zip` through Customize →
Plugins → Add → Upload plugin, then connect Tactic from the plugin's Connectors
tab. This variant has `.claude-plugin/plugin.json`, `.mcp.json` using `http`, and
the same skills. It intentionally excludes the portable root manifest so the
archive has exactly one plugin manifest.

Claude's directory listing fields (icon, privacy, terms, support, and documentation)
come from `platforms/claude.json` and are written into the generated manifest.
Keep edits in that source file so rebuilding preserves them.

Local check and interactive test from this repository:

```sh
claude plugin validate ./bundles/claude
claude --plugin-dir ./bundles/claude
```

The repository's `.claude-plugin/marketplace.json` also exposes the generated
Claude bundle for marketplace installation. Once these files are merged onto
the default branch, users with repository access can install in Claude Code:

```text
/plugin install tactic --marketplace gettactic/ai-plugins
```

For directory submission, select this repository and plugin path `bundles/claude`.
The tracked folder is generated so the portal can read a complete plugin without
running our builder. Use the same MCP URL as the connector listing to avoid
duplicating tools. A private repository can be reviewed under the portal's
access conditions; public listing requires a public repository. Select an
appropriate distribution license before publication; the current license
reserves rights and is not an open-source license.

References:
- https://claude.com/docs/plugins/build
- https://claude.com/docs/plugins/submit

## GitHub Copilot

The portable folder uses Agent Plugins 1.0, whose fixed components are root
`plugin.json`, root `mcp.json`, and `skills/`.

For Copilot CLI, after building:

```sh
copilot plugin install ./bundles/portable
```

Connect and authenticate Tactic in the host before testing. The packaged URL
does not contain credentials. Test OAuth, skill discovery, and text fallbacks;
an interactive MCP App working in ChatGPT is not proof that every Copilot
surface renders it. Other Copilot clients have their own installation controls.

Reference: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference

## Microsoft 365 Copilot / Copilot Cowork

Microsoft's WIQD tooling imports portable or Claude plugins into a Microsoft 365
project. The `wiqd plugin` command surface is currently alpha. Use the portable
folder as input, then perform Microsoft's tenant lifecycle:

```sh
wiqd plugin import --path ./bundles/portable \
  --privacy-url https://gettactic.com/privacy/policy \
  --terms-url https://gettactic.com/terms
```

In the imported project, inspect the converted skills, connector, and OAuth
configuration; then authenticate to the intended Microsoft tenant and run:

```sh
wiqd plugin validate
wiqd plugin provision --env dev
wiqd plugin package --env dev
wiqd plugin validate --mode deep --env dev
```

Provisioning establishes the app identity used by packaging. The portable ZIP
is import input, not an installable Microsoft 365 app ZIP. No Microsoft app ID,
OAuth registration, tenant provisioning, or end-to-end test is supplied here.
Keep generated tenant projects and environment files outside committed bundles
(the root `microsoft365-work/` directory is ignored for this purpose).

Reference: https://microsoft.github.io/wiqd/getting-started/build-a-plugin/

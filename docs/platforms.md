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

## Microsoft Copilot Studio

Run `npm run build`. For a Studio agent with **Build → Skills** (the GitHub
Copilot harness), upload each `dist/tactic-copilot-studio-<skill>-<version>.zip`
separately through **Add skill → Upload a skill**. Each archive has a root
`SKILL.md` and any supporting references; the reporting reference is preserved.

`dist/tactic-copilot-studio-setup-<version>.zip` is an extract-first handoff kit
containing those uploads, connection values generated from the canonical MCP
configuration, an icon, and instructions for both Studio experiences. It is not
a Power Platform solution or an automatic agent/connector installer. The generic
portable and Cowork plugin ZIPs are not Studio skill uploads either.

Connect the Tactic MCP separately in Tools. Standard-experience Studio documents
OAuth Dynamic discovery. For the new experience, select it if offered; Microsoft's
new-experience page doesn't enumerate the available authentication choices, so
that flow still needs tenant verification. Tactic uses DCR and PKCE and has no
static client secret to paste into a confidential-client-only form.

If the agent has Topics and no Skills section, it uses the standard harness and
cannot use these skill ZIPs. Its complete agent/connector package requires a
Power Platform solution export. See the [full setup instructions](../platforms/copilot-studio-readme.md).

References (checked 2026-10-15):
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/skills-add-existing
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/tools-add-mcp-server
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-solutions-import-export

## Microsoft 365 Copilot Cowork

Build with `npm run build` and upload `dist/tactic-cowork-<version>.zip`.
The Node pipeline assembles Microsoft's documented app package directly; no
Microsoft CLI, sign-in, tenant provisioning, or solution export is needed to
create the ZIP. It contains a v1.29 unified app manifest, two correctly sized
icons, the shared skills and references, and a remote MCP connector.

`platforms/cowork.json` stores the app's permanent ID and presentation metadata.
Keep that ID for updates. The Cowork app version also lives in that file and must
have a major version of at least 1. It is separate from manifest schema 1.29 and
the other hosts' plugin versions. The builder takes the connector description
from `plugin.json`, the server URL from `mcp.json`, and skill folders from `skills/`.
Bump the Cowork app version before uploading an update to an installed app.

Authentication uses Cowork's automatic OAuth Dynamic Client Registration (DCR).
The connector deliberately omits `authorization`; do not replace it with
`{ "type": "None" }` or a placeholder vault reference. Each user connects their
own Tactic account. This DCR package targets **Cowork**, not Copilot Chat or
Copilot Studio. Copilot Chat requires a separately configured OAuthPluginVault
registration. Studio uses its MCP onboarding or Power Platform solution flow.

Manifest 1.29 allows dynamic tool discovery without a packaged
`mcpToolDescription` file. Do not downgrade to 1.28 without adding the tool
metadata required by that version. No backend deployment is performed by the
package build; the hosted MCP must already be available.

### Manual internal upload

1. Use an account allowed to upload custom apps in your Microsoft 365 tenant.
2. In Microsoft 365 admin center, open **Agents → Tools → Registry → Upload**.
3. Select the Cowork ZIP as built, without extracting and re-zipping a parent folder.
4. Review its MCP and skill components, scope the intended users/groups, and install.
5. In Cowork, open **Sources & Skills → Plugins → Discover**, find Tactic,
   and connect your Tactic account.

This is internal distribution, not a public Partner Center submission. Cowork
and custom plugins must be enabled for the intended users. If your tenant
rejects the schema or does not expose this upload flow, retain the validation
message and check feature availability with your Microsoft admin.

### Test before rollout

Check the exact upload archive with `npm run validate:cowork` (or pass another
archive with `npm run validate:cowork -- /path/to/client-upload.zip`). This reads
the ZIP itself, validates its manifest, parses each skill's YAML, checks names
against folders, and prints its SHA-256 checksum. It does not contact Microsoft
or confirm acceptance by the tenant validator.

If the portal rejects it, retain the original ZIP and the portal's full error
or validation response, including a correlation ID if supplied. A debugging
summary claiming missing frontmatter is not enough to diagnose a failure: the
0.2.1 Cowork archive already contains valid YAML metadata and matching names.
Microsoft Agents Toolkit 1.1.18 did reject that archive for
`VersionHasMajorLessThan1`: its app version was 0.2.1. The replacement is 1.0.0;
the manifest schema remains 1.29. Do not distribute the earlier Cowork ZIP.

Run Microsoft's package validator as well as local checks before distributing:

```sh
npx --yes --package=@microsoft/m365agentstoolkit-cli@1.1.18 atk validate \
  --package-file dist/tactic-cowork-1.0.0.zip \
  --validate-method validation-rules --interactive false --telemetry false
```

These are the flags exposed by CLI 1.1.18; some Learn examples use older flag
names. On 2026-10-15, this command returned **59 passed** for the 1.0.0 ZIP with
SHA-256 `34cf235a7ec09aeaed9f996f045d559475c8fdd9ed73097c4ad4be8f407f2889`.
This is Microsoft package-rule validation, not a tenant installation, OAuth,
skill activation, or runtime test. Update the filename when releasing a new version.

Do not rename skills, change schema versions, or invent OAuth credentials merely
to try to clear an unspecified validation error.

- Connect a normal Tactic user and verify tool discovery and a read-only query.
- Ask for an office-week plan; verify colleague plans, existing reservations,
  and available desks are used without creating bookings automatically.
- With Reporting permission, request a workplace utilization comparison.
- Verify a colleague signs in with their own account and sees only permitted data.
- Test a confirmed booking in a test workspace and confirm cancellation/cleanup.

`npm test` checks the manifest against a vendored copy of Microsoft's 1.29
schema, skill references, icon dimensions/backgrounds, and deterministic ZIPs.
`npm run check` detects generated-file drift. These are local checks, not
Microsoft upload certification or proof that OAuth works in Cowork. The first
tenant upload and authenticated smoke test remain necessary.

The color icon uses a solid white background and Tactic's existing navy vector
mark. The outline icon uses a white mark on transparency. Their source is
`assets/tactic-mark.svg` (copied from `web/apps/web/public/images/favicon.svg`).
Regenerate them with `npm run icons:cowork`, then `npm run build`.

Microsoft also documents `atk import openplugin` for one-off Claude conversions.
It generates a preview manifest and placeholder OAuth registration references;
our pipeline avoids those placeholders by generating the documented Cowork DCR
configuration. The guide warns that `wiqd plugin import` does not yet scaffold
all deployment files, so importing with wiqd is not our packaging workflow.

Reference (checked 2026-10-15):
https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-plugin-development

The current **Agents → Tools → Registry → Upload** route is documented here:
https://learn.microsoft.com/en-us/microsoft-365/admin/manage/manage-plugins-skills-mcp-servers#upload-plugins-or-skills

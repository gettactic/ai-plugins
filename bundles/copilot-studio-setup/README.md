# Tactic for Copilot Studio

This is a setup kit containing **individual skill upload ZIPs**, connection
values, and the Tactic icon. Extract it first. The outer ZIP is **not a Power
Platform solution** and must not be uploaded to Import solution. It does not
create an agent or configure its MCP connection automatically.

## Identify your Studio experience

- A Build tab with a Skills component means the agent uses the GitHub Copilot
  harness. Follow the skill-upload steps below.
- An agent with Topics and Tools but no Skills component uses the standard
  harness. Connect the MCP through its Tools screen; these skill ZIPs are not
  supported there. A complete agent package uses a solution export instead.

The Studio GitHub Copilot harness and the separate GitHub Copilot coding product
are different hosts. Our generic portable plugin ZIP is not a Studio upload.

## Upload the skills in the new experience

Open your agent's Build tab, select Skills, then Add skill → Upload a skill.
Upload each ZIP from `uploads/` separately. Each contains one root `SKILL.md`;
the workplace-review ZIP also includes its referenced reporting guide.

These are the same shared skills used by the other Tactic packages. They provide
workflow instructions, not access to workplace data. Connect the MCP separately.

## Connect Tactic

Use the name, description, and URL in `connection.txt`.

For the new experience, open Build → Tools → Add → Model Context Protocol (MCP).
Enter the server details and configure OAuth. The current documentation does
not enumerate all authentication choices exposed in this experience. Use OAuth
Dynamic discovery if offered; if it only offers a client ID/secret flow, retain
the exact screen/error so we can configure a supported connection. Tactic uses
public-client DCR with PKCE, so do not invent a client secret or select None.

For the standard experience, open Tools → Add a tool → New tool → Model Context
Protocol. Select OAuth 2.0 → Dynamic discovery, create a connection, sign in to
Tactic, and add it to the agent. This flow is explicitly documented by Microsoft.

Keep authentication per user: each colleague connects their own Tactic account.
The organization must enable the required features and permissions; workplace
reporting requires Reporting access. Do not distribute test account passwords
or an author's access token in an agent or connector package.

## Test and share

Check that the server's tools appear. In Preview, ask for an office-week plan and
verify the tool trace uses actual Tactic data without creating bookings. With a
reporting-enabled user, request a historical utilization comparison and verify
that the reporting guide was available. Test a colleague with different
permissions before publishing. An upload succeeding does not verify OAuth or
tool behavior.

Publish and configure the desired channels and user access in your environment.
Uploading a skill alone neither publishes the agent nor grants colleague access.

## A complete agent ZIP for the standard experience

Create/configure the agent and connector in Studio, add them and their required
objects to an unmanaged solution, then export through Power Platform. Include
the custom connector and connection references; Microsoft specifies importing
custom connectors before the agent solution's connection references. Connections
and user authentication still need configuration in the destination environment.

No solution export or tenant credentials are included in this kit. A validated
agent/connector export is needed before this repository can maintain that full
solution package. Do not rename this setup ZIP to make it look like a solution.

## Sources and validation

Microsoft documentation checked 2026-10-15:

- Skill uploads: https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/skills-add-existing
- New-experience MCP: https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/tools-add-mcp-server
- Standard-experience OAuth discovery: https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent
- Standard-experience solution export: https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-solutions-import-export

The Node build checks source frontmatter and produces deterministic ZIPs. Tests
compare each extracted upload with its shared source, including reference files.
These packages have not yet been imported or authenticated in a Studio tenant.

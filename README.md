# Tactic AI integrations

Shared skills and platform packages for Tactic's hosted MCP server at
https://ai.gettactic.com/mcp. This repository contains integration instructions
and packaging metadata. The MCP implementation remains in `gettactic/core`;
interactive widgets remain in `gettactic/web`.

## Skills

- **Plan an office week:** compare colleagues' planned working locations,
  existing reservations, and available desks; explain the recommendation and
  prepare booking proposals.
- **Review workplace utilization:** compare historical occupancy, reservations,
  check-ins, and room usage; distinguish forecasts from historical results and
  prepare reports with practical recommendations.

Both skills require a connected Tactic account. Availability depends on Tessa
access, enabled organization features, and the user's permissions. Reporting
requires Reporting access. Skills add workflow guidance; they do not add API
capabilities or bypass account permissions.

## Build

Node.js 22 or newer and npm. The builder uses `fflate` for ZIP creation and
Node's built-in APIs and test runner. Cowork validation uses Ajv, and its vector
icon exports use Sharp:

```sh
npm ci
npm run build
npm test
npm run check
```

The build writes deterministic ZIPs and `SHA256SUMS` to ignored `dist/`, and
refreshes the tracked `bundles/` folders used for repository-based installation.
`npm run check` detects stale tracked bundles without writing files. CI builds and
uploads ZIPs as workflow artifacts; it does not publish directory listings.

| Output | Intended use |
| --- | --- |
| `dist/tactic-chatgpt-0.2.1.zip` | OpenAI / ChatGPT plugin upload; also the portable OpenAI plugin layout used by Codex |
| `dist/tactic-claude-0.2.1.zip` | Claude private upload; directory submission uses `bundles/claude` in this repository |
| `dist/tactic-portable-0.2.1.zip` | Agent Plugins 1.0 package for GitHub Copilot |
| `dist/tactic-cowork-0.2.1.zip` | Microsoft 365 Copilot Cowork app package for manual tenant upload |

OpenAI and ChatGPT use the same package. Microsoft 365 Copilot and GitHub
Copilot are different hosts: the portable ZIP is **not** a tenant-provisioned
Microsoft 365 app. Use the Cowork ZIP for that host; it includes the skills and
MCP connection with automatic OAuth registration. Upload it through the Microsoft
365 admin center, not Copilot Studio. See [platform instructions](docs/platforms.md).

## Maintain one source

Edit `skills/`, root `plugin.json` / `mcp.json`, `assets/`, and `platforms/`.
Do not hand-edit `bundles/`: regenerate and commit the outputs with the source
change. Bundle versions come from root `plugin.json`; bump it before a release.
The private `package.json` describes the build tooling and is never bundled.

The portable MCP definition stays vendor-neutral. The builder adds documented
OpenAI OAuth metadata for ChatGPT and converts the transport name to `http`
for Claude. Every package points to the same production MCP URL. No client
secrets, tokens, tenant identifiers, backend code, or local executables belong
in the bundles.

The earlier package in `core/plugins` remains available during the transition.
Use this repository for future skill and bundle releases; backend fixes still
go through the core deployment process.

## Validate before release

Read [the scenario checklist](docs/validation.md), test with a populated Tactic
demo account, and run each platform's validation. Static build checks do not
prove that OAuth, widgets, permissions, or model behavior work in a host.
The distribution license is intentionally undecided: the current LICENSE
reserves rights. Tactic must choose its distribution terms before public
publication. Claude's listing also requires this repository to be public.

Support: https://help.gettactic.com/hc/en-us

Privacy: https://gettactic.com/privacy/policy

Terms: https://gettactic.com/terms

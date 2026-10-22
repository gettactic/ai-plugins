# Microsoft schemas

Unmodified snapshots used by offline tests, not shipped in plugin ZIPs:

- `microsoft-teams-v1.29.json`, downloaded on 2026-10-15 from
  https://developer.microsoft.com/json-schemas/teams/v1.29/MicrosoftTeams.schema.json
- `declarative-agent-v1.6.json`, downloaded on 2026-10-21 from
  https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.6/schema.json
- `copilot-plugin-v2.4.json`, downloaded on 2026-10-21 from
  https://developer.microsoft.com/json-schemas/copilot/plugin/v2.4/schema.json

Update them deliberately when changing the manifest version in `platforms/cowork.json`
or the `$schema` of `platforms/copilot-agent.json` and `platforms/copilot-plugin.json`.
Schema validation does not replace Microsoft's upload checks or an authenticated
smoke test.

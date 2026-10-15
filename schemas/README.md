# Microsoft app manifest schema

`microsoft-teams-v1.29.json` is an unmodified snapshot downloaded on 2026-10-15
from https://developer.microsoft.com/json-schemas/teams/v1.29/MicrosoftTeams.schema.json.
It is used by offline tests, not shipped in plugin ZIPs. Update deliberately when
changing the manifest version in `platforms/cowork.json`. Schema validation does
not replace Microsoft's upload checks or an authenticated Cowork smoke test.

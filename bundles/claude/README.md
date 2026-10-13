# Tactic

Connect Tactic to plan your office week and review workplace utilization.
The plugin contains two skills and a connection to Tactic's hosted MCP server
at https://ai.gettactic.com/mcp.

**Plan an office week** compares colleagues' planned locations, your existing
bookings, and available desks. Try: “Help me choose two office days next week
when the most members of my team will be in.”

**Review workplace utilization** compares occupancy, reservations, check-ins,
and meeting-room usage. Try: “Review desk utilization in my default office for
the last 30 days compared with the previous period.”

After installing, connect the Tactic connector and sign in through its OAuth
flow. An existing Tactic account with Tessa access is required. Features and
data depend on your organization and permissions; reporting needs Reporting
access. For Claude, use the plugin's Connectors tab to connect Tactic. Hosts
may display interactive reports and booking cards differently.

Planning does not automatically book desks. Review proposed bookings and use
the confirmation flow. The plugin sends tool requests to Tactic's service
under your connected account; it contains no credentials or local scripts.

Source: https://github.com/gettactic/ai-plugins

For Claude Code, once the bundle is on the repository's default branch and
your GitHub account has repository access:

```text
/plugin install tactic --marketplace gettactic/ai-plugins
```

Support: https://help.gettactic.com/hc/en-us

Privacy: https://gettactic.com/privacy/policy

Terms: https://gettactic.com/terms

Copyright and distribution status: see LICENSE. This package is prepared for
testing; Tactic must decide distribution licensing before public publication.

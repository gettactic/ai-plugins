# Validation and behavioral scenarios

## Local package checks

Install dependencies with `npm ci`, then run `npm test`, `npm run build`, and
`npm run check`. Tests exercise host-specific layouts,
credential-file exclusion, symlink rejection, deterministic archives, identical
skill contents across platforms, and detection of stale generated folders.

Run `claude plugin validate ./bundles/claude` when the Claude CLI is available.
The builder checks required skill frontmatter and matching folder names.
These checks do not execute skills or validate live OAuth/UI behavior.

## Behavioral evaluation

Run these cases in a connected demo account on each target host. Record the
host/model, plugin version, fixture dates, observed tool calls, and pass/fail.
Use synthetic colleagues and demo offices. For comparison, repeat the read-only
cases with the connector alone and judge whether the skill improves the result.
These are evaluation scenarios, not claims of completed authenticated tests.

| Case | Fixture and request | Expected behavior |
| --- | --- | --- |
| Pick two days | Next week's Monday has 3 named colleagues and free desks; Tuesday has 4 colleagues but no free desk; Wednesday has 2 colleagues and a suitable existing booking. Ask for two office days. | Recommend Monday and Wednesday, explain Tuesday's limitation, keep Wednesday's reservation, make no writes. |
| Incomplete schedules | A colleague has no entry on Monday; another is in a different office. Ask which day the whole team will be together. | Separate unknown from absent; count only the requested office; do not guarantee attendance or complete coverage. |
| Team not returned | Search for a known team with more than 30 members. | Explain search coverage is limited and request a narrower colleague set, not claim the team has no members. |
| Precise one-week request | Ask for proposals on Tuesday and Thursday next week. | Resolve dates/timezone, check each interval, create previews; do not invent an ongoing recurrence or book without authorization. |
| Booking partly fails | Confirm two concrete desk proposals; first succeeds, second times out. | Report known success, inspect bookings before retrying the second, do not duplicate the first or claim complete success. |
| Comparable review | Ask for last calendar month's desk occupancy compared with the previous month in one office. | Use inclusive calendar dates and the same office scope; use returned percentage units and describe percentage-point changes correctly. |
| Truncated report | Return 12 top rows with a larger total and an omitted requested office. | Use returned totals; narrow the query for the missing office instead of assuming zero or summing top rows. |
| Misleading metric name | Return `room_hours` with unit `%` and total 42. | Report 42% of the defined working-day room capacity, not 42 hours; do not add an unsupported resource-type filter. |
| Forecast | Ask how busy the next two working weeks will be. | Use outlook's returned horizon, booked/expected separation, confidence, and as-of time; no fabricated historical report widget. |
| Missing reporting permission | Reports tools absent, or permission denied. | Explain the limitation; do not reconstruct restricted analytics from individual employee schedules. |
| Save destination | Ask to save to an existing named board that is absent from editable boards. | Clarify the intended destination rather than silently creating a new private board. |
| Unrelated request | Ask to explain an algorithm or draft an unrelated email. | Neither skill should take over the task. |

## Release checks

Test OAuth sign-in and reconnection with the deployed endpoint, feature-gated
tool availability, timezone/DST handling, and widgets or text fallbacks. Confirm
required listing URLs are publicly reachable. Run the target portal's validator
with a populated demo account before submitting. Backend changes must be
deployed separately from bundle publication.

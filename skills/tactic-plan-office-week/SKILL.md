---
name: tactic-plan-office-week
description: Plan which days to work from a Tactic office by comparing colleagues' working locations, existing bookings, and desk availability. Use for requests such as choosing two office days, coordinating a team week, or proposing desks on days with the most colleagues.
---

# Plan an office week

Use the connected Tactic MCP server. Tool names below are logical names; hosts may prefix them. Follow the live tool schemas and server instructions. If Tactic is disconnected, ask the user to connect it; do not substitute invented workplace data.

## Establish the planning constraints

Read `get_current_user_context` and resolve the requested week with the date tools. Use the user's default office unless they specify another. Preserve explicit weekdays, number of office days, working hours, accessibility or equipment needs, and named colleagues. Ask only for a missing constraint that changes the recommendation; do not ask the user to repeat preferences already supplied.

Resolve named colleagues with `find_users`, or a named team with `find_teams`. Disambiguate multiple matches. Team search currently omits teams with more than 30 members: an empty result does not prove a team is empty or absent. Request a narrower set of colleagues when necessary.

## Compare the week

1. Read `get_users_working_locations_at_week` for the user and the resolved colleagues, passing their returned email addresses and a date in the requested week. Use `get_users_in_office_at_week` when the question is about everyone in a particular office. Present existing locations with `show_users_working_locations` when available.
2. Compare actual dates and offices, not just weekday labels. Count distinct requested colleagues in the target office. A room booking, remote day, missing entry, or a booking in another office is not evidence of being present in this office. Missing data means unknown, not absent. Working locations describe plans, not guaranteed attendance.
3. Check `find_available_resources` for feasible candidate days, using the proposed working hours and any requested floor or zone resolved with `list_office_places`. Each availability interval is at most 24 hours; check separate days separately. The returned `total` is the availability count; the short list of resources is only a selection.
4. Keep an existing suitable desk reservation. Do not propose a duplicate or silently cancel or move an existing booking to improve the plan. If the user requests seats near colleagues, inspect `get_floor_occupancy` for that day and floor. Being on the same floor does not prove two desks are adjacent.

Prioritize the user's constraints, then overlap with the named colleagues, then usable desk availability. Break ties with the user's preferences. If there is no preference, show the tie instead of inventing a precise score. Do not silently trade away a required amenity or assume a public holiday calendar is available.

## Present the plan and act within its scope

Give a compact table: date, office, colleagues expected, current booking or desk option, and the reason for the recommendation. State the date range and office timezone, distinguish unknown schedules from confirmed plans, and identify days that remain unbooked.

For booking proposals, use `show_reservation_info` with resource IDs returned by availability. A request to plan or recommend does not authorize reservations. Apply the server's booking flow: the user can confirm in the card; call `create_reservation` yourself only when explicitly requested. A one-week plan does not imply an ongoing recurring booking.

If several bookings are authorized, track each result and report partial success by date. After a timeout or ambiguous write result, inspect the user's bookings before retrying so a successful but delayed request is not duplicated. If availability changes, report the affected day and propose an alternative without claiming that all days were booked.

If a host cannot render the preview, summarize the exact proposal in text and preserve the same authorization requirements. Do not claim a reservation or a working-location change happened until the corresponding supported action reports success; these tools cannot set a user's working location.

# Tactic report query guide

The live reporting catalog is authoritative for measure definitions, supported dimensions, and member IDs. Tools and permissions may vary by organization.

## Query shape

For a historical desk occupancy comparison, a starting query is:

```json
{
  "measure": "occupancy",
  "filters": [{"dimension": "resource_type", "in": ["desk"]}],
  "period": {"preset": "last_30_days"},
  "compare": "previous_period"
}
```

Add an office filter with an actual returned office ID for an office-scoped review. This example without that filter covers the offices the report permits; do not use it unchanged for a single-office question.

- Period presets: `last_7_days`, `last_30_days`, `last_90_days`, `year_to_date`, or `custom`. Custom `from` and `to` are inclusive ISO dates. Optional grain: `day`, `week`, `month`.
- Use a custom period for a calendar month; “last month” is not “last 30 days.” Account for a partial current period before describing changes.
- `compare` supports `previous_period` and `same_period_last_year`.
- `breakdown` accepts at most two supported dimensions. Typical review dimensions include office, floor, weekday, resource type, and team, but not every measure supports every dimension.
- Filter `in` values are catalog member IDs or documented enum values, never display names. A zone filter includes its child zones.
- `with` pairs compatible measures over the same scope. Both must have compatible units and support all dimensions used. Omit `compare` when `with` is present. To compare two offices, use an office filter or breakdown, not `with`.

## Interpret the response

Use the returned measure label, unit, and definition. Percentage results are already percentages; do not multiply by 100 again. A value whose returned unit is hours is already in hours. Several keys have non-obvious meanings:

- `occupancy` is reservation-based utilization, including dedicated desk-days, not measured physical presence.
- `checkin_rate` is the share of accepted reservations checked in, not the share of employees attending.
- `no_shows` counts reservations revoked by the office for missed check-in. Offices that do not cancel missed check-ins do not produce this measure; a zero is not proof of universal attendance.
- `room_hours` is a percentage of an eight-hour working day per room, despite its name. Do not label the returned percentage as raw hours. It already selects room usage and does not accept a `resource_type` dimension.

The tool returns a compact result: up to 12 top rows and 24 time-series points. Use returned totals for totals. When a requested comparison is hidden by truncation, make a narrower query instead of assuming omitted offices or dates are zero. Do not average group percentages without their denominators.

The `desks` total describes current inventory; its trend can describe inventory at each period end. Use the reporting service's own occupancy result rather than recomputing a historical percentage from the current total, and retain any historical inventory caveats the service returns.

For future demand, `report_outlook` supports desk/workspace or parking demand for the next ten working days. It returns booked-so-far, expected, capacity, confidence, and as-of values. Expected demand is an estimate based on recent history and is bounded by inventory. It is not a room forecast or a guarantee that a particular desk is available.

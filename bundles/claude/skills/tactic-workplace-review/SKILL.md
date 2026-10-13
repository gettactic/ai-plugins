---
name: tactic-workplace-review
description: Review Tactic workplace utilization across offices, floors, or time periods using occupancy, reservations, check-ins, no-shows, and meeting-room usage. Use for workplace performance reviews, identifying busy or underused days, comparing offices, or preparing a utilization report with recommendations.
---

# Review workplace utilization

Use the connected Tactic MCP server. Tool names below are logical names; hosts may prefix them. Follow the live schemas and reporting catalog. This workflow needs the organization's Reporting feature and the user's reporting permission. If reporting tools are absent or access is denied, explain that limitation; do not reconstruct restricted analytics from individual employee data.

## Frame a comparable question

Read `get_current_user_context` for accessible offices and reporting context, and resolve dates with the date tools. Use the user's requested scope. For an otherwise unspecified review, state a starting scope of the default office, last 30 days, compared with the previous period. Do not expand a single-office question to the whole organization.

Read [reporting-guide.md](references/reporting-guide.md) before building queries. Resolve dimension member IDs from the reporting context or discovery tools. Office names and guessed identifiers are not filter values.

## Build the evidence

Start with the metric that answers the user's question. For a general desk review, use occupancy and reservations, then inspect weekday or floor differences where supported. Add check-in rate or no-shows when needed to distinguish bookings from attendance signals. For meeting rooms, use room hours or reservations with supported room filters; do not apply desk capacity formulas to room usage.

Use `build_report_query` for historical results, holding scope, units, filters, and time grain consistent across comparisons. Run separate queries when measures have incompatible units or dimensions. The returned catalog and errors determine valid combinations; narrow or correct a rejected query without silently changing the question.

Separate totals from the tool's limited top rows and shortened time series. Do not sum visible rows to infer an organization total. Report zero, missing data, and permission failures distinctly. If a percentage changes from 40% to 50%, that is a 10 percentage-point increase; call it a 25% relative increase only when that calculation is useful and the baseline is nonzero.

Use `report_outlook` only for a requested forward-looking question within its returned horizon. Keep booked-so-far counts separate from expected demand and include its confidence and as-of time. A forecast is not an observed occupancy result.

## Deliver a useful review

Lead with the finding that best answers the question. Include the scope, exact period, comparison period when returned, units, and two or three supporting figures. Offer a small number of recommendations tied to those figures, distinguishing evidence from hypotheses. Low check-in rates alone do not prove absenteeism, and one quiet period does not justify a definitive real-estate decision.

Present historical queries with `show_report`, passing the exact successful query including any paired measure. If interactive reports are unavailable in the host, use a concise text table of the returned values and disclose truncation. Do not invent a chart URL or use `show_report` as if it supported an outlook query.

An analysis request does not imply saving or distributing a report. If the user asks to save it, use `list_report_boards` to resolve the intended editable board, then `save_report_to_board` with the validated query. A name that matches no editable board creates a new private board; clarify an ambiguous destination instead of unintentionally creating one. Preserve an explicit request for a new board. After an ambiguous write result, check the board state before retrying. Sharing and scheduling are separate actions and are not supported by this workflow's tools.

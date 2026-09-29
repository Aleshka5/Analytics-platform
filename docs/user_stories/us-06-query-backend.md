# US-06 — Query backend

**Depends on:** [US-05](us-05-mock-sidebar.md).

## Story

As a team member, I want the API to return one page of the table for my filters, sorting, and grouping, so that a later screen can show that view.

## In scope

- `POST /api/v1/datasets/{id}/rows` as in the [row query](../api-contract.md#query-rows).
- One combinator, `and` or `or`. The operators, three-sort limit, nulls last, and both group modes from [ADR 008](../adrs.md#adr-008).
- Page size fixed at 100. `page_size` in the body is ignored.
- `rowspan` returns detail rows and page-local `spans`. Group columns are the leading sort.
- `aggregate` returns one row per group, with `row_count` and sum/mean of each metric. `total_rows` counts groups.
- Validation errors `invalid_filter`, `invalid_sort`, `invalid_group`, and `invalid_page`.
- A filter that matches nothing returns an empty page and `total_rows: 0`.

## Out of scope

- Wiring **Apply** or building the data window.
- Export routes.
- Any change to the ten report routes. Querying rows does not change report numbers.

## Definition of done

- On the sample workbook, a filter `Region in [UAE, UK]` with `PnL gt 0` returns only those rows, 100 per page.
- `or` matches a row that satisfies either condition.
- Three sorts are accepted. A fourth sort is `invalid_sort`.
- `rowspan` on `Region` orders rows by region first, and `spans` refer only to rows inside the current page.
- `aggregate` on `Region` returns one row per region present in the filter, not the original 300 rows.
- Page 1 and page 2 of an unfiltered `rowspan` query do not share span indexes. A group that crosses the boundary appears again at the top of the next page.
- An unknown column, a `contains` on a metric, and `page: 0` fail with the contract codes.
- The report routes for the same id return the same bodies as before the query.

## Automated tests

- pytest for `and`, `or`, empty result, page size 100, and a page past the end (`invalid_page`).
- pytest that `rowspan` spans stay inside one page and that group keys lead the sort.
- pytest that `aggregate` totals are the group count and that numeric sum/mean match a hand-checked region on the sample file.
- pytest that a query does not change `GET .../summary` for that id.
- pytest for `invalid_filter` including the condition index in the message.

## Manual check

1. Upload the sample file and send a curl body with a region filter, a sort, and `page: 1`. Confirm 100 rows or fewer and the filter.
2. Send `mode: aggregate` on `Region` and confirm one row per region and a `row_count`.
3. Send a bad operator and confirm the error names the condition.
4. Call summary before and after a query and confirm the totals match.

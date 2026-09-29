# US-08 — Export backend

**Depends on:** [US-07](us-07-data-window.md).

## Story

As a team member, I want the API to build a report file and a table file, so that the page can offer those downloads.

## In scope

- `GET /api/v1/datasets/{id}/report` for `xlsx` and `pdf`, with `lang`, as in [Export report](../api-contract.md#export-report).
- All ten blocks are included. An `unavailable` block is present as its message. The file uses the full table, not the data-window filter.
- `POST /api/v1/datasets/{id}/rows/export` for `xlsx`, `csv`, and `json`, using the same body as the row query and ignoring `page`, as in [Export rows](../api-contract.md#export-rows).
- CSV is UTF-8 with a BOM and a comma separator. JSON is an array of objects. Excel uses one `Data` sheet for the table export.
- Filenames are attachments based on the original file stem.
- `unsupported_export_format` and `invalid_language` follow the contract.

## Out of scope

- The floating report button, the table **Export** button, dialogs, and the cooldown.
- Changes to report math or to the row-query rules.

## Definition of done

- Report Excel has the ten sheets in call order. Report PDF has the same sections in that order.
- `lang=ru` and `lang=en` change the insight sentence and any unavailable message inside the file. Sheet tab names stay English.
- A dataset whose dynamics block is `unavailable` still downloads, and that section contains the message.
- Table export of a filtered query contains every matching row, including rows past the first 100.
- Aggregate export contains group rows, not the original detail rows.
- A missing format and an unknown format are refused. The report routes and the row query stay unchanged.

## Automated tests

- pytest opens the xlsx report and checks sheet names, the sample `PnL` sentence in English, and the Russian sentence when `lang=ru`.
- pytest builds a PDF and checks that the insight text is present.
- pytest compares a filtered csv row count with `total_rows` from `POST .../rows` for a result larger than 100 rows, using a generated table if the sample filter is smaller than that.
- pytest checks the CSV BOM, json array length, and `unsupported_export_format`.
- pytest that an unavailable section does not turn the report request into an error.

## Manual check

1. With curl, download the sample report as Excel and as PDF in both languages. Open each file and confirm the ten sections and the translated insight.
2. Download a csv of a region filter and open it in a spreadsheet. Confirm the header, the region, and that Unicode names are intact.
3. Download json and Excel for the same body and confirm the row counts match.
4. Download an aggregate export and confirm one row per group.

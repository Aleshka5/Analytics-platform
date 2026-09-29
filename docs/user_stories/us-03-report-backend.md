# US-03 — Report backend

**Depends on:** [US-02](us-02-mock-main-page.md).

## Story

As a team member, I want the API to accept a file and return each base-report block, so that the page can later show real figures for the whole file.

## In scope

- `POST /api/v1/datasets`, `PUT .../sheet`, and `DELETE .../datasets/{id}` as in the [API contract](../api-contract.md#upload-dataset).
- The ten report routes, their query parameters, suggestions, and `unavailable` results.
- Column roles and the calculation rules in [ADR 006](../adrs.md#adr-006) and [ADR 007](../adrs.md#adr-007).
- In-memory store, 60-minute lifetime, single worker, no login ([ADR 004](../adrs.md#adr-004)).
- Localized `message` text for the [unavailable codes](../api-contract.md#message-catalog) and for upload errors.
- Readers for csv, tsv, xlsx, xls, json, and parquet. First row is the header. One Excel sheet is selected automatically. Several sheets return `sheet_required` until `PUT .../sheet`.

## Out of scope

- Changes to the React page. It keeps using fixtures.
- `POST .../rows`, both export routes, filters, and grouping modes of the data window.

## Definition of done

- Upload of `data/global_brokerage_dataset.xlsx` returns `ready` with sheet `Brokerage_Data`.
- Suggestions for that file are metric `Quantity`, category `Region`, datetime `Transaction_Date`.
- Called in order, the ten routes return `ok`. Dynamics grain is `day`. The strongest insight is `PnL`, about −30.1% between the two halves of the period.
- `lang=ru` and `lang=en` change insight text and error messages. Column names stay as in the file.
- A csv with no date column makes the dynamics route `unavailable` and still lets the other routes return.
- A workbook with two sheets stays unparsed until a sheet is chosen. A bad sheet name, an empty file, an unsupported extension, and a body over 100 MB fail with the contract codes.
- `DELETE` removes the id. An expired or unknown id is `dataset_not_found`.
- The React page from US-02 still renders from fixtures and does not call these routes.

## Automated tests

- pytest against the sample workbook for suggestions, daily grain, preview size 20, and the `PnL` insight direction.
- pytest for `sheet_required`, `sheet_not_found`, `file_too_large`, `unsupported_format`, `empty_file`, and `no_data_rows`.
- pytest that a table with no datetime column returns `no_datetime_column` and the Russian message when `lang=ru`.
- pytest that `DELETE` then `GET` of a section returns `dataset_not_found`.
- A clock or TTL test that an entry older than 60 minutes is gone.

## Manual check

1. Start the stack and upload the sample workbook with curl. Save the `dataset_id`.
2. Call the ten routes in order with `lang=en`, then insights with `lang=ru`. Confirm English and Russian sentences and the same numbers.
3. Upload a two-sheet workbook, confirm analysis is refused, choose a sheet, then confirm preview works.
4. Upload a file larger than 100 MB and confirm the request is refused.
5. Open the page and confirm it still shows fixture cards and does not change after these API calls.

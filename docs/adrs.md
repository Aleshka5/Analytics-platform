# Architecture Decision Records

Decisions for the internal analytics tool. Each record is accepted. Constraints that bound the implementation are in [ADR 013](#adr-013).

<a id="adr-001"></a>

## ADR 001 — Stack

**Accepted.** Python and React, as in `AGENTS.md`. The user asked for React with JavaScript, so the UI is JavaScript rather than TypeScript.

- HTTP API: FastAPI, with request and response models in Pydantic.
- Tables: pandas.
- Excel `.xlsx`: openpyxl. Excel `.xls`: xlrd. Parquet: pyarrow.
- PDF reports: reportlab, so the PDF path does not need a browser or system rendering libraries.
- UI: one React page. Charts on the Dynamics card: a small line chart component. Internationalization: i18next, with catalogs `en.json` and `ru.json`.
- Configuration: `.env` loaded by pydantic-settings.
- Containers: Podman, invoked through the Makefile. The API and the page join one network, `analitics_platform_network`, and reach each other there by container name (`analytics-api`, `analytics-web`). Host ports stay for the browser and the health check.

Backend layout stays small:

| Package | Responsibility |
| --- | --- |
| `api` | Routes and HTTP schemas |
| `domain` | Roles, filters, insights, time grain |
| `services` | Load a file, run one section, query rows, build an export |
| `infrastructure` | In-memory dataset store and file readers |
| `config` | Settings |

<a id="adr-002"></a>

## ADR 002 — Languages

**Accepted.** Russian and English.

The first visit uses the browser language (`ru` when the tag starts with `ru`, otherwise `en`). The Header switch writes the choice to `localStorage`.

The client translates chrome. The server translates insight sentences and error messages, selected by `lang` or `Accept-Language`. Column names from the file stay as they are. A language change refetches the whole report sequence.

<a id="adr-003"></a>

## ADR 003 — Files the server will read

**Accepted.** Extensions: `.csv`, `.tsv`, `.xlsx`, `.xls`, `.json`, `.parquet`.

JSON is an array of objects or NDJSON. CSV and TSV use a detected delimiter and a detected encoding. The first row is the header. Duplicate header cells are renamed with `_2`, `_3`, and so on.

The upload limit is 100 MB of uploaded bytes, checked in the browser and again on the server. The limit is the file size, not the size of the table after parsing.

Pickle and the other pandas readers stay out of the product because they can execute code or pull in formats this tool does not need.

An Excel workbook with one sheet is parsed immediately. A workbook with several sheets returns `sheet_required` and waits for `PUT .../sheet`.

<a id="adr-004"></a>

## ADR 004 — Where the table lives

**Accepted.** After a successful parse, the table is stored in the memory of the API process under a UUID. The lifetime is 60 minutes from upload. There is no login and no user account. Whoever has the id can read that dataset until it expires.

A replace is a new `POST` followed by `DELETE` of the previous id, and only after the new dataset is `ready`.

The process is a single worker. A restart clears the store. A note on moving this store to Redis is in [for-future.md](for-future.md).

<a id="adr-005"></a>

## ADR 005 — One route per report block

**Accepted.** The base report is ten GET routes, called in order, each after the previous response. See the [call order](api-contract.md#conventions).

A block that cannot be calculated returns **200** `status: "unavailable"` and a localized message. The client paints that card red and continues. HTTP 4xx and 5xx are reserved for bad requests, a missing dataset, a missing sheet choice, and unexpected failures.

The report always describes the full table. `POST .../rows` never changes those ten blocks.

<a id="adr-006"></a>

## ADR 006 — Column roles and the sample file

**Accepted.** Roles and suggestions follow [Column roles](api-contract.md#column-roles).

Checked against `data/global_brokerage_dataset.xlsx`:

| Column | Observed shape | Role |
| --- | --- | --- |
| `Transaction_Date` | 90 dates, 2025-01-01 to 2025-03-31 | `datetime` |
| `Client_ID` | 50 distinct values | `text` |
| `Region` | 7 distinct values | `category` |
| `Asset` | 10 distinct values | `category` |
| `Transaction_Type` | 2 distinct values | `category` |
| `Quantity` through `Risk_Score` | numeric, no empty cells | `metric` |

Suggestions for that file are metric `Quantity` (first numeric column), category `Region` (first category column), datetime `Transaction_Date`. Cards expose selectors so the user can point ranking, grouping, and dynamics at `PnL` or another metric.

<a id="adr-007"></a>

## ADR 007 — How each report block is calculated

**Accepted.**

| Block | Rule |
| --- | --- |
| Preview | First 20 rows |
| Summary | Numeric: count, mean, std, min, quartiles, max. Other columns: count, unique, top, freq |
| Ranking | Five highest and five lowest values of the metric. A higher value is the top. Nulls omitted |
| Grouping | One category. Count, sum, and mean of the metric. Ordered by sum descending. At most 100 groups |
| Dynamics | Sum of the metric. Grain is `month` when the date span is greater than 90 days, otherwise `day`. The sample span is 89 days, so the grain is `day` |
| Insights | With a date column: up to five metrics with the strongest relative change between the two halves of the period. The sample split point is 2025-02-14 12:00:00, and the strongest change is `PnL` at about −30.1%. Without a date column: up to three missing-value shares, then the most frequent category value |

Half-period sums skip a metric whose first-half sum is 0. If that removes every metric, and the distribution fallback also has nothing to say, the insights block is `unavailable`.

<a id="adr-008"></a>

## ADR 008 — Filters, sort, and the two group modes

**Accepted.** The sidebar edits a draft. Apply sends it to `POST .../rows` and opens the data window.

- One combinator for the whole filter list: `and` or `or`.
- Operators are the set in the [row query](api-contract.md#query-rows). The form only offers operators that match the column role.
- At most three sort keys. Nulls sort last.
- Group mode `rowspan` returns detail rows and page-local merge spans. Group columns sort first.
- Group mode `aggregate` returns one row per group with `row_count` and sum/mean of each metric.
- Page size is 100. The export of this window ignores the page and writes every matching row.

<a id="adr-009"></a>

## ADR 009 — Exports

**Accepted.**

| Action | Formats | Scope | Language |
| --- | --- | --- | --- |
| Report button | Excel, PDF | All ten blocks on the full table | Active UI language, generated on the server |
| Data-window button | Excel, CSV, JSON | The applied filter, sort, and group, all rows | Cell values unchanged. Error text follows `lang` |

An unavailable block is included in the report as its message, and the export still succeeds.

The 10-second cooldown is enforced in the browser, starting when the report download request is sent. It is there to slow repeated clicks. It is a UI control, not an authentication mechanism.

<a id="adr-010"></a>

## ADR 010 — Surfaces

**Accepted.** The report is a stack of cards on the page. Over the page, only these surfaces open:

- Worksheet dialog, when a workbook has several sheets.
- Settings sidebar, from the semicircle tab on the right edge.
- Data window, after a successful Apply.
- Format dialog, from either export button.

Report cards are not dialogs. The collapsed upload bar remains on the page above the cards.

<a id="adr-011"></a>

## ADR 011 — Data window interaction

**Accepted.**

- The window pans on both axes by dragging.
- Zoom runs from 50% to 200% in steps of 10%.
- A fine pointer gets **+** and **−**. A coarse pointer pinches to zoom, and those buttons are hidden.
- The pinch hint is an inline SVG of two circles, drawn in this repository, looping at the bottom-left. It is not a downloaded animation.
- Pagination, close, and export stay outside the scaled surface.
- The red cross closes the window and keeps the applied settings.

<a id="adr-012"></a>

## ADR 012 — Error display

**Accepted.**

| Situation | What the user sees |
| --- | --- |
| Upload or sheet failure | Message under the upload button. The previous ready dataset stays |
| Section `unavailable`, or a failed section request | That card turns red and shows the message. Later cards still load |
| Apply returns 422 | Message at the top of the sidebar. The data window does not open on the bad draft |
| Export failure | Message in the format dialog |

Shared HTTP errors use the [error body](api-contract.md#conventions).

<a id="adr-013"></a>

## ADR 013 — Constraints

**Accepted.** These bounds are part of the product.

- One API worker. Dataset memory belongs to that process.
- No accounts, sessions, or roles.
- Upload size cap 100 MB.
- Report page size for preview is 20 rows. Data-window page size is 100 rows.
- Ranking length is five. Grouping returns at most 100 groups.
- Sort keys are at most three. Filter combinators do not nest.
- Report math ignores the data-window filter.
- Cooldown is client-side only.
- Documents, code, and comments are in English. The two catalogs and the API message table hold the Russian UI copy.

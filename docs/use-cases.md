# Use Cases

The actor is a person on the team who has the page open. There is no login ([ADR 004](adrs.md#adr-004)).

<a id="uc-1"></a>

## UC-1 — Upload a file

The page opens with a full-width drop zone and a centered **Upload file** button ([Upload zone](design.md#upload-zone), [Page layout](design.md#page-layout)).

The user either drops a file on the zone or picks one through the button. The file is one of csv, tsv, xlsx, xls, json, or parquet, and it is at most 100 MB ([ADR 003](adrs.md#adr-003)).

The browser checks the size, then `POST /api/v1/datasets` runs ([Upload](api-contract.md#upload-dataset)). A `ready` response collapses the zone upward and the button becomes **Replace file**.

A file that is too large, empty, unreadable, or of another type shows the error under the button and leaves the zone expanded ([ADR 012](adrs.md#adr-012)).

<a id="uc-2"></a>

## UC-2 — Choose a worksheet

When the workbook has more than one sheet, the upload returns `sheet_required` ([Upload](api-contract.md#upload-dataset)). A dialog lists the sheet names ([Upload zone](design.md#upload-zone), [ADR 010](adrs.md#adr-010)).

The user confirms one name. `PUT .../sheet` parses that sheet ([Select sheet](api-contract.md#select-sheet)). The zone then collapses as in UC-1.

Cancel deletes the upload. A one-sheet workbook skips this dialog.

<a id="uc-3"></a>

## UC-3 — Read the base report

After the dataset is `ready`, the page requests the ten blocks in order and reveals each card when its response arrives ([Report sequence](design.md#report-sequence), [Call order](api-contract.md#conventions), [ADR 005](adrs.md#adr-005)).

The cards show the preview, columns, size, types, missing values, summary, top and worst, grouping, dynamics, and insights ([section routes](api-contract.md#preview)). Selectors start from the suggested columns ([ADR 006](adrs.md#adr-006)). On the sample file those are `Quantity`, `Region`, and `Transaction_Date`, with daily dynamics because the span is 89 days ([ADR 007](adrs.md#adr-007)).

Changing a selector refetches that card. The figures always describe the whole file.

<a id="uc-4"></a>

## UC-4 — A block cannot be calculated

A block such as dynamics, when the table has no date column, returns **200** `unavailable` with a localized message ([Section envelope](api-contract.md#conventions), [Unavailable codes](api-contract.md#message-catalog)).

That card is drawn with a red border and the message as its body ([Unavailable card](design.md#report-sequence)). The following cards still load ([ADR 012](adrs.md#adr-012)). The same red card is used when the request itself fails.

<a id="uc-5"></a>

## UC-5 — Change the language

The Header offers `RU` and `EN` ([Language](design.md#language), [ADR 002](adrs.md#adr-002)). The first visit follows the browser language; the switch is remembered in the browser.

Chrome strings switch at once ([Chrome strings](design.md#strings)). The report sequence runs again with `lang`, so insight sentences and unavailable messages match the language ([Insights](api-contract.md#insights)). An export started afterward uses the same language ([ADR 009](adrs.md#adr-009)).

<a id="uc-6"></a>

## UC-6 — Set filters, sorting, and grouping

A semicircle on the right edge opens the settings panel over the page ([Settings sidebar](design.md#sidebar), [ADR 010](adrs.md#adr-010)).

The user sets a single AND/OR combinator, conditions, up to three sorts, group columns, and either merged cells or aggregated rows ([ADR 008](adrs.md#adr-008)). **Apply** is at the bottom of the list.

Apply calls `POST .../rows` ([Query rows](api-contract.md#query-rows)). Success closes the panel and opens the data window. A rejected body stays in the panel with the error at the top. Closing the panel without Apply throws away the draft.

<a id="uc-7"></a>

## UC-7 — Browse the data window

The window shows the current 100-row page ([Data window](design.md#data-window)). Merged-cell mode paints the page-local `spans`. Aggregated mode shows one row per group.

The user drags the surface on both axes and zooms between 50% and 200%. A desktop pointer uses **+** and **−**. A touch pointer pinches, and a looping two-circle hint sits at the bottom-left ([ADR 011](adrs.md#adr-011)).

Previous and next load another page with the same settings. The red cross closes the window and keeps those settings for the next Apply.

<a id="uc-8"></a>

## UC-8 — Export the table

**Export** at the bottom-right of the data window offers Excel, CSV, and JSON ([Table export](design.md#data-window)).

The download is `POST .../rows/export` with the applied body ([Export rows](api-contract.md#export-rows)). The file contains every matching row, not only the page on screen ([ADR 009](adrs.md#adr-009)).

<a id="uc-9"></a>

## UC-9 — Export the report

When all ten cards have settled, a viewport-fixed **Export** button appears, full pill for 10 seconds, then a circle with a page icon. Hover on a desktop pointer expands the circle again ([Report export button](design.md#report-export)).

The user chooses Excel or PDF. The client calls `GET .../report` with the active language ([Export report](api-contract.md#export-report)). Unavailable blocks are written in as their messages. Sending the request disables the button for 10 seconds and plays the cooldown arc.

This export covers the full-file report. It does not apply the data-window filters ([ADR 005](adrs.md#adr-005)).

<a id="uc-10"></a>

## UC-10 — Replace the file

On the collapsed bar the user drops a new file or presses **Replace file** ([Upload zone](design.md#upload-zone)).

The new upload follows UC-1 and, when needed, UC-2. After the new dataset is `ready`, the client deletes the previous id ([Delete dataset](api-contract.md#delete-dataset), [ADR 004](adrs.md#adr-004)), clears the cards, resets the sidebar, and closes the data window. The report sequence of UC-3 starts for the new id.

If the new upload fails, the current report stays in place ([ADR 012](adrs.md#adr-012)).

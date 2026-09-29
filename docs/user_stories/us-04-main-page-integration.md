# US-04 — Main page on the API

**Depends on:** [US-03](us-03-report-backend.md).

## Story

As a team member, I want the main page to load a real file and fill the report from the API, so that the cards show that file instead of the fixture.

## In scope

- Wire the existing upload zone, sheet dialog, and ten cards to US-03. Remove the fixture path from the page.
- Sequential loading: the next card request starts only after the previous response. Each card shows a skeleton until then.
- A `ready` upload collapses the zone. `sheet_required` opens the existing dialog. Confirm calls `PUT .../sheet`. Cancel calls `DELETE` and leaves the previous ready dataset in place when this was a replace.
- Replace uploads the new file first and deletes the previous id only after the new one is `ready`. A failed upload keeps the current report.
- Selectors refetch only their own card. A language change runs the ten requests again with `lang`.
- `unavailable` and a failed section request paint that card red with the server message and the sequence continues.
- Server messages are shown as received. This story adds no new catalog strings.

## Out of scope

- Sidebar, data window, export buttons, and the row-query API.
- Changes to calculation rules or new routes.

## Definition of done

- Dropping and picking a file both upload to `POST /api/v1/datasets`.
- The sample workbook collapses the zone and reveals ten cards in order, with selectors starting at `Quantity`, `Region`, and `Transaction_Date`.
- Changing the ranking metric refetches ranking only. The network log shows one new ranking call.
- Switching language refetches all ten blocks and the insight sentence matches the language.
- A csv with no date column makes the dynamics card red and still shows the other cards.
- Replace swaps the report only after success. A rejected second file leaves the first report on screen.
- The sheet dialog lists real sheet names. Cancel on a replace keeps the original report.
- The page no longer contains the US-02 fixture dataset.

## Automated tests

- With a mocked API, cards appear one after another, and a red dynamics body does not stop summary from rendering.
- Replace: a failed second upload does not call `DELETE` for the current id.
- Sheet cancel on a replace calls `DELETE` for the new id and keeps the previous id on screen.
- The metric selector requests ranking with that metric and does not request insights.

## Manual check

1. Upload `data/global_brokerage_dataset.xlsx` by drop, then again with the button as a replace. Confirm both paths work and the cards match the file (300 rows, region grouping, a daily chart).
2. Change `Quantity` to `PnL` on ranking and on dynamics. Confirm the other cards stay put.
3. Switch to Russian and confirm the insight text changes and the card titles were already Russian from US-02.
4. Upload a small csv that has only text and numbers, no date. Confirm the dynamics card is red and the rest of the report is still there.
5. Start a replace with a `.png` or a file over 100 MB. Confirm the original report remains.
6. Upload a two-sheet workbook, cancel, and confirm the previous report remains. Upload it again, pick a sheet, and confirm cards load.

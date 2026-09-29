# US-09 — Export controls

**Depends on:** [US-08](us-08-export-backend.md).

## Story

As a team member, I want export buttons on the report and on the table, so that I can download the view I am looking at in the language I selected.

## In scope

- Viewport-fixed report button from the [design doc](../design.md#report-export). It appears after all ten cards have settled, including red cards.
- It shows the pill with the page icon and **Export** for 10 seconds, then a circle with the icon. Fine-pointer hover expands the circle. Touch stays on the circle until a tap opens the dialog.
- The dialog offers Excel and PDF. Confirm calls `GET .../report` with the active `lang` and starts the 10-second cooldown arc. The button is disabled during that arc. Closing the dialog without a choice does not start the cooldown.
- Table **Export** at the bottom-right of the data window offers Excel, CSV, and JSON and calls `POST .../rows/export` with the applied body.
- A failed download shows the server message in the format dialog.
- Russian and English strings for these controls. Strings already added by earlier stories stay as they are.

## Out of scope

- Changes to file contents, report math, or the data window other than the export button.
- A server-side rate limit. The cooldown is only in the browser ([ADR 009](../adrs.md#adr-009)).

## Definition of done

- After the sample report finishes loading, the button appears as a pill, then becomes a circle at 10 seconds. Hover on a desktop pointer expands it.
- Choosing PDF or Excel downloads the matching file in the active language.
- A second click during the cooldown does nothing. After 10 seconds the button works again.
- Opening the format dialog and dismissing it leaves the button active.
- The table button downloads the full filtered set in the chosen format, not only the visible page.
- The report button does not appear before the tenth card settles. A red card still counts as settled.
- On a narrow screen the report button stays on screen while the page scrolls, and it does not cover the sidebar tab.

## Automated tests

- The report button is absent while a card is still a skeleton and present once the sequence settles, including a red card.
- A fake timer advances 10 seconds and the button collapses from the pill to the circle.
- Confirming a format calls the report route with `lang` and disables the button. Dismissing the dialog does not.
- The table export calls the rows export route with the applied filter and the chosen format, without a page limit.

## Manual check

1. Upload the sample file and watch the report button: pill, then circle. Hover it on a desktop browser.
2. Download Excel, switch the page to Russian, and download PDF. Open both and confirm the language of the insight.
3. Click export, confirm a format, and try to press the button again during the arc. Confirm it stays disabled, then works after the arc ends.
4. Open the format dialog and close it without a choice. Confirm the button does not enter cooldown.
5. Apply a filter that matches more than 100 rows if you have one, or several pages of the sample, and export CSV. Confirm the file has every matching row.
6. Scroll the report and confirm the button stays in the corner. On a phone-width viewport, tap the circle and confirm the format dialog opens.

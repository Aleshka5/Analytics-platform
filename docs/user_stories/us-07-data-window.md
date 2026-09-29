# US-07 — Apply and data window

**Depends on:** [US-06](us-06-query-backend.md).

## Story

As a team member, I want **Apply** to open a table of the rows I asked for, so that I can scroll and zoom that view and keep reading as more rows load.

## In scope

- **Apply** sends the sidebar draft to `POST .../rows` with `page: 1`. Success closes the sidebar, remembers the body, and opens the data window. The next open of the sidebar shows that body.
- A **422** leaves the sidebar open, shows `error.message` at the top, and does not open the window.
- Data window from the [design doc](../design.md#data-window): inset dialog, red close icon, table, empty state. There are no page buttons.
- `rowspan` paints `spans` as merged cells. `aggregate` shows aggregate headers and no merged cells.
- When the bottom of the table comes into view, the next page loads with the same body and those rows are appended. Page size stays 100. A group value that continues onto the next page stays one merged cell.
- The table moves by mouse-wheel and trackpad scrolling, and by the horizontal and vertical scrollbars. Dragging does not move it. Zoom runs from 50% to 200% in steps of 10%. A fine pointer gets **+** and **−**. A coarse pointer pinches, those buttons are hidden, and the inline two-circle hint loops at the bottom-left without taking touches.
- Close keeps the applied body and does not change the report cards.
- Russian and English strings for this window only.

## Out of scope

- New query parameters or a change to report math.
- Table export, the report export button, and file downloads.
- Rebuilding the sidebar form. This story only attaches the Apply action and the error line.

## Definition of done

- Apply on the sample file opens a window whose first page has at most 100 rows and matches the form.
- Merged-cells mode shows a vertical merge for the group column inside the page. Aggregated mode shows one row per group and `row_count`.
- Reaching the bottom appends the next page and keeps the rows already shown. The close control does not scale when the table is zoomed.
- **+** and **−** stop at 50% and 200%. The wheel, the trackpad, and the scrollbars move the table horizontally and vertically.
- On a touch-sized viewport the zoom buttons are absent, pinch changes the scale, and the hint animation loops at the bottom-left.
- The red cross closes the window. Reopening the sidebar shows the same settings. The report cards still describe the full file.
- An invalid condition shows the server message in the sidebar and leaves the window closed.
- An empty filter result shows the empty state inside the window.

## Automated tests

- Apply success calls the rows route once and closes the sidebar.
- A 422 response renders the message and does not render the dialog.
- Span data draws a merged cell for the given start and length.
- Zoom steps clamp at 50% and 200%.
- The pinch hint is present only when the pointer is coarse, and it does not receive pointer events.

## Manual check

1. On the sample report, filter to one region, sort by `PnL`, choose merged cells, and press **Apply**. Confirm the window, the merges, and that the report cards did not change.
2. Scroll to the bottom and confirm the next rows appear under the ones already shown, and a group that continues is still one merged cell.
3. Switch the same settings to aggregated rows and Apply again. Confirm one row per group.
4. Zoom in and out with **+** and **−**, scroll the table both ways with the wheel or the scrollbars, and confirm the close control stays the same size.
5. Repeat on a phone-width viewport or a touch device: pinch zooms, the hint plays, and **+** / **−** are absent.
6. Close with the red cross, reopen settings, and confirm the form still holds the last apply.
7. Enter a broken value if the form allows it, or force a 422, and confirm the message stays in the sidebar.
8. Apply a filter that matches nothing and confirm the empty sentence in both languages.

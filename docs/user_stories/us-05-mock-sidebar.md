# US-05 — Mock sidebar

**Depends on:** [US-04](us-04-main-page-integration.md).

## Story

As a team member, I want a settings panel where I can prepare filters, sorting, and grouping, so that I can set up a data view without leaving the report.

## In scope

- Collapsed semicircle on the right edge, vertically centered, with the three-slider icon and the accessible name from the [chrome strings](../design.md#strings).
- Panel over the page, full height, width `min(420px, 100vw)`, dimmed scrim. Escape and a scrim click close it and drop the unapplied draft.
- Form contents from the [sidebar](../design.md#sidebar): AND/OR toggle, condition rows, up to three sorts, group columns, merged-cells versus aggregated-rows, and an **Apply** button at the end.
- Operators offered for a column match the [operator table](../api-contract.md#query-rows). Columns come from the ready dataset already on the page.
- Russian and English strings for this panel only.
- The draft is local. Reopening after a discard shows the last kept draft, which is empty before any kept apply. This story does not keep an applied body yet: closing always discards.

## Out of scope

- Apply calling the API, opening a data window, or showing a query error.
- `POST .../rows` and exports.
- Changes to report cards.

## Definition of done

- The tab is visible on the report page and does not cover the upload bar.
- The panel opens over the cards, scrolls when the form is long, and closes from the scrim and from Escape without changing the report.
- The user can add and remove conditions, switch AND/OR, add at most three sorts, pick group columns, and switch group mode.
- A numeric column does not offer `contains`. A text column does not offer `gt`.
- **Apply** is visible and does nothing to the report or the network.
- Both languages translate the new strings. Report cards stay as US-04 left them.

## Automated tests

- Opening and pressing Escape returns focus to the tab and keeps the report dataset id unchanged.
- The fourth sort control is unavailable.
- Operator options follow the column role.
- Clicking **Apply** does not call `fetch`.

## Manual check

1. With the sample report on screen, open the tab. Confirm the semicircle, the overlay, and that the cards do not scroll away as their own page.
2. Add several conditions, three sorts, and a group. Close with Escape. Reopen and confirm the form is empty again.
3. Confirm a number column and a text column offer different operators.
4. Press **Apply** and confirm no table appears and the report numbers stay the same.
5. Switch language while the panel is open and confirm only the panel copy changes language together with the rest of the chrome.
6. On a narrow viewport, confirm the panel uses the full width and the form still scrolls to **Apply**.

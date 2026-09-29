# US-02 — Mock main page

**Depends on:** [US-01](us-01-platform-shell.md).

## Story

As a team member, I want the main page in Russian and English with an upload area and the ten report cards, so that I can see the report layout before any API exists.

## In scope

- Header with the `RU` / `EN` switch. First visit follows the browser language. The choice is stored in the browser. Strings for this page live in `en.json` and `ru.json`.
- Upload zone from the [design doc](../design.md#upload-zone): full-height drop area, centered **Upload file** button, collapse into a bar, **Replace file**.
- Client-side rejection of a file over 100 MB and of an extension outside the [allowed list](../adrs.md#adr-003). The zone stays expanded.
- Drop and the file button share one local handler. A small accepted file loads a built-in fixture and collapses the zone. A second file replaces that fixture and resets the card selectors.
- Sheet dialog component with a sheet list, confirm, and cancel. It is covered by a component test. The page does not open it yet.
- Ten report cards in [call order](../api-contract.md#conventions), filled from the fixture: preview, columns, size, types, missing values, summary, top and worst, grouping, a line chart, and insights.
- Selectors on the ranking, grouping, and dynamics cards switch fixture slices locally.
- One fixture state paints a card red with an unavailable sentence, so the error look exists before the API does.
- Numbers and dates follow the active locale.

## Out of scope

- HTTP calls, a real parser, and deleting a dataset.
- Sidebar, data window, and both export buttons.
- Strings for those later surfaces.

## Definition of done

- The idle page matches the [page layout](../design.md#page-layout): header, full-width upload zone, button centered in the viewport.
- After a small accepted fixture file, the zone collapses and all ten cards are visible in order.
- Replace clears the previous selector choices and shows the fixture again.
- A 100 MB-plus file or a disallowed extension shows the localized error and does not collapse the zone.
- The language switch translates the header, upload zone, card titles, and the red-card sentence without a reload.
- The sheet dialog renders a supplied list and returns the chosen name or cancel in a component test.
- Card selectors change only the card they belong to, using local fixture data.

## Automated tests

- The language switch flips a header string and an upload string between Russian and English.
- A file larger than 100 MB, and a file with a disallowed extension, surface the error and leave the zone expanded.
- An accepted small file collapses the zone and shows the ten card titles.
- Changing the metric selector updates the ranking card and leaves the other cards as they were.
- The unavailable fixture renders the red message.
- The sheet dialog confirms a chosen name and cancel returns no name.

## Manual check

1. Open the page in a browser whose language is Russian, then in one whose language is English. Confirm the first visit matches, and that the Header choice survives a reload.
2. Drop a small `.csv` and use the button to pick another small accepted file. Confirm the zone collapses, then replaces, and the button reads **Replace file**.
3. Try a file over 100 MB and a `.png`. Confirm the zone stays open and the message is in the active language.
4. Change the metric on **Top and worst** and confirm the other cards do not jump.
5. Switch language after the cards are visible and confirm titles and the red sentence follow.
6. Resize to a narrow width and confirm the upload button stays reachable and the cards stack in one column.

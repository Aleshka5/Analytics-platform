# US-10 — Visual polish and motion

**Depends on:** [US-09](us-09-export-ui.md).

## Story

As a team member, I want the page to look like a finished Freedom Broker product, with calm motion that follows what the data is doing, so that the report is quick to scan and pleasant to use.

## In scope

- The [visual style](../design.md#visual-style): brand palette, type, surfaces, and motion tokens in one place.
- Header brand mark and the language switch as one segmented control with a sliding thumb.
- Upload hero: headline, supported-format hint, drag-over highlight, and a spinner while uploading.
- Report layout: a two-column grid on wide screens, numbered card titles, and the card treatments listed in [card contents](../design.md#report-sequence).
- The dynamics chart with axes, an area wash, an end marker, and a hover or focus readout.
- Motion for cards, skeletons, the sidebar, dialogs, the data window, and the export button. Every animation is off under `prefers-reduced-motion: reduce`.
- New Russian and English strings for the hero and the chart grain.

## Out of scope

- A dark theme.
- New API fields or changed report math.
- A charting or animation library. Charts stay inline SVG, and motion stays CSS.

## Definition of done

- Existing behavior and tests from US-01 to US-09 still hold.
- Every text color passes WCAG AA against its background. The primary button uses dark ink on the bright brand green.
- Keyboard focus is visible on every control.
- The page has no horizontal scroll at 360 px wide.

## Automated tests

- The upload zone marks itself as dragging while a file is over it and clears the mark on leave and drop.
- The dynamics chart shows the readout for the last bucket on keyboard focus, and the arrow keys move it.

## Manual check

1. Open the empty page on a desktop and at 360 px. Confirm the hero is centered and the drop area highlights while a file is dragged over it.
2. Upload the sample file. Confirm the cards rise in one by one and the skeletons shimmer.
3. Hover the dynamics chart and confirm the crosshair and readout follow the pointer.
4. Open the sidebar, the format dialog, and the data window. Confirm each one animates in.
5. Turn on reduced motion in the OS and reload. Confirm nothing animates.

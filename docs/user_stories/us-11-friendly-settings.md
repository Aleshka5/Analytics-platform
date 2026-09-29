# US-11 — Settings anyone can read

**Depends on:** [US-10](us-10-visual-polish.md).

## Story

As a team member who has never written a query, I want the settings panel to explain itself with words and pictures, so that I can build a filter, a sort, and a grouping without guessing what AND, OR, or the group modes do.

## In scope

- The [settings sidebar](../design.md#sidebar) as three steps: filter, sort, group. Each step has an icon, a title, and one plain sentence.
- Condition cards that read as a sentence, with operator words instead of API codes and helpful placeholders.
- AND and OR as picture cards with Venn circles, shown from two conditions, and a colored connector between cards.
- Sort direction as a green up arrow and a red down arrow, with **then** between sort levels.
- Group mode as picture cards with mini tables, shown after a group column is chosen.
- A panel header with a close cross and a footer that keeps **Apply** in reach.
- Russian and English strings for all of the above.

## Out of scope

- Nested groups of conditions, such as (A AND B) OR C. The API has one combinator ([ADR 008](../adrs.md#adr-008)).
- Changes to the request body or the API.

## Definition of done

- The request body for the same choices is identical to US-07.
- Every icon-only control has an accessible name.
- The panel has no horizontal scroll at 360 px wide.

## Automated tests

- Operator options show words, and their values stay the API codes.
- The AND and OR cards appear only with two or more conditions. Choosing OR changes the connector between cards to OR.
- The red down arrow sets the sort to descending and marks itself pressed.
- The group mode cards appear only after a group column is checked.
- The header cross closes the panel.

## Manual check

1. Open the panel with no settings. Confirm the notes say that every row is shown and the file order is kept.
2. Add two conditions and switch between the Venn cards. Confirm the connector between the cards changes between AND and OR.
3. Add two sorts, set the second to the red arrow, and apply. Confirm the table order.
4. Check a group column, pick each mode, and apply. Confirm the table matches the mini picture on the card.
5. Repeat in Russian at 360 px wide.

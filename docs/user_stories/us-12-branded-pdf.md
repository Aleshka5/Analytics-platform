# US-12 — Branded PDF report

**Depends on:** [US-10](us-10-visual-polish.md).

## Story

As a team member, I want the PDF report to look like the page I exported it from, so that I can send it to a colleague or a client without reworking it.

## In scope

- The [PDF report](../design.md#pdf-report) layout: title band, numbered headings, styled tables, stat tiles, the dynamics chart, insight notes, red callouts, and the page footer.
- Numbers rounded to two decimals and grouped for the report language.
- A bundled bold weight of DejaVu Sans.

## Out of scope

- The Excel report. Its cells keep the raw values.
- Translated table headers. API keys become English labels in both languages, as before.
- New libraries. The PDF stays on reportlab ([ADR 001](../adrs.md#adr-001)).

## Definition of done

- Every value in the PDF is the same value as in the Excel report, only formatted.
- Russian text, including the title and insight sentences, extracts from the PDF as text.
- No table column wraps a short label on the sample file.

## Automated tests

- The first page holds the title, the subtitle, the first section number, and a stat tile value.
- Russian numbers are rounded and grouped.
- A long two-column dynamics table keeps every bucket and does not fail with empty sums.

## Manual check

1. Export the sample report as PDF in English and in Russian.
2. Confirm the title band, the numbered sections, the chart above the dynamics table, and the page numbers.
3. Compare a few numbers with the Excel export.

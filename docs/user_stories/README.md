# User Stories

Implement these stories in order. A story starts only after the previous one meets its definition of done. Later stories use that finished behavior and do not rebuild it.

Each story owns one slice. Language catalogs are the exception that stays consistent: [US-02](us-02-mock-main-page.md) adds the language switch and the strings for the main page. Later UI stories add only the strings for the controls they introduce. They do not retranslate earlier screens.

Detail lives in the [API contract](../api-contract.md), the [design doc](../design.md), the [ADRs](../adrs.md), and the [use cases](../use-cases.md). These stories say what is in scope and how to prove it.

Automated tests are pytest for the API and Vitest with React Testing Library for the UI. Browser passes below are done by a person. There is no end-to-end browser suite in these stories.

| Order | Story | Owns |
| --- | --- | --- |
| 1 | [US-01 Platform shell](us-01-platform-shell.md) | Podman, Makefile, `.env`, empty API and empty page |
| 2 | [US-02 Mock main page](us-02-mock-main-page.md) | Header, languages, upload zone, report cards from local fixtures |
| 3 | [US-03 Report backend](us-03-report-backend.md) | Upload, sheet choice, ten report routes |
| 4 | [US-04 Main page on the API](us-04-main-page-integration.md) | Replace fixtures with the report API |
| 5 | [US-05 Mock sidebar](us-05-mock-sidebar.md) | Settings tab and form, no request on Apply |
| 6 | [US-06 Query backend](us-06-query-backend.md) | Filtered, sorted, grouped pages |
| 7 | [US-07 Apply and data window](us-07-data-window.md) | Apply, table, scrolling, and zoom |
| 8 | [US-08 Export backend](us-08-export-backend.md) | Report file and table file |
| 9 | [US-09 Export controls](us-09-export-ui.md) | Both export buttons, format choice, cooldown |

## Use-case coverage

| Use case | Stories |
| --- | --- |
| [UC-1](../use-cases.md#uc-1) Upload | US-02, US-03, US-04 |
| [UC-2](../use-cases.md#uc-2) Worksheet | US-02, US-03, US-04 |
| [UC-3](../use-cases.md#uc-3) Base report | US-02, US-03, US-04 |
| [UC-4](../use-cases.md#uc-4) Block cannot be calculated | US-02, US-03, US-04 |
| [UC-5](../use-cases.md#uc-5) Language | US-02 starts it; US-04 refetches; US-05, US-07, and US-09 add their strings |
| [UC-6](../use-cases.md#uc-6) Settings | US-05, US-06, US-07 |
| [UC-7](../use-cases.md#uc-7) Data window | US-06, US-07 |
| [UC-8](../use-cases.md#uc-8) Export table | US-08, US-09 |
| [UC-9](../use-cases.md#uc-9) Export report | US-08, US-09 |
| [UC-10](../use-cases.md#uc-10) Replace file | US-02, US-03, US-04 |

# Design Doc

Single-page React application. The report sits on the page. Four surfaces open over it: the sheet dialog, the settings sidebar, the data window, and the export-format dialog.

Copy lives in `frontend/src/locales/en.json` and `ru.json`. Server-built sentences (insights and `unavailable` messages) come from the API `message` or `text` field and are shown as received.

<a id="language"></a>

## Language

The first visit follows the browser language: a tag that starts with `ru` selects Russian, every other tag selects English. The Header switch then sets `ru` or `en` and stores it in `localStorage`. Later visits use the stored value.

The switch is two buttons, `RU` and `EN`, in the Header. The active one is marked pressed.

Changing the language does three things:

- Translates every chrome string immediately: header, upload, sidebar, table controls, dialogs, export button.
- Restarts the [report sequence](#report-sequence) so insight sentences and unavailable messages are fetched again with `lang`.
- Translates the open data window's chrome. Cell values stay as returned; numbers and dates are reformatted with `Intl` for the active locale.

<a id="page-layout"></a>

## Page layout

Top to bottom:

1. Header: product name **Analytics Platform** / **Аналитическая платформа**, and the language switch. The header stays visible while the page scrolls.
2. Upload zone, full width of the page.
3. Report cards, in the [call order](api-contract.md#conventions), stacked with a gap between them.
4. Nothing else in the document flow. The settings tab, the data window, and the report export button are attached to the viewport.

The page background is neutral. Cards are white with a light border. Unavailable cards use a red border and red message text (`#b42318` on a `#fef3f2` fill).

<a id="upload-zone"></a>

## Upload zone

Before a file is accepted, the zone fills the viewport under the header. A dashed area covers that space. Centered in the viewport is a button labeled **Upload file** / **Загрузить файл**.

The same action accepts a file in two ways:

- Drop anywhere on the dashed area.
- Activate the button and use the native file picker. The picker `accept` list is `.csv,.tsv,.xlsx,.xls,.json,.parquet`.

The browser refuses a file larger than 100 MB before the request, with the localized `file_too_large` sentence under the button. The server repeats that check. An extension outside the allowed list shows the localized `unsupported_format` sentence under the button, and the zone stays as it was.

While the upload request is in flight, the button is disabled and shows a progress label.

### After a ready dataset

The zone collapses upward into a single bar. The button label becomes **Replace file** / **Заменить файл**. The collapsed bar still accepts a drop.

Replace uploads the new file first. Only a `ready` response, or a finished sheet selection that becomes `ready`, swaps the page: the previous dataset is deleted, report cards clear, the sidebar draft resets, and an open data window closes. A failed upload leaves the current dataset on screen and shows the error under the button.

### Several worksheets

When the upload returns `sheet_required`, a dialog lists `sheets`. The zone stays expanded and the report does not start. The actions are **Confirm** / **Подтвердить** and **Cancel** / **Отмена**. Confirming a sheet calls `PUT .../sheet`. Cancel deletes the new dataset. If this upload was a replace, cancel keeps the previous dataset.

<a id="report-sequence"></a>

## Report sequence

Cards appear one by one. A card shows a skeleton until its response arrives. The next request starts only after that response. The sequence is:

| Order | Card title (en / ru) | Endpoint | Selector on the card |
| --- | --- | --- | --- |
| 1 | Preview / Просмотр | `preview` | none |
| 2 | Columns / Колонки | `columns` | none |
| 3 | Size / Размер | `shape` | none |
| 4 | Data types / Типы данных | `dtypes` | none |
| 5 | Missing values / Пропуски | `missing` | none |
| 6 | Summary / Сводка | `summary` | none |
| 7 | Top and worst / Лучшие и худшие | `ranking` | metric |
| 8 | Grouping / Группировка | `grouping` | category and metric |
| 9 | Dynamics / Динамика | `timeseries` | date and metric |
| 10 | Insights / Инсайты | `insights` | date, shown when the columns payload contains at least one datetime column |

Selectors are filled from `suggestions` on the columns response. The user may switch to any column of the required role. A category selector also lists `text` columns, so `Client_ID` can be chosen on the sample file. Changing a selector refetches that card only.

On the sample file the selectors start at `Quantity`, `Region`, and `Transaction_Date`.

### Card contents

- **Preview.** A table of up to 20 rows. Column names are the field names.
- **Columns.** Name, role, distinct count.
- **Size.** Row count and column count.
- **Data types.** Name, pandas dtype, role.
- **Missing values.** Name, missing count, missing percent, filled count.
- **Summary.** One block for numeric stats, one block for the other columns (count, unique, top, frequency).
- **Top and worst.** Two lists of five rows, labeled so that a higher metric is the top side.
- **Grouping.** A compact table: category value, count, sum, mean. When `truncated` is true, a line under the table says the list stops at 100 groups.
- **Dynamics.** A line chart of `sum` by `bucket`. Grain is the `grain` field (`day` or `month`). The sample file is a daily line.
- **Insights.** Up to five sentences from `items[].text`.

Numbers in cards use the locale and at most two fraction digits. Dates use the locale's short date. Empty cells render as an em dash.

### Unavailable card

`status: "unavailable"` renders the card with the red treatment and `error.message` as the only body. The sequence continues. A **422** or a network failure on one call uses the same red card with that error message and also continues, so one broken block does not stop the rest.

The report describes the full file. Applying sidebar settings does not refetch these cards.

<a id="report-export"></a>

## Report export button

The button is `position: fixed` at the bottom-right of the viewport (16 px inset, above the safe area). It is absent until all ten cards have settled, including unavailable and failed cards.

Then it plays four states:

1. For 10 seconds it is a pill: a small page icon plus **Export** / **Экспорт**.
2. It collapses to a circle that keeps only the page icon.
3. A fine pointer hover expands it back into the pill. Touch devices stay on the circle; a tap opens the format dialog.
4. After the user confirms a format and the download request is sent, the button is disabled for 10 seconds. A circular arc shrinks around it, the same way a skill cooldown drains, and the icon sits under the arc. When the arc finishes, the button returns to the circle.

The format dialog offers **Excel** and **PDF**. The chosen format calls `GET .../report` with the active `lang`. The browser saves the attachment.

Closing the dialog without a choice does not start the cooldown.

<a id="sidebar"></a>

## Settings sidebar

Collapsed, it is a semicircle on the right edge, vertically centered. Inside it is an icon of three horizontal lines with a knob on each line, each knob at a different position. The control's accessible name is **Data settings** / **Настройки данных**.

Activating it opens a panel over the page, from the right edge, full height, width `min(420px, 100vw)`, with a dimmed scrim over the rest. The scrim click and the Escape key close the panel and discard the unapplied draft.

The panel is one scrollable form:

1. Combinator toggle: **Match all** / **Все условия** (`and`) and **Match any** / **Любое условие** (`or`).
2. Filter rows. Each row is a column, an operator, and a value. **Add condition** / **Добавить условие** appends a row. Each row can be removed. Operators offered for a column are only the ones legal for its role in the [operator table](api-contract.md#query-rows).
3. Sort rows, up to three. Each row is a column and ascending or descending. **Add sort** / **Добавить сортировку** stops at three.
4. Group columns, one or more, chosen from non-metric columns.
5. Group mode toggle: **Merged cells** / **Объединённые ячейки** (`rowspan`) and **Aggregated rows** / **Агрегированные строки** (`aggregate`).
6. **Apply** / **Применить** at the end of the list.

Apply sends `POST .../rows` with `page: 1`. Success closes the sidebar and opens the data window. **422** keeps the sidebar open and shows `error.message` at the top of the form. The data window stays as it was.

The applied body is remembered. The next time the sidebar opens, the form shows that body. Before the first successful apply, the form is empty and the combinator is `and`.

<a id="data-window"></a>

## Data window

A dialog, inset about 24 px from the viewport on wide screens and inset 8 px on narrow screens. A red cross at the top-right closes it. Closing discards nothing in the sidebar; the applied settings remain for the next open.

### Table

The header row stays visible inside the zoom surface. Body rows are the current page.

`rowspan` mode paints `spans` as merged cells. A value that continues from the previous page is drawn again on the new page, because spans never cross a page.

`aggregate` mode shows the aggregate headers and one row per group. There are no merged cells.

Empty `rows` with `total_rows: 0` shows an empty state inside the surface: **No rows match these settings** / **Нет строк по этим настройкам**.

### Pagination

A bar pinned to the bottom of the dialog, outside the zoomed surface, shows the page, the total pages, and previous / next. Page size is 100 and is written on the bar as **100 rows** / **100 строк**. Changing page requests that page with the same filter, sort, and group. The previous and next controls are disabled on the first and last page.

### Pan and zoom

The table surface pans on both axes by dragging.

Zoom range is 50% to 200%.

- Fine pointer (desktop): **+** and **−** buttons sit at the bottom-right of the dialog, just above the table-export button. Each step is 10%.
- Coarse pointer (touch): those buttons are hidden. A pinch gesture on the surface zooms it.

The pagination bar, the close control, and the export button keep a constant size.

### Pinch hint

On a coarse pointer, the bottom-left of the dialog shows a looping hint while the window is open. It is an inline SVG drawn for this screen: two filled circles move apart and back together, about a 1.6 second cycle. It does not capture touches (`pointer-events: none`) and it is hidden from assistive tech. No external animation file is loaded.

### Table export

A button at the bottom-right of the dialog, **Export** / **Экспорт**, opens a format dialog: **Excel**, **CSV**, **JSON**. Confirming it posts the applied body to `POST .../rows/export` and downloads every matching row, not only the visible page.

<a id="strings"></a>

## Chrome strings

| Key | English | Russian |
| --- | --- | --- |
| `header.title` | Analytics Platform | Аналитическая платформа |
| `upload.action` | Upload file | Загрузить файл |
| `upload.replace` | Replace file | Заменить файл |
| `upload.tooLarge` | The file is larger than 100 MB. | Файл больше 100 МБ. |
| `upload.unsupported` | This file type is not supported. | Этот тип файла не поддерживается. |
| `settings.open` | Data settings | Настройки данных |
| `settings.apply` | Apply | Применить |
| `settings.matchAll` | Match all | Все условия |
| `settings.matchAny` | Match any | Любое условие |
| `settings.addCondition` | Add condition | Добавить условие |
| `settings.addSort` | Add sort | Добавить сортировку |
| `settings.merged` | Merged cells | Объединённые ячейки |
| `settings.aggregated` | Aggregated rows | Агрегированные строки |
| `table.close` | Close | Закрыть |
| `table.empty` | No rows match these settings | Нет строк по этим настройкам |
| `table.pageSize` | 100 rows | 100 строк |
| `export.action` | Export | Экспорт |
| `export.excel` | Excel | Excel |
| `export.csv` | CSV | CSV |
| `export.json` | JSON | JSON |
| `export.pdf` | PDF | PDF |
| `sheet.title` | Choose a sheet | Выберите лист |
| `sheet.confirm` | Confirm | Подтвердить |
| `sheet.cancel` | Cancel | Отмена |

Section titles are in the [report sequence](#report-sequence) table. Insight sentences and unavailable messages are the API strings in [the message catalog](api-contract.md#message-catalog).

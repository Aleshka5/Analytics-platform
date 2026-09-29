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

Colors, type, and motion follow the [visual style](#visual-style). Unavailable cards use a red border and red message text (`#b42318` on a `#fef3f2` fill).

On screens at least 960 px wide the cards sit in a two-column grid. Preview, Summary, Dynamics, and Insights span both columns. The other cards pair up in call order. Narrower screens use one column.

<a id="upload-zone"></a>

## Upload zone

Before a file is accepted, the zone fills the viewport under the header. A dashed area covers that space. Centered in the viewport are an upload icon, the headline **Drop a file to build the report** / **Перетащите файл, чтобы построить отчёт**, the format hint, and a button labeled **Upload file** / **Загрузить файл**.

While a file is dragged over the zone, the dashed border turns brand green and the area gets a green wash. The mark clears when the file leaves or drops.

The same action accepts a file in two ways:

- Drop anywhere on the dashed area.
- Activate the button and use the native file picker. The picker `accept` list is `.csv,.tsv,.xlsx,.xls,.json,.parquet`.

The browser refuses a file larger than 100 MB before the request, with the localized `file_too_large` sentence under the button. The server repeats that check. An extension outside the allowed list shows the localized `unsupported_format` sentence under the button, and the zone stays as it was.

While the upload request is in flight, the button is disabled and shows a spinner.

### After a ready dataset

The zone collapses upward into a single bar. The button label becomes **Replace file** / **Заменить файл**, with the hint **or drop a new file here** / **или перетащите новый файл сюда** beside it. The collapsed bar still accepts a drop.

Replace uploads the new file first. Only a `ready` response, or a finished sheet selection that becomes `ready`, swaps the page: the previous dataset is deleted, report cards clear, the sidebar draft resets, and an open data window closes. A failed upload leaves the current dataset on screen and shows the error under the button.

### Several worksheets

When the upload returns `sheet_required`, a dialog centered over a dimmed page lists `sheets`. The zone stays expanded and the report does not start. The actions are **Confirm** / **Подтвердить** and **Cancel** / **Отмена**. Confirming a sheet calls `PUT .../sheet`. Cancel deletes the new dataset. If this upload was a replace, cancel keeps the previous dataset.

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
- **Columns.** Name, role, distinct count. Roles here and in Data types are small badges.
- **Size.** Two stat tiles: row count and column count.
- **Data types.** Name, pandas dtype, role.
- **Missing values.** Name, missing count, missing percent with a short meter, filled count.
- **Summary.** One block for numeric stats, one block for the other columns (count, unique, top, frequency). Each column is a tile with its stats in a label and value grid.
- **Top and worst.** Two lists of five rows, labeled so that a higher metric is the top side. Each row shows the rank, the metric value, the values of the first two text or category columns, and a bar scaled to the largest value in both lists.
- **Grouping.** A compact table: category value, count, sum, mean. The sum cell carries a bar scaled to the largest sum. When `truncated` is true, a line under the table says the list stops at 100 groups.
- **Dynamics.** A line chart of `sum` by `bucket`. Grain is the `grain` field (`day` or `month`), shown as a chip: **Day** / **День** or **Month** / **Месяц**. The sample file is a daily line. The chart has rounded y-axis ticks, the first, middle, and last date under the x-axis (first and last only below 480 px of chart width), a 10% area wash, and a marker with the value on the last point. Pointer hover shows a crosshair and a readout (date and sum) for the nearest bucket. The chart takes keyboard focus: it then shows the last bucket, and the left and right arrow keys move the readout.
- **Insights.** Up to five sentences from `items[].text`, each with a small icon, fading in one after another.

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

Activating it opens a panel over the page, from the right edge, full height, width `min(420px, 100vw)`, with a dimmed scrim over the rest. The panel header shows **Data settings** / **Настройки данных** and a close cross. The cross, a scrim click, and the Escape key close the panel and discard the unapplied draft.

The panel is one scrollable form in three steps. Each step has an icon, a title, and one plain sentence, so a first-time user can follow it without help.

1. **Filter rows** / **Отбор строк**, "Keep only the rows you need."
   - With no conditions, a dashed note says every row is shown.
   - Each condition is a card that reads like a sentence: column, then the operator in words, then the value. Operator words replace the API codes (for example `in` is **is one of** / **одно из**, `gt` is **is greater than** / **больше**). The value placeholder helps: **e.g. UAE, UK** for `is one of`, **from** and **to** for `is between`, **YYYY-MM-DD** for a date column. Operators offered for a column are only the ones legal for its role in the [operator table](api-contract.md#query-rows).
   - Between two cards a connector pill shows how they combine: **AND** / **И** in green or **OR** / **ИЛИ** in violet.
   - With two or more conditions, two picture cards above the list choose the combinator. **Match all** / **Все условия** (`and`) shows two circles with only the overlap filled: "A row must pass every condition." **Match any** / **Любое условие** (`or`) shows both circles filled: "A row must pass at least one condition." With fewer than two conditions the choice is hidden, and the stored combinator is kept.
   - **Add condition** / **Добавить условие** appends a card. A trash button on each card removes it.
2. **Sort rows** / **Сортировка**, "Choose which rows come first." Up to three numbered cards, joined by **then** / **затем**. Each card is a column and a direction toggle: a green up arrow for ascending and a red down arrow for descending. The arrows carry the accessible names **Ascending** / **Descending**. **Add sort** / **Добавить сортировку** stops at three.
3. **Group rows** / **Группировка**, "Put rows with the same value together." Non-metric columns are toggle chips. After at least one chip is on, two picture cards choose the mode. **Merged cells** / **Объединённые ячейки** (`rowspan`) shows a mini table whose key cells span two rows: "Every row stays. Equal values share one cell." **Aggregated rows** / **Агрегированные строки** (`aggregate`) shows a shorter mini table with a Σ column: "One row per group, with totals."

**Apply** / **Применить** sits in a footer that stays at the bottom of the panel while the form scrolls.

Apply sends `POST .../rows` with `page: 1`. Success closes the sidebar and opens the data window. **422** keeps the sidebar open and shows `error.message` at the top of the form. The data window stays as it was.

The applied body is remembered. The next time the sidebar opens, the form shows that body. Before the first successful apply, the form is empty and the combinator is `and`.

<a id="data-window"></a>

## Data window

A dialog, inset about 24 px from the viewport on wide screens and inset 8 px on narrow screens. A red cross at the top-right closes it. Closing discards nothing in the sidebar; the applied settings remain for the next open.

### Table

The header row stays visible inside the zoom surface. The window opens on the first page. When the bottom of the loaded rows comes into view, the same query loads the next page and those rows are appended.

`rowspan` mode paints `spans` as merged cells. A group run that continues from the previous page stays one merged cell in the combined table.

`aggregate` mode shows the aggregate headers and one row per group. There are no merged cells.

Empty `rows` with `total_rows: 0` shows an empty state inside the surface: **No rows match these settings** / **Нет строк по этим настройкам**.

### Loading more rows

There is no pagination bar. Page size is still 100. Bringing the bottom of the table into the zoom surface requests the next page with the same filter, sort, and group and appends it. The request stops on the last page. The close control stays outside the zoomed surface.

### Scroll and zoom

The table sits in a scroller with a vertical bar and a horizontal bar. A mouse wheel and a two-finger trackpad scroll move it. Dragging does not move the table.

Zoom range is 50% to 200%.

- Fine pointer (desktop): **+** and **−** buttons sit at the bottom-right of the dialog, just above the table-export button. Each step is 10%.
- Coarse pointer (touch): those buttons are hidden. A pinch gesture on the surface zooms it.

The close control and the export button keep a constant size.

### Pinch hint

On a coarse pointer, the bottom-left of the dialog shows a looping hint while the window is open. It is an inline SVG drawn for this screen: two filled circles move apart and back together, about a 1.6 second cycle. It does not capture touches (`pointer-events: none`) and it is hidden from assistive tech. No external animation file is loaded.

### Table export

A button at the bottom-right of the dialog, **Export** / **Экспорт**, opens a format dialog: **Excel**, **CSV**, **JSON**. Confirming it posts the applied body to `POST .../rows/export` and downloads every matching row, not only the visible page.

<a id="visual-style"></a>

## Visual style

The palette comes from Freedom Broker. All colors are CSS custom properties on `:root` in `App.css`; components use the tokens, not raw values.

| Token | Value | Use |
| --- | --- | --- |
| `--brand` | `#009753` | Chart line, meters, icons, focus ring |
| `--brand-bright` | `#1AE276` | Primary button fill with `--ink` text, glows |
| `--brand-ink` | `#007A43` | Brand-colored text on white |
| `--accent` | `#7D8DEE` | Second accent: category badges, hero glow |
| `--ink` | `#0E1512` | Body text |
| `--ink-muted` | `#5B6660` | Labels and secondary text |
| `--canvas` | `#F4F7F5` | Page background |
| `--surface` | `#FFFFFF` | Cards, panels, dialogs |
| `--line` | `#E2E8E4` | Card borders, table rules, gridlines |

The type face is Inter, bundled with the page through `@fontsource-variable/inter` so it loads without a font CDN. The system sans is the fallback. Table numbers use tabular figures and align right. Stat-tile values use proportional figures.

The primary action (upload, apply, confirm, report and table export) is the bright green button with dark ink. Format choices in the export dialog are large tiles that fill with the bright green on hover. Secondary actions are white with a hairline border. Every control shows a 2 px `--brand` focus ring on keyboard focus.

### Motion

Motion is CSS only. Durations are 150 ms for hover and press, 250 ms for panels and dialogs, and 450 ms for card entry. Entering elements ease out.

- A card rises 12 px and fades in when it appears. Its content fades in when the response replaces the skeleton.
- Skeletons shimmer from left to right.
- The sidebar slides in from the right edge, and its scrim fades in.
- Dialogs and the data window fade in and scale up from 96%.
- The dynamics line draws from left to right once per response.
- The export pill and circle change width smoothly.
- The language thumb slides between `RU` and `EN`.

Under `prefers-reduced-motion: reduce` every animation and transition is turned off. The export cooldown arc still changes, because it tells the user when the button works again, but it steps instead of draining smoothly.

<a id="strings"></a>

## Chrome strings

| Key | English | Russian |
| --- | --- | --- |
| `header.title` | Analytics Platform | Аналитическая платформа |
| `upload.action` | Upload file | Загрузить файл |
| `upload.replace` | Replace file | Заменить файл |
| `upload.tooLarge` | The file is larger than 100 MB. | Файл больше 100 МБ. |
| `upload.unsupported` | This file type is not supported. | Этот тип файла не поддерживается. |
| `upload.title` | Drop a file to build the report | Перетащите файл, чтобы построить отчёт |
| `upload.hint` | CSV, TSV, XLSX, XLS, JSON or Parquet · up to 100 MB | CSV, TSV, XLSX, XLS, JSON или Parquet · до 100 МБ |
| `upload.replaceHint` | or drop a new file here | или перетащите новый файл сюда |
| `card.day` | Day | День |
| `card.month` | Month | Месяц |
| `settings.open` | Data settings | Настройки данных |
| `settings.apply` | Apply | Применить |
| `settings.matchAll` | Match all | Все условия |
| `settings.matchAny` | Match any | Любое условие |
| `settings.addCondition` | Add condition | Добавить условие |
| `settings.addSort` | Add sort | Добавить сортировку |
| `settings.merged` | Merged cells | Объединённые ячейки |
| `settings.aggregated` | Aggregated rows | Агрегированные строки |
| `settings.filterTitle` | Filter rows | Отбор строк |
| `settings.sortTitle` | Sort rows | Сортировка |
| `settings.groupTitle` | Group rows | Группировка |
| `settings.and` / `settings.or` | AND / OR | И / ИЛИ |
| `settings.then` | then | затем |
| `operators.*` | is equal to, is greater than, is at least, is less than, is at most, is between, contains, is one of, is empty, is not empty | равно, больше, не меньше, меньше, не больше, между, содержит, одно из, пустое, не пустое |

The step hints, empty notes, card descriptions, and placeholders are in the `settings` block of both locale files.
| `table.close` | Close | Закрыть |
| `table.empty` | No rows match these settings | Нет строк по этим настройкам |
| `export.action` | Export | Экспорт |
| `export.excel` | Excel | Excel |
| `export.csv` | CSV | CSV |
| `export.json` | JSON | JSON |
| `export.pdf` | PDF | PDF |
| `sheet.title` | Choose a sheet | Выберите лист |
| `sheet.confirm` | Confirm | Подтвердить |
| `sheet.cancel` | Cancel | Отмена |

Section titles are in the [report sequence](#report-sequence) table. Insight sentences, unavailable messages, and error messages are the API strings in [the message catalog](api-contract.md#message-catalog).

# API Contract

Base URL: `/api/v1`.

The backend keeps one parsed table per dataset in process memory. The report endpoints always read the full table. Filters, sorting, and grouping apply only to the row-query and table-export endpoints.

The sample file `data/global_brokerage_dataset.xlsx` (sheet `Brokerage_Data`, 300 rows) is the worked example below. It is not a special case in the code.

## Conventions

<a id="conventions"></a>

### Language

Generated sentences and error `message` fields follow the `lang` query parameter: `ru` or `en`.

When `lang` is omitted, the server uses the first supported tag in `Accept-Language`. Otherwise it uses `en`.

An unsupported `lang` value returns **422** `invalid_language`.

Column names from the file are never translated.

### Dataset lifetime

`dataset_id` is a UUID. The entry lives for 60 minutes after a successful upload (`expires_at` is UTC ISO-8601). Replacing a file is a new upload plus a delete of the previous id. Restarting the process drops every dataset.

### Section envelope

Analysis endpoints return **200** with one of these bodies.

Success:

```json
{
  "status": "ok",
  "data": {}
}
```

The section cannot be calculated from this table:

```json
{
  "status": "unavailable",
  "error": {
    "code": "no_numeric_column",
    "message": "There is no numeric column to rank."
  }
}
```

`unavailable` is a normal result. The UI shows it on that card and continues with the next section.

### Error body

Request and storage failures use this body with the HTTP status in the tables below.

```json
{
  "error": {
    "code": "file_too_large",
    "message": "The file is larger than 100 MB."
  }
}
```

<a id="shared-errors"></a>

### Errors shared by every route under `/datasets/{dataset_id}`

| HTTP | `code` | When |
| --- | --- | --- |
| 404 | `dataset_not_found` | Unknown id, or the 60-minute lifetime has elapsed and the entry was removed |
| 409 | `sheet_required` | The workbook has several sheets and no sheet has been selected yet |
| 500 | `internal_error` | Unhandled failure. `message` is a generic localized sentence, with no stack trace |

<a id="column-roles"></a>

### Column roles

Roles are inferred once, when the table becomes `ready`.

| Role | Rule |
| --- | --- |
| `metric` | Numeric dtype. A numeric column is never reclassified as a date. |
| `datetime` | At least 80% of non-null values parse as dates. |
| `category` | Not numeric and not datetime, at least one non-null value, and either at most 30 distinct values or distinct / non-null ≤ 0.05 |
| `text` | Remaining string columns |

Booleans use the role `category`.

Suggestions, used when a query parameter is omitted:

| Field | Choice |
| --- | --- |
| `metric` | First `metric` column in file order, or `null` |
| `category` | First `category` column in file order, or `null` |
| `datetime` | First `datetime` column in file order, or `null` |

On the sample file this yields `Quantity`, `Region`, and `Transaction_Date`. `Client_ID` has 50 distinct values (50 / 300 > 0.05), so its role is `text` and it is not the default category. The card selectors may still target it.

Duplicate header cells are renamed in order: `Name`, `Name_2`, `Name_3`.

### Call order for the base report

After `status` is `ready`, the UI calls these routes one at a time, in this order. The next call starts only after the previous response arrives.

1. `GET .../preview`
2. `GET .../columns`
3. `GET .../shape`
4. `GET .../dtypes`
5. `GET .../missing`
6. `GET .../summary`
7. `GET .../ranking`
8. `GET .../grouping`
9. `GET .../timeseries`
10. `GET .../insights`

Changing a selector on a card repeats only that card's route. Changing the UI language repeats the whole list so every generated sentence matches the language.

<a id="upload-dataset"></a>

## `POST /api/v1/datasets`

Multipart form:

| Field | Required | Description |
| --- | --- | --- |
| `file` | yes | The uploaded file |
| `sheet` | no | Worksheet name. Used for Excel only |

Allowed extensions: `.csv`, `.tsv`, `.xlsx`, `.xls`, `.json`, `.parquet`.

JSON may be an array of objects or NDJSON. CSV and TSV: the delimiter is detected, the encoding is detected, and the first row is the header.

The size limit is the upload size, 100 × 1024 × 1024 bytes. The server checks `Content-Length` when it is present, then counts the bytes it actually reads.

### Ready

**201**

```json
{
  "dataset_id": "3f1c0c2e-7b2a-4d1e-9a55-0c2a9b6d4e11",
  "filename": "global_brokerage_dataset.xlsx",
  "status": "ready",
  "sheet": "Brokerage_Data",
  "sheets": ["Brokerage_Data"],
  "size_bytes": 48211,
  "expires_at": "2026-09-29T16:14:00Z"
}
```

A workbook with one sheet is selected automatically. `sheet` is `null` for non-Excel files, and `sheets` is an empty array.

### Several sheets, none selected

**201** with `status: "sheet_required"`. The file is stored, the table is not parsed, and analysis routes return **409** `sheet_required`.

```json
{
  "dataset_id": "3f1c0c2e-7b2a-4d1e-9a55-0c2a9b6d4e11",
  "filename": "book.xlsx",
  "status": "sheet_required",
  "sheet": null,
  "sheets": ["Trades", "Clients"],
  "size_bytes": 90000,
  "expires_at": "2026-09-29T16:14:00Z"
}
```

### Upload errors

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `missing_file` | The `file` part is absent |
| 413 | `file_too_large` | Declared or actual size is above 100 MB |
| 415 | `unsupported_format` | Extension is outside the allowed list |
| 422 | `empty_file` | Zero bytes |
| 422 | `unreadable_file` | Corrupt, encrypted, or the parser raised |
| 422 | `encoding_error` | The text encoding could not be detected |
| 422 | `not_a_table` | JSON is not a table of records, or the header row is empty |
| 422 | `no_data_rows` | Header only, no data rows |
| 422 | `sheet_not_found` | `sheet` was sent and is not in the workbook |

<a id="select-sheet"></a>

## `PUT /api/v1/datasets/{dataset_id}/sheet`

Selects the worksheet and parses the table.

```json
{ "sheet": "Trades" }
```

**200**

```json
{
  "dataset_id": "3f1c0c2e-7b2a-4d1e-9a55-0c2a9b6d4e11",
  "status": "ready",
  "sheet": "Trades"
}
```

| HTTP | `code` | When |
| --- | --- | --- |
| 422 | `sheet_not_found` | The name is not in `sheets` |
| 422 | `not_a_table` | The selected sheet has an empty header |
| 422 | `no_data_rows` | The selected sheet has a header and no data rows |
| 422 | `unreadable_file` | The sheet cannot be parsed |
| 409 | `already_ready` | A sheet is already selected. Upload another file to change the source |

Plus the [shared errors](#shared-errors).

<a id="delete-dataset"></a>

## `DELETE /api/v1/datasets/{dataset_id}`

**204** with an empty body. The id is forgotten.

**404** `dataset_not_found` when the id is unknown or already expired. A second delete is **404**.

<a id="preview"></a>

## `GET /api/v1/datasets/{dataset_id}/preview`

First 20 data rows, in file order. Dates are ISO-8601 strings. Numbers are JSON numbers. Empty cells are `null`.

**200**

```json
{
  "status": "ok",
  "data": {
    "row_limit": 20,
    "columns": ["Transaction_Date", "Client_ID", "Region", "Quantity"],
    "rows": [
      {
        "Transaction_Date": "2025-01-01",
        "Client_ID": "Client_010",
        "Region": "UAE",
        "Quantity": 7
      }
    ]
  }
}
```

This section stays `ok` for every ready dataset, because upload already rejected an empty table.

<a id="columns"></a>

## `GET /api/v1/datasets/{dataset_id}/columns`

**200**

```json
{
  "status": "ok",
  "data": {
    "columns": [
      {
        "name": "Transaction_Date",
        "dtype": "datetime64[ns]",
        "role": "datetime",
        "unique_count": 90
      },
      {
        "name": "Client_ID",
        "dtype": "str",
        "role": "text",
        "unique_count": 50
      },
      {
        "name": "Region",
        "dtype": "str",
        "role": "category",
        "unique_count": 7
      },
      {
        "name": "Quantity",
        "dtype": "int64",
        "role": "metric",
        "unique_count": 230
      }
    ],
    "suggestions": {
      "metric": "Quantity",
      "category": "Region",
      "datetime": "Transaction_Date"
    }
  }
}
```

`suggestions.*` is `null` when no column has that role. The UI still renders the card and uses that `null` to explain the later `unavailable` results.

<a id="shape"></a>

## `GET /api/v1/datasets/{dataset_id}/shape`

**200**

```json
{
  "status": "ok",
  "data": {
    "row_count": 300,
    "column_count": 12
  }
}
```

<a id="dtypes"></a>

## `GET /api/v1/datasets/{dataset_id}/dtypes`

**200**

```json
{
  "status": "ok",
  "data": {
    "columns": [
      { "name": "Quantity", "dtype": "int64", "role": "metric" }
    ]
  }
}
```

`dtype` is the pandas dtype string. String columns are `str`. `role` is the inferred role.

<a id="missing"></a>

## `GET /api/v1/datasets/{dataset_id}/missing`

**200**

```json
{
  "status": "ok",
  "data": {
    "columns": [
      {
        "name": "PnL",
        "missing_count": 0,
        "missing_pct": 0,
        "non_null_count": 300
      }
    ]
  }
}
```

`missing_pct` is `missing_count / row_count * 100`. The sample file has no missing cells, so every `missing_count` is `0`.

<a id="summary"></a>

## `GET /api/v1/datasets/{dataset_id}/summary`

Numeric columns use count, mean, standard deviation, min, 25%, 50%, 75%, and max. Other columns use count, unique, top value, and frequency of that top value. Values are full precision. The UI rounds them for display.

**200**

```json
{
  "status": "ok",
  "data": {
    "numeric": [
      {
        "column": "Quantity",
        "count": 300,
        "mean": 253.33666666666667,
        "std": 144.2,
        "min": 2,
        "p25": 120,
        "p50": 254.5,
        "p75": 380,
        "max": 500
      }
    ],
    "other": [
      {
        "column": "Region",
        "role": "category",
        "count": 300,
        "unique": 7,
        "top": "USA",
        "freq": 49
      }
    ]
  }
}
```

An all-null numeric column stays in `numeric` with `count: 0` and `null` for the other stats. The section status stays `ok`.

<a id="ranking"></a>

## `GET /api/v1/datasets/{dataset_id}/ranking`

| Query | Description |
| --- | --- |
| `metric` | Numeric column. Omitted means the suggested metric |
| `lang` | Sentence language |

A higher value is the better value. `top` is the five largest values. `worst` is the five smallest. Nulls in the metric are left out. Ties keep the original file order. When fewer than five values exist, the arrays contain those values.

**200** `ok`

```json
{
  "status": "ok",
  "data": {
    "metric": "Quantity",
    "higher_is_better": true,
    "top": [
      { "rank": 1, "values": { "Transaction_Date": "2025-01-02", "Quantity": 500 } }
    ],
    "worst": [
      { "rank": 1, "values": { "Transaction_Date": "2025-01-03", "Quantity": 2 } }
    ]
  }
}
```

`values` includes every column of that source row.

| HTTP | Result | When |
| --- | --- | --- |
| 200 | `unavailable` `no_numeric_column` | `metric` is omitted and there is no metric column |
| 200 | `unavailable` `metric_all_null` | Every value in the metric is null |
| 422 | `invalid_column` | The name is unknown, or the column is not numeric |

<a id="grouping"></a>

## `GET /api/v1/datasets/{dataset_id}/grouping`

One category column. Each group reports the row count plus the sum and the mean of the metric. Groups are ordered by sum descending. At most 100 groups are returned. `truncated` is `true` when more groups exist. Null category values form one group.

| Query | Description |
| --- | --- |
| `category` | Category or text column. Omitted means the suggested category |
| `metric` | Numeric column. Omitted means the suggested metric |
| `lang` | Sentence language |

**200** `ok`

```json
{
  "status": "ok",
  "data": {
    "category": "Region",
    "metric": "Quantity",
    "truncated": false,
    "groups": [
      { "value": "USA", "count": 49, "sum": 12000.0, "mean": 244.9 }
    ]
  }
}
```

| HTTP | Result | When |
| --- | --- | --- |
| 200 | `unavailable` `no_category_column` | `category` is omitted and there is no category column |
| 200 | `unavailable` `no_numeric_column` | `metric` is omitted and there is no metric column |
| 422 | `invalid_column` | Unknown name, `category` is numeric or datetime, or `metric` is not numeric |

A `text` column such as `Client_ID` is a valid explicit `category`. The 100-group cap still applies.

<a id="timeseries"></a>

## `GET /api/v1/datasets/{dataset_id}/timeseries`

Sum of the metric per time bucket. Rows with a null date or a null metric are left out.

Grain: `month` when the span from the earliest to the latest parsed date is greater than 90 days. Otherwise `day`.

The sample spans 2025-01-01 through 2025-03-31 (89 days), so the grain is `day`.

`bucket` is the ISO date of the bucket start (`YYYY-MM-DD`). Month buckets use the first day of the month.

| Query | Description |
| --- | --- |
| `date_column` | Datetime column. Omitted means the suggested datetime |
| `metric` | Numeric column. Omitted means the suggested metric |
| `lang` | Sentence language |

**200** `ok`

```json
{
  "status": "ok",
  "data": {
    "date_column": "Transaction_Date",
    "metric": "Quantity",
    "grain": "day",
    "points": [
      { "bucket": "2025-01-01", "sum": 7 }
    ]
  }
}
```

A single bucket is still `ok`.

| HTTP | Result | When |
| --- | --- | --- |
| 200 | `unavailable` `no_datetime_column` | `date_column` is omitted and there is no datetime column |
| 200 | `unavailable` `no_numeric_column` | `metric` is omitted and there is no metric column |
| 200 | `unavailable` `no_dated_rows` | The column exists and every date or every metric value is null |
| 422 | `invalid_column` | Unknown name, the date column parses for under 80% of non-null values, or the metric is not numeric |

<a id="insights"></a>

## `GET /api/v1/datasets/{dataset_id}/insights`

Up to five localized sentences in `items`. `text` is the sentence shown on the card and written into the export.

| Query | Description |
| --- | --- |
| `date_column` | Datetime column. Omitted means the suggested datetime |
| `lang` | Sentence language |

### Half period, when a datetime column resolves

Split point = earliest date + (latest date − earliest date) / 2. The first half is strictly before that instant. The second half is that instant and after.

For each metric column, compare the sums of the two halves. Skip a column whose first-half sum is 0. Rank the rest by the absolute value of `(second − first) / abs(first)` and keep five.

On the sample file the split point is 2025-02-14 12:00:00 (165 rows, then 135). The strongest change is `PnL`, about −30.1%. The next columns, in order, are `Transaction_Value`, `Price`, `Quantity`, and `Portfolio_Value`.

**200** `ok`

```json
{
  "status": "ok",
  "data": {
    "kind": "half_period",
    "period_start": "2025-01-01",
    "period_end": "2025-03-31",
    "items": [
      {
        "code": "half_period_change",
        "column": "PnL",
        "direction": "down",
        "change_pct": -30.12,
        "text": "PnL decreased by 30.1% between the first and second half of the period (2025-01-01–2025-03-31)."
      }
    ]
  }
}
```

`direction` is `up` or `down`. `change_pct` is the relative change times 100.

Russian sentence shape: «PnL снизился на 30,1% между первой и второй половиной периода (2025-01-01–2025-03-31).» The UI may format the percent with the locale; `text` is already localized by the server.

### Distribution, when no datetime column resolves

Then `kind` is `distribution` and `items` are built in this order, still capped at five:

1. Up to three columns with `missing_pct` > 0, largest share first. `code` is `missing_share`.
2. One sentence for the suggested category: its most frequent value and that value's share of rows. `code` is `top_category`.

The percent in `text` is one fraction digit. Russian uses a comma.

`missing_share`: "{column} is empty in {pct}% of rows." Russian: «{column} пуст в {pct}% строк.»

`top_category`: "{value} is the most frequent value in {column} ({pct}% of rows)." Russian: «{value} — самое частое значение в {column} ({pct}% строк).»

If that list is empty, the section is `unavailable` with `no_insight_inputs`.

| HTTP | Result | When |
| --- | --- | --- |
| 200 | `unavailable` `no_insight_inputs` | No usable half-period comparison, no missing values, and no category column |
| 422 | `invalid_column` | `date_column` was sent and it is unknown or parses for under 80% of non-null values |

<a id="query-rows"></a>

## `POST /api/v1/datasets/{dataset_id}/rows`

Returns one page of the filtered table. This does not change report sections.

```json
{
  "filter": {
    "combinator": "and",
    "conditions": [
      { "column": "Region", "operator": "in", "value": ["UAE", "UK"] },
      { "column": "PnL", "operator": "gt", "value": 0 }
    ]
  },
  "sort": [
    { "column": "PnL", "direction": "desc" }
  ],
  "group": {
    "mode": "rowspan",
    "columns": ["Region"]
  },
  "page": 1
}
```

`filter`, `sort`, and `group` may be `null`. `page` defaults to 1. Page size is always 100. A `page_size` field in the body is ignored.

`combinator` is `and` or `or` and applies to the whole list. There is one combinator, so mixed AND/OR chains do not need precedence rules. An empty `conditions` array filters nothing.

### Operators

| Operator | `value` | Columns |
| --- | --- | --- |
| `eq` | scalar | any |
| `gt`, `gte`, `lt`, `lte` | number or ISO date | `metric`, `datetime` |
| `between` | `[low, high]`, inclusive | `metric`, `datetime` |
| `contains` | string, case-insensitive | `text`, `category` |
| `in` | array of scalars | any |
| `empty`, `not_empty` | omitted | any |

Dates in filter values are ISO-8601.

### Sort and grouping

At most three sort keys. Nulls sort last. `direction` is `asc` or `desc`.

`group.mode`:

| Mode | Result |
| --- | --- |
| `rowspan` | Detail rows. Group columns are the leading sort, ascending. The user's sort applies inside each group. `spans` describes merges inside the current page only. A group that crosses a page boundary starts again on the next page |
| `aggregate` | One row per group. Columns are the group columns, `row_count`, and `{column}_sum` plus `{column}_mean` for every metric. Default order is `row_count` descending. A user sort is applied when it names one of those result columns |

`spans` use a zero-based row index inside the page.

### Success

**200**

```json
{
  "page": 1,
  "page_size": 100,
  "total_rows": 300,
  "total_pages": 3,
  "columns": ["Transaction_Date", "Region", "PnL"],
  "group": { "mode": "rowspan", "columns": ["Region"] },
  "rows": [
    { "Transaction_Date": "2025-01-01", "Region": "UAE", "PnL": 9141.5 }
  ],
  "spans": [
    { "column": "Region", "start_row": 0, "length": 12 }
  ]
}
```

In `aggregate` mode, `total_rows` counts groups, `spans` is an empty array, and `columns` lists the aggregate headers.

A filter that matches nothing is **200** with `rows: []`, `total_rows: 0`, and `total_pages: 0`.

### Query errors

| HTTP | `code` | When |
| --- | --- | --- |
| 422 | `invalid_filter` | Unknown operator, wrong value shape, operator illegal for the column role, or unknown column. `message` includes the condition index |
| 422 | `invalid_sort` | Unknown column, bad direction, or more than three keys |
| 422 | `invalid_group` | Unknown mode, empty `columns`, unknown column, or a metric column used as a group key |
| 422 | `invalid_page` | `page` < 1, or `page` greater than `total_pages` when `total_pages` > 0 |

Plus the [shared errors](#shared-errors).

<a id="export-rows"></a>

## `POST /api/v1/datasets/{dataset_id}/rows/export`

Query: `format` = `xlsx`, `csv`, or `json`. `lang` localizes the error messages only. Column names and cell values stay as stored.

The body is the same as [query rows](#query-rows). `page` is ignored. The file contains every matching row, or every aggregate row in `aggregate` mode.

| Format | Body |
| --- | --- |
| `xlsx` | One worksheet named `Data` |
| `csv` | UTF-8 with BOM, comma separator, header row |
| `json` | A JSON array of objects |

**200** with `Content-Disposition: attachment` and a filename built from the original stem plus the format extension.

| HTTP | `code` | When |
| --- | --- | --- |
| 422 | `unsupported_export_format` | `format` is missing or not one of the three |
| 422 | `invalid_filter`, `invalid_sort`, `invalid_group` | Same rules as the row query |

Plus the [shared errors](#shared-errors).

<a id="export-report"></a>

## `GET /api/v1/datasets/{dataset_id}/report`

Query: `format` = `xlsx` or `pdf`, and `lang` = `ru` or `en`.

The server rebuilds all ten report sections in that language. Filters from the data window are not applied.

Excel sheets, in call order: `Preview`, `Columns`, `Shape`, `Types`, `Missing`, `Summary`, `Ranking`, `Grouping`, `Timeseries`, `Insights`. Sheet names stay in English. Titles and insight sentences inside the sheets follow `lang`.

A section with status `unavailable` still gets its sheet (or its PDF block). The block contains `error.message` and no invented numbers.

PDF sections follow the same order: a heading, then a simple table or the unavailable message.

**200** with `Content-Disposition: attachment`.

| HTTP | `code` | When |
| --- | --- | --- |
| 422 | `unsupported_export_format` | `format` is missing or not `xlsx` or `pdf` |
| 422 | `invalid_language` | `lang` is not `ru` or `en` |

Plus the [shared errors](#shared-errors).

<a id="message-catalog"></a>

## Message catalog

The English sentence is the source. The Russian sentence is what `lang=ru` returns. Column names from the file are never translated.

### Unavailable codes

These codes appear in section envelopes.

| `code` | English message |
| --- | --- |
| `no_numeric_column` | There is no numeric column for this block. |
| `no_category_column` | There is no categorical column for this block. |
| `no_datetime_column` | There is no date column for this block. |
| `metric_all_null` | The selected metric has only empty values. |
| `no_dated_rows` | The date column has no values that can be plotted. |
| `no_insight_inputs` | There is no date column, no empty values, and no categorical column to describe. |

| `code` | Russian message |
| --- | --- |
| `no_numeric_column` | Для этого блока нет числовой колонки. |
| `no_category_column` | Для этого блока нет категориальной колонки. |
| `no_datetime_column` | Для этого блока нет колонки с датой. |
| `metric_all_null` | В выбранной метрике только пустые значения. |
| `no_dated_rows` | В колонке даты нет значений, которые можно построить. |
| `no_insight_inputs` | Нет колонки с датой, пустых значений и категориальной колонки, которые можно описать. |

### Error messages

These codes appear in the [error body](#conventions).

| `code` | English message |
| --- | --- |
| `dataset_not_found` | The dataset was not found. |
| `sheet_required` | Choose a worksheet before analysis. |
| `internal_error` | Something went wrong. |
| `invalid_language` | The language is not supported. |
| `missing_file` | No file was uploaded. |
| `file_too_large` | The file is larger than 100 MB. |
| `unsupported_format` | This file type is not supported. |
| `empty_file` | The file is empty. |
| `unreadable_file` | The file could not be read. |
| `encoding_error` | The text encoding could not be detected. |
| `not_a_table` | The file is not a table of records. |
| `no_data_rows` | The table has a header and no data rows. |
| `sheet_not_found` | The worksheet was not found. |
| `already_ready` | A sheet is already selected. Upload another file to change the source. |
| `invalid_column` | The column is unknown or cannot be used here. |

| `code` | Russian message |
| --- | --- |
| `dataset_not_found` | Набор данных не найден. |
| `sheet_required` | Выберите лист перед анализом. |
| `internal_error` | Что-то пошло не так. |
| `invalid_language` | Язык не поддерживается. |
| `missing_file` | Файл не был загружен. |
| `file_too_large` | Файл больше 100 МБ. |
| `unsupported_format` | Этот тип файла не поддерживается. |
| `empty_file` | Файл пуст. |
| `unreadable_file` | Файл не удалось прочитать. |
| `encoding_error` | Не удалось определить кодировку текста. |
| `not_a_table` | Файл не является таблицей записей. |
| `no_data_rows` | В таблице есть заголовок и нет строк данных. |
| `sheet_not_found` | Лист не найден. |
| `already_ready` | Лист уже выбран. Загрузите другой файл, чтобы сменить источник. |
| `invalid_column` | Колонка неизвестна или не подходит для этого запроса. |

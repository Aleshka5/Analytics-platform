"""Localized API sentences. Column names are inserted as stored in the file."""

_MESSAGES: dict[str, dict[str, str]] = {
    "no_numeric_column": {
        "en": "There is no numeric column for this block.",
        "ru": "Для этого блока нет числовой колонки.",
    },
    "no_category_column": {
        "en": "There is no categorical column for this block.",
        "ru": "Для этого блока нет категориальной колонки.",
    },
    "no_datetime_column": {
        "en": "There is no date column for this block.",
        "ru": "Для этого блока нет колонки с датой.",
    },
    "metric_all_null": {
        "en": "The selected metric has only empty values.",
        "ru": "В выбранной метрике только пустые значения.",
    },
    "no_dated_rows": {
        "en": "The date column has no values that can be plotted.",
        "ru": "В колонке даты нет значений, которые можно построить.",
    },
    "no_insight_inputs": {
        "en": "There is no date column, no empty values, and no categorical column to describe.",
        "ru": "Нет колонки с датой, пустых значений и категориальной колонки, которые можно описать.",
    },
    "dataset_not_found": {
        "en": "The dataset was not found.",
        "ru": "Набор данных не найден.",
    },
    "sheet_required": {
        "en": "Choose a worksheet before analysis.",
        "ru": "Выберите лист перед анализом.",
    },
    "internal_error": {
        "en": "Something went wrong.",
        "ru": "Что-то пошло не так.",
    },
    "invalid_language": {
        "en": "The language is not supported.",
        "ru": "Язык не поддерживается.",
    },
    "missing_file": {
        "en": "No file was uploaded.",
        "ru": "Файл не был загружен.",
    },
    "file_too_large": {
        "en": "The file is larger than 100 MB.",
        "ru": "Файл больше 100 МБ.",
    },
    "unsupported_format": {
        "en": "This file type is not supported.",
        "ru": "Этот тип файла не поддерживается.",
    },
    "empty_file": {
        "en": "The file is empty.",
        "ru": "Файл пуст.",
    },
    "unreadable_file": {
        "en": "The file could not be read.",
        "ru": "Файл не удалось прочитать.",
    },
    "encoding_error": {
        "en": "The text encoding could not be detected.",
        "ru": "Не удалось определить кодировку текста.",
    },
    "not_a_table": {
        "en": "The file is not a table of records.",
        "ru": "Файл не является таблицей записей.",
    },
    "no_data_rows": {
        "en": "The table has a header and no data rows.",
        "ru": "В таблице есть заголовок и нет строк данных.",
    },
    "sheet_not_found": {
        "en": "The worksheet was not found.",
        "ru": "Лист не найден.",
    },
    "already_ready": {
        "en": "A sheet is already selected. Upload another file to change the source.",
        "ru": "Лист уже выбран. Загрузите другой файл, чтобы сменить источник.",
    },
    "invalid_column": {
        "en": "The column is unknown or cannot be used here.",
        "ru": "Колонка неизвестна или не подходит для этого запроса.",
    },
}


def message(code: str, lang: str) -> str:
    """Return the sentence for `code`. Unknown languages fall back to English."""

    table = _MESSAGES[code]
    return table.get(lang, table["en"])


def _percent(value: float, lang: str) -> str:
    rendered = f"{abs(value):.1f}"
    if lang == "ru":
        rendered = rendered.replace(".", ",")
    return rendered


def half_period_text(
    column: str,
    direction: str,
    change_pct: float,
    period_start: str,
    period_end: str,
    lang: str,
) -> str:
    """One half-period insight. `direction` is `up` or `down`. Dates are YYYY-MM-DD."""

    percent = _percent(change_pct, lang)
    span = f"{period_start}–{period_end}"
    if lang == "ru":
        verb = "снизился" if direction == "down" else "вырос"
        return (
            f"{column} {verb} на {percent}% между первой и второй половиной периода ({span})."
        )
    verb = "decreased" if direction == "down" else "increased"
    return (
        f"{column} {verb} by {percent}% between the first and second half "
        f"of the period ({span})."
    )


def missing_share_text(column: str, missing_pct: float, lang: str) -> str:
    percent = _percent(missing_pct, lang)
    if lang == "ru":
        return f"{column} пуст в {percent}% строк."
    return f"{column} is empty in {percent}% of rows."


def top_category_text(column: str, value: str, share_pct: float, lang: str) -> str:
    percent = _percent(share_pct, lang)
    if lang == "ru":
        return f"{value} — самое частое значение в {column} ({percent}% строк)."
    return f"{value} is the most frequent value in {column} ({percent}% of rows)."

"""Assemble the ten full-table report sections into export blocks."""

from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import Any

from app.domain.messages import message
from app.domain.report_model import ReportBlock, ReportTable
from app.domain.types import SectionResult
from app.domain.values import json_value
from app.infrastructure.store import StoredDataset
from app.services.datasets import (
    columns_section,
    dtypes_section,
    grouping,
    insights,
    missing_section,
    preview_section,
    ranking,
    shape_section,
    summary_section,
    timeseries,
)

_SHEETS = (
    "Preview",
    "Columns",
    "Shape",
    "Types",
    "Missing",
    "Summary",
    "Ranking",
    "Grouping",
    "Timeseries",
    "Insights",
)

_TITLES = {
    "en": (
        "Preview",
        "Columns",
        "Size",
        "Data types",
        "Missing values",
        "Summary",
        "Top and worst",
        "Grouping",
        "Dynamics",
        "Insights",
    ),
    "ru": (
        "Просмотр",
        "Колонки",
        "Размер",
        "Типы данных",
        "Пропуски",
        "Сводка",
        "Лучшие и худшие",
        "Группировка",
        "Динамика",
        "Инсайты",
    ),
}

_NUMERIC = ("column", "count", "mean", "std", "min", "p25", "p50", "p75", "max")
_OTHER = ("column", "role", "count", "unique", "top", "freq")
_RANK_LABELS = {
    "en": ("Top", "Worst"),
    "ru": ("Лучшие", "Худшие"),
}


def build_report(dataset: StoredDataset, lang: str) -> tuple[ReportBlock, ...]:
    """Build all ten sections from the full table. Suggestions choose the columns."""

    titles = _TITLES.get(lang, _TITLES["en"])
    return (
        _ready(0, titles, _preview(preview_section(dataset))),
        _ready(
            1,
            titles,
            _records(
                columns_section(dataset),
                "columns",
                ("name", "dtype", "role", "unique_count"),
            ),
        ),
        _ready(2, titles, _flat(shape_section(dataset), ("row_count", "column_count"))),
        _ready(
            3,
            titles,
            _records(dtypes_section(dataset), "columns", ("name", "dtype", "role")),
        ),
        _ready(
            4,
            titles,
            _records(
                missing_section(dataset),
                "columns",
                ("name", "missing_count", "missing_pct", "non_null_count"),
            ),
        ),
        _ready(5, titles, _summary(summary_section(dataset))),
        _result(6, titles, lang, ranking(dataset, None), lambda data: _ranking(data, lang)),
        _result(7, titles, lang, grouping(dataset, None, None), _grouping),
        _result(8, titles, lang, timeseries(dataset, None, None), _timeseries),
        _result(9, titles, lang, insights(dataset, None, lang), _insights),
    )


def _ready(
    index: int,
    titles: tuple[str, ...],
    tables: tuple[ReportTable, ...],
) -> ReportBlock:
    return ReportBlock(
        sheet=_SHEETS[index],
        title=titles[index],
        message=None,
        tables=tables,
    )


def _result(
    index: int,
    titles: tuple[str, ...],
    lang: str,
    result: SectionResult,
    tables_from: Callable[[Mapping[str, Any]], tuple[ReportTable, ...]],
) -> ReportBlock:
    if result.status == "unavailable":
        code = result.code if result.code is not None else "internal_error"
        return ReportBlock(
            sheet=_SHEETS[index],
            title=titles[index],
            message=message(code, lang),
            tables=(),
        )
    data = result.data if result.data is not None else {}
    return ReportBlock(
        sheet=_SHEETS[index],
        title=titles[index],
        message=None,
        tables=tables_from(data),
    )


def _preview(data: Mapping[str, Any]) -> tuple[ReportTable, ...]:
    names = tuple(data["columns"])
    headers = tuple(str(name) for name in names)
    rows = tuple(_cells(row[name] for name in names) for row in data["rows"])
    return (ReportTable(headers=headers, rows=rows),)


def _records(
    data: Mapping[str, Any],
    key: str,
    headers: tuple[str, ...],
) -> tuple[ReportTable, ...]:
    return (_table(headers, data[key]),)


def _flat(data: Mapping[str, Any], headers: tuple[str, ...]) -> tuple[ReportTable, ...]:
    return (ReportTable(headers=headers, rows=(_cells(data[key] for key in headers),)),)


def _summary(data: Mapping[str, Any]) -> tuple[ReportTable, ...]:
    return (_table(_NUMERIC, data["numeric"]), _table(_OTHER, data["other"]))


def _ranking(data: Mapping[str, Any], lang: str) -> tuple[ReportTable, ...]:
    top, worst = _RANK_LABELS.get(lang, _RANK_LABELS["en"])
    return (_rank_table(top, data["top"]), _rank_table(worst, data["worst"]))


def _grouping(data: Mapping[str, Any]) -> tuple[ReportTable, ...]:
    return (_table(("value", "count", "sum", "mean"), data["groups"]),)


def _timeseries(data: Mapping[str, Any]) -> tuple[ReportTable, ...]:
    return (_table(("bucket", "sum"), data["points"]),)


def _insights(data: Mapping[str, Any]) -> tuple[ReportTable, ...]:
    tables: list[ReportTable] = []
    kind = data.get("kind")
    if kind is not None:
        if "period_start" in data or "period_end" in data:
            tables.append(
                ReportTable(
                    headers=("kind", "period_start", "period_end"),
                    rows=(
                        (
                            _cell(kind),
                            _cell(data.get("period_start")),
                            _cell(data.get("period_end")),
                        ),
                    ),
                )
            )
        else:
            tables.append(ReportTable(headers=("kind",), rows=((_cell(kind),),)))
    items = data.get("items") or []
    tables.append(
        ReportTable(
            headers=("text",),
            rows=tuple((_cell(item["text"]),) for item in items),
        )
    )
    return tuple(tables)


def _rank_table(label: str, items: Sequence[Mapping[str, Any]]) -> ReportTable:
    fields: list[str] = []
    seen: set[str] = set()
    for item in items:
        for key in item["values"]:
            name = str(key)
            if name not in seen:
                seen.add(name)
                fields.append(name)
    headers = (label, "rank", *fields)
    rows = tuple(
        (
            label,
            _cell(item["rank"]),
            *(_cell(item["values"].get(field)) for field in fields),
        )
        for item in items
    )
    return ReportTable(headers=headers, rows=rows)


def _table(headers: Sequence[str], rows: Sequence[Mapping[str, Any]]) -> ReportTable:
    keys = tuple(headers)
    return ReportTable(
        headers=keys,
        rows=tuple(_cells(row[key] for key in keys) for row in rows),
    )


def _cells(values: Iterable[Any]) -> tuple[str, ...]:
    return tuple(_cell(value) for value in values)


def _cell(value: Any) -> str:
    if value is None:
        return ""
    converted = json_value(value)
    if converted is None:
        return ""
    return str(converted)

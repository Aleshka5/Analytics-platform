"""Descriptive report blocks. Each function returns a JSON-ready dict."""

from typing import Any

import pandas as pd

from app.domain.types import ColumnInfo, Suggestions
from app.domain.values import json_value, row_record

_PREVIEW_ROWS = 20


def preview_data(frame: pd.DataFrame) -> dict[str, Any]:
    head = frame.head(_PREVIEW_ROWS)
    return {
        "row_limit": _PREVIEW_ROWS,
        "columns": [str(name) for name in frame.columns],
        "rows": [row_record(row) for _, row in head.iterrows()],
    }


def columns_data(
    columns: list[ColumnInfo], suggestions: Suggestions
) -> dict[str, Any]:
    return {
        "columns": [
            {
                "name": column.name,
                "dtype": column.dtype,
                "role": column.role,
                "unique_count": column.unique_count,
            }
            for column in columns
        ],
        "suggestions": {
            "metric": suggestions.metric,
            "category": suggestions.category,
            "datetime": suggestions.datetime,
        },
    }


def shape_data(frame: pd.DataFrame) -> dict[str, Any]:
    row_count, column_count = frame.shape
    return {"row_count": int(row_count), "column_count": int(column_count)}


def dtypes_data(columns: list[ColumnInfo]) -> dict[str, Any]:
    return {
        "columns": [
            {"name": column.name, "dtype": column.dtype, "role": column.role}
            for column in columns
        ]
    }


def missing_data(frame: pd.DataFrame) -> dict[str, Any]:
    row_count = len(frame)
    columns = []
    for name in frame.columns:
        missing_count = int(frame[name].isna().sum())
        columns.append(
            {
                "name": str(name),
                "missing_count": missing_count,
                "missing_pct": float(missing_count / row_count * 100),
                "non_null_count": int(row_count - missing_count),
            }
        )
    return {"columns": columns}


def summary_data(
    frame: pd.DataFrame, columns: list[ColumnInfo]
) -> dict[str, Any]:
    numeric = []
    other = []
    for label, column in zip(frame.columns, columns, strict=True):
        series = frame[label]
        if column.role == "metric":
            numeric.append(_numeric_summary(str(label), series))
        else:
            other.append(_other_summary(str(label), column.role, series))
    return {"numeric": numeric, "other": other}


def _numeric_summary(name: str, series: pd.Series) -> dict[str, Any]:
    count = int(series.count())
    if count == 0:
        stats: dict[str, float | None] = {
            "mean": None,
            "std": None,
            "min": None,
            "p25": None,
            "p50": None,
            "p75": None,
            "max": None,
        }
    else:
        stats = {
            "mean": _float_stat(series.mean()),
            "std": _float_stat(series.std(ddof=1)),
            "min": _float_stat(series.min()),
            "p25": _float_stat(series.quantile(0.25)),
            "p50": _float_stat(series.quantile(0.50)),
            "p75": _float_stat(series.quantile(0.75)),
            "max": _float_stat(series.max()),
        }
    return {"column": name, "count": count, **stats}


def _float_stat(value: Any) -> float | None:
    converted = json_value(value)
    if converted is None:
        return None
    return float(converted)


def _other_summary(name: str, role: str, series: pd.Series) -> dict[str, Any]:
    present = series.dropna()
    count = int(len(present))
    if count == 0:
        top = None
        freq = 0
    else:
        top, freq = _top_value(present)
        top = json_value(top)
    return {
        "column": name,
        "role": role,
        "count": count,
        "unique": int(series.nunique(dropna=True)),
        "top": top,
        "freq": freq,
    }


def _top_value(present: pd.Series) -> tuple[Any, int]:
    """Most frequent non-null value. Ties keep the first value in file order."""

    counts: dict[Any, int] = {}
    order: list[Any] = []
    for value in present.tolist():
        if value not in counts:
            counts[value] = 0
            order.append(value)
        counts[value] += 1
    top = order[0]
    for value in order:
        if counts[value] > counts[top]:
            top = value
    return top, counts[top]

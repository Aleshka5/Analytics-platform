"""Infer column roles and the suggested metric, category, and datetime."""

import warnings

import pandas as pd

from app.domain.types import ColumnInfo, Role, Suggestions

_DATE_SHARE = 0.8
_CATEGORY_MAX_UNIQUE = 30
_CATEGORY_UNIQUE_RATIO = 0.05


def prepare_table(
    frame: pd.DataFrame,
) -> tuple[pd.DataFrame, list[ColumnInfo], Suggestions]:
    """Copy the frame, convert datetime-role columns to datetime64[ns], return (frame, columns in file order, suggestions)."""

    prepared = frame.copy()
    columns: list[ColumnInfo] = []
    for name in prepared.columns:
        role, series = _classify(prepared[name])
        if role == "datetime":
            series = _as_datetime64_ns(series)
            prepared[name] = series
        columns.append(
            ColumnInfo(
                name=str(name),
                dtype=str(series.dtype),
                role=role,
                unique_count=int(series.nunique(dropna=True)),
            )
        )
    return prepared, columns, _suggestions(columns)


def _classify(series: pd.Series) -> tuple[Role, pd.Series]:
    if pd.api.types.is_bool_dtype(series):
        return "category", series
    if pd.api.types.is_numeric_dtype(series):
        return "metric", series
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime", series

    non_null_count = int(series.notna().sum())
    parsed = _parse_datetime(series)
    if parsed is not None and non_null_count > 0:
        if int(parsed.notna().sum()) / non_null_count >= _DATE_SHARE:
            return "datetime", parsed

    if non_null_count > 0:
        distinct = int(series.nunique(dropna=True))
        if (
            distinct <= _CATEGORY_MAX_UNIQUE
            or distinct / non_null_count <= _CATEGORY_UNIQUE_RATIO
        ):
            return "category", series
    return "text", series


def _parse_datetime(series: pd.Series) -> pd.Series | None:
    try:
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message="Could not infer format",
                category=UserWarning,
            )
            return pd.to_datetime(series, errors="coerce")
    except (TypeError, ValueError, OverflowError, pd.errors.OutOfBoundsDatetime):
        return None


def _as_datetime64_ns(series: pd.Series) -> pd.Series:
    if str(series.dtype) == "datetime64[ns]":
        return series
    try:
        return series.astype("datetime64[ns]")
    except (TypeError, ValueError, OverflowError, pd.errors.OutOfBoundsDatetime):
        return series


def _suggestions(columns: list[ColumnInfo]) -> Suggestions:
    return Suggestions(
        metric=_first(columns, "metric"),
        category=_first(columns, "category"),
        datetime=_first(columns, "datetime"),
    )


def _first(columns: list[ColumnInfo], role: Role) -> str | None:
    for column in columns:
        if column.role == role:
            return column.name
    return None

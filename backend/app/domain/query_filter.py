"""Apply one AND/OR filter list to a table."""

import math
import re
from typing import Any

import pandas as pd

from app.domain.query_errors import QueryRejected
from app.domain.types import ColumnInfo
from app.domain.values import json_value

_CODE = "invalid_filter"
_OPERATORS = frozenset(
    {
        "eq",
        "gt",
        "gte",
        "lt",
        "lte",
        "between",
        "contains",
        "in",
        "empty",
        "not_empty",
    }
)
_COMPARISONS = frozenset({"gt", "gte", "lt", "lte", "between"})
_ORDERED_ROLES = frozenset({"metric", "datetime"})
_TEXT_ROLES = frozenset({"text", "category"})

# Date, or date plus time, with an optional fraction and timezone.
_ISO_8601 = re.compile(
    r"^\d{4}-\d{2}-\d{2}"
    r"(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$"
)


def apply_filter(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    combinator: str | None,
    conditions: list[dict] | None,
) -> pd.DataFrame:
    """Return a copy of rows that match the filter. Never mutate frame."""

    if combinator not in (None, "and", "or"):
        raise QueryRejected(_CODE)
    if not conditions:
        return frame.copy()

    chosen = "and" if combinator is None else combinator
    by_name = {column.name: column for column in columns}
    masks = [
        _condition_mask(frame, by_name, condition, index)
        for index, condition in enumerate(conditions)
    ]
    selected = masks[0]
    for mask in masks[1:]:
        selected = selected & mask if chosen == "and" else selected | mask
    return frame.loc[selected.to_numpy()].copy()


def _condition_mask(
    frame: pd.DataFrame,
    by_name: dict[str, ColumnInfo],
    condition: object,
    index: int,
) -> pd.Series:
    if not isinstance(condition, dict):
        raise _fail(index)
    column = _column(by_name, condition, index)
    operator = condition.get("operator")
    if not isinstance(operator, str) or operator not in _OPERATORS:
        raise _fail(index)
    _check_role(operator, column.role, index)
    series = frame[column.name]
    value = condition.get("value")
    if operator == "empty":
        # An empty string is a real value. Only pandas missing markers count.
        mask = series.isna()
    elif operator == "not_empty":
        mask = ~series.isna()
    elif operator == "contains":
        mask = _contains_mask(series, value, index)
    elif operator == "between":
        mask = _between_mask(series, column.role, value, index)
    elif operator == "in":
        mask = _in_mask(series, column.role, value, index)
    elif operator == "eq":
        mask = _eq_mask(series, column.role, value, index)
    else:
        mask = _ordered_mask(series, column.role, operator, value, index)
    return mask.fillna(False).astype(bool)


def _column(
    by_name: dict[str, ColumnInfo], condition: dict[str, Any], index: int
) -> ColumnInfo:
    name = condition.get("column")
    info = by_name.get(name) if isinstance(name, str) else None
    if info is None:
        raise _fail(index)
    return info


def _check_role(operator: str, role: str, index: int) -> None:
    if operator == "contains" and role not in _TEXT_ROLES:
        raise _fail(index)
    if operator in _COMPARISONS and role not in _ORDERED_ROLES:
        raise _fail(index)


def _eq_mask(series: pd.Series, role: str, value: object, index: int) -> pd.Series:
    target = _eq_target(role, value, index)
    return _match_eq(series, role, target)


def _in_mask(series: pd.Series, role: str, value: object, index: int) -> pd.Series:
    if not isinstance(value, list):
        raise _fail(index)
    targets = [_eq_target(role, item, index) for item in value]
    if role == "metric":
        return _numbers(series).isin(targets)
    if role == "datetime":
        return _timestamps(series).isin(targets)
    return _text(series).isin(targets)


def _contains_mask(series: pd.Series, value: object, index: int) -> pd.Series:
    if not _is_scalar(value):
        raise _fail(index)
    needle = str(value).casefold()

    def match(cell: object) -> bool:
        rendered = json_value(cell)
        if rendered is None:
            return False
        return needle in str(rendered).casefold()

    return series.map(match)


def _between_mask(
    series: pd.Series, role: str, value: object, index: int
) -> pd.Series:
    if not isinstance(value, list) or len(value) != 2:
        raise _fail(index)
    low = _bound(role, value[0], index)
    high = _bound(role, value[1], index)
    if low > high:
        raise _fail(index)
    column = _numbers(series) if role == "metric" else _timestamps(series)
    return column.ge(low) & column.le(high)


def _ordered_mask(
    series: pd.Series, role: str, operator: str, value: object, index: int
) -> pd.Series:
    bound = _bound(role, value, index)
    column = _numbers(series) if role == "metric" else _timestamps(series)
    compare = {
        "gt": column.gt,
        "gte": column.ge,
        "lt": column.lt,
        "lte": column.le,
    }[operator]
    return compare(bound)


def _eq_target(role: str, value: object, index: int) -> float | pd.Timestamp | str:
    if role == "metric":
        return _number(value, index)
    if role == "datetime":
        return _timestamp(value, index)
    if not _is_scalar(value):
        raise _fail(index)
    return str(value)


def _match_eq(
    series: pd.Series, role: str, target: float | pd.Timestamp | str
) -> pd.Series:
    if role == "metric":
        return _numbers(series).eq(target)
    if role == "datetime":
        return _timestamps(series).eq(target)
    return _text(series).eq(target)


def _bound(role: str, value: object, index: int) -> float | pd.Timestamp:
    if role == "metric":
        return _number(value, index)
    return _timestamp(value, index)


def _numbers(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _timestamps(series: pd.Series) -> pd.Series:
    if pd.api.types.is_datetime64_any_dtype(series):
        stamps = series
    else:
        stamps = pd.to_datetime(series, errors="coerce", format="ISO8601")
    if getattr(stamps.dtype, "tz", None) is not None:
        return stamps.dt.tz_convert("UTC").dt.tz_localize(None)
    return stamps


def _text(series: pd.Series) -> pd.Series:
    """String form of each cell. Missing cells stay None and never match."""

    def render(value: object) -> str | None:
        rendered = json_value(value)
        if rendered is None:
            return None
        return str(rendered)

    return series.map(render)


def _timestamp(value: object, index: int) -> pd.Timestamp:
    if not isinstance(value, str) or _ISO_8601.fullmatch(value) is None:
        raise _fail(index)
    try:
        stamp = pd.Timestamp(value)
    except (ValueError, OverflowError, pd.errors.OutOfBoundsDatetime) as error:
        raise _fail(index) from error
    if pd.isna(stamp):
        raise _fail(index)
    # A date-only value is midnight, so it equals a timestamp at 00:00:00.
    if stamp.tzinfo is not None:
        stamp = stamp.tz_convert("UTC").tz_localize(None)
    return stamp


def _number(value: object, index: int) -> float:
    # bool is a subclass of int and is not a numeric filter value.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _fail(index)
    if not math.isfinite(value):
        raise _fail(index)
    return float(value)


def _is_scalar(value: object) -> bool:
    # bool is a scalar for text and category. Metric checks reject it separately.
    return isinstance(value, (str, int, float, bool))


def _fail(index: int | None = None) -> QueryRejected:
    return QueryRejected(_CODE, index)

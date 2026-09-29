"""Group validation, page bounds, rowspan spans, and aggregate rows."""

import math

import pandas as pd

from app.domain.query_errors import QueryRejected
from app.domain.types import ColumnInfo

PAGE_SIZE = 100
_MODES = frozenset({"rowspan", "aggregate"})


def validate_group(
    columns: list[ColumnInfo],
    group: dict | None,
) -> tuple[str, list[str]] | None:
    """Return `(mode, column_names)` or None when `group` is None.

    `group` is `{"mode": "rowspan"|"aggregate", "columns": [str, ...]}`.
    Raises `QueryRejected("invalid_group")` when the mode is unknown, `columns`
    is missing, not a list, or empty, a name is unknown, or a group key is a
    metric.
    """
    if group is None:
        return None
    mode = group.get("mode")
    names = group.get("columns")
    if mode not in _MODES:
        raise QueryRejected("invalid_group")
    if not isinstance(names, list) or len(names) == 0:
        raise QueryRejected("invalid_group")
    by_name = {column.name: column for column in columns}
    selected: list[str] = []
    for name in names:
        column = by_name.get(name) if isinstance(name, str) else None
        if column is None or column.role == "metric":
            raise QueryRejected("invalid_group")
        selected.append(name)
    return mode, selected


def page_bounds(total_rows: int, page: int) -> tuple[int, int, int]:
    """Return `(start, stop, total_pages)` for a fixed page size of 100.

    `total_pages` is 0 when `total_rows` is 0, otherwise `ceil(total_rows / 100)`.
    `page` below 1 raises `QueryRejected("invalid_page")`. `page` past the last
    page raises the same error when there is at least one page. An empty table
    with `page` >= 1 returns `(0, 0, 0)`.
    """
    if page < 1:
        raise QueryRejected("invalid_page")
    if total_rows == 0:
        return (0, 0, 0)
    total_pages = math.ceil(total_rows / PAGE_SIZE)
    if page > total_pages:
        raise QueryRejected("invalid_page")
    start = (page - 1) * PAGE_SIZE
    stop = min(start + PAGE_SIZE, total_rows)
    return (start, stop, total_pages)


def spans_for_page(page: pd.DataFrame, group_columns: list[str]) -> list[dict]:
    """Page-local rowspan descriptors, using a zero-based index in `page`.

    For each group column, in order, emit each maximal run of equal values
    (missing equals missing) whose length is at least 2. A run that continues
    a group from the previous page still starts at its position on this page.
    """
    spans: list[dict] = []
    for name in group_columns:
        values = page[name].tolist()
        start = 0
        for index in range(1, len(values) + 1):
            at_end = index == len(values)
            if at_end or not _same_value(values[start], values[index]):
                length = index - start
                if length >= 2:
                    spans.append(
                        {"column": name, "start_row": start, "length": length}
                    )
                start = index
    return spans


def aggregate_frame(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    group_columns: list[str],
) -> tuple[pd.DataFrame, list[str]]:
    """Return one row per group and the result column names. `frame` is unchanged.

    Columns are the group keys, `row_count`, then `{metric}_sum` and
    `{metric}_mean` for each metric in `columns` order. Sum and mean skip
    missing values. A group whose metric is entirely missing stores None, not
    NaN. Non-null sums and means are floats. Null group keys stay one group.
    Row order is first appearance; this function does not sort.
    """
    metric_names = [column.name for column in columns if column.role == "metric"]
    result_names = list(group_columns)
    result_names.append("row_count")
    for name in metric_names:
        result_names.append(f"{name}_sum")
        result_names.append(f"{name}_mean")

    built: dict[str, list[object]] = {name: [] for name in result_names}
    if not frame.empty:
        grouped = frame.groupby(group_columns, dropna=False, sort=False)
        for _key, part in grouped:
            for name in group_columns:
                built[name].append(part[name].iloc[0])
            built["row_count"].append(len(part))
            for name in metric_names:
                total, average = _sum_and_mean(part[name])
                built[f"{name}_sum"].append(total)
                built[f"{name}_mean"].append(average)

    result = pd.DataFrame(
        {name: pd.Series(built[name], dtype=object) for name in result_names}
    )
    return result, result_names


def _same_value(left: object, right: object) -> bool:
    left_missing = pd.isna(left)
    right_missing = pd.isna(right)
    if left_missing or right_missing:
        return bool(left_missing and right_missing)
    return left == right


def _sum_and_mean(series: pd.Series) -> tuple[float | None, float | None]:
    present = series.dropna()
    if present.empty:
        return None, None
    return float(present.sum()), float(present.mean())

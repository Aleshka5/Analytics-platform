"""User and leading sort keys for a row query. The frame is never mutated."""

import pandas as pd

from app.domain.query_errors import QueryRejected
from app.domain.types import ColumnInfo

_MAX_USER_KEYS = 3
_ASCENDING = {"asc": True, "desc": False}


def apply_sort(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    sort: list[dict] | None,
    *,
    allowed: set[str] | None = None,
    leading: list[tuple[str, str]] | None = None,
) -> pd.DataFrame:
    """Return a new frame sorted with nulls last.

    `sort` holds at most three `{"column", "direction"}` items. `direction`
    is `asc` or `desc`. `None` or `[]` adds no user keys. When `allowed` is
    set, every user column must be in that set; otherwise it must be a known
    column. `leading` keys are applied first and do not count toward the
    limit. A user key that repeats a leading column is dropped.
    """
    user_keys = _user_keys(columns, sort, allowed)
    leading_keys = leading or []
    leading_names = {name for name, _direction in leading_keys}
    keys = leading_keys + [
        (name, direction)
        for name, direction in user_keys
        if name not in leading_names
    ]
    if not keys:
        return frame.copy()
    return frame.sort_values(
        by=[name for name, _direction in keys],
        ascending=[_ASCENDING[direction] for _name, direction in keys],
        na_position="last",
        kind="mergesort",
    )


def _user_keys(
    columns: list[ColumnInfo],
    sort: list[dict] | None,
    allowed: set[str] | None,
) -> list[tuple[str, str]]:
    if not sort:
        return []
    if len(sort) > _MAX_USER_KEYS:
        raise QueryRejected("invalid_sort")
    known = {column.name for column in columns}
    permitted = allowed if allowed is not None else known
    keys: list[tuple[str, str]] = []
    for item in sort:
        column = item.get("column") if isinstance(item, dict) else None
        direction = item.get("direction") if isinstance(item, dict) else None
        if (
            not isinstance(column, str)
            or column not in permitted
            or direction not in _ASCENDING
        ):
            raise QueryRejected("invalid_sort")
        keys.append((column, direction))
    return keys

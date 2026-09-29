"""Every matching row for a table export. `page` is ignored."""

from typing import Any

import pandas as pd

from app.domain.query_errors import QueryRejected
from app.domain.query_filter import apply_filter
from app.domain.query_group import aggregate_frame, validate_group
from app.domain.query_sort import apply_sort
from app.domain.values import row_record
from app.infrastructure.store import StoredDataset


def rows_for_export(dataset: StoredDataset, body: dict[str, Any]) -> dict[str, Any]:
    """Return every row for `body`. The stored frame is left unchanged.

    Filter, sort, and group follow `query_rows`. `page` is not read.
    """

    frame = dataset.frame
    columns = dataset.columns
    if frame is None:
        raise RuntimeError("Dataset frame is missing.")
    # Original file order. Helpers copy the frame before they filter or sort.
    file_columns = [str(name) for name in frame.columns]

    combinator, conditions = _filter_arguments(body.get("filter"))
    filtered = apply_filter(frame, columns, combinator, conditions)
    grouping = validate_group(columns, body.get("group"))
    sort = body.get("sort")

    if grouping is None:
        ordered = apply_sort(filtered, columns, sort)
        rows = _records(ordered)
        group_body = None
        result_columns = file_columns
    else:
        mode, group_columns = grouping
        if mode == "rowspan":
            leading = [(name, "asc") for name in group_columns]
            ordered = apply_sort(filtered, columns, sort, leading=leading)
            rows = _records(ordered)
            group_body = {"mode": "rowspan", "columns": group_columns}
            result_columns = file_columns
        elif mode == "aggregate":
            aggregated, result_columns = aggregate_frame(
                filtered, columns, group_columns
            )
            if not sort:
                sort_keys = [{"column": "row_count", "direction": "desc"}]
            else:
                sort_keys = sort
            ordered = apply_sort(
                aggregated,
                columns,
                sort_keys,
                allowed=set(result_columns),
                leading=None,
            )
            rows = _records(ordered.loc[:, list(result_columns)])
            group_body = {"mode": "aggregate", "columns": group_columns}
        else:
            raise QueryRejected("invalid_group")

    return {
        "columns": result_columns,
        "rows": rows,
        "group": group_body,
    }


def _filter_arguments(
    filter_body: dict[str, Any] | None,
) -> tuple[str | None, list[dict[str, Any]] | None]:
    if filter_body is None:
        return None, None
    conditions = filter_body.get("conditions")
    if conditions is None:
        conditions = []
    combinator = filter_body.get("combinator")
    return combinator, conditions


def _records(ordered: pd.DataFrame) -> list[dict[str, Any]]:
    return [row_record(row) for _, row in ordered.iterrows()]

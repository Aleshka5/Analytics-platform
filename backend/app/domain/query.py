"""One page of a filtered, sorted, and optionally grouped dataset."""

from typing import Any

import pandas as pd

from app.domain.query_errors import QueryRejected
from app.domain.query_filter import apply_filter
from app.domain.query_group import (
    PAGE_SIZE,
    aggregate_frame,
    page_bounds,
    spans_for_page,
    validate_group,
)
from app.domain.query_sort import apply_sort
from app.domain.values import row_record
from app.infrastructure.store import StoredDataset


def query_rows(dataset: StoredDataset, body: dict[str, Any]) -> dict[str, Any]:
    """Return one page for `body`. The stored frame is left unchanged."""

    frame = dataset.frame
    columns = dataset.columns
    if frame is None:
        raise RuntimeError("Dataset frame is missing.")
    # Original file order. Helpers copy the frame before they filter or sort.
    file_columns = [str(name) for name in frame.columns]

    combinator, conditions = _filter_arguments(body.get("filter"))
    filtered = apply_filter(frame, columns, combinator, conditions)
    grouping = validate_group(columns, body.get("group"))
    page = _page(body)
    sort = body.get("sort")

    if grouping is None:
        ordered = apply_sort(filtered, columns, sort)
        page_frame, total, total_pages = _window(ordered, page)
        rows = _records(page_frame)
        spans: list[dict[str, Any]] = []
        group_body = None
        result_columns = file_columns
    else:
        mode, group_columns = grouping
        if mode == "rowspan":
            leading = [(name, "asc") for name in group_columns]
            ordered = apply_sort(filtered, columns, sort, leading=leading)
            page_frame, total, total_pages = _window(ordered, page)
            rows = _records(page_frame)
            spans = spans_for_page(page_frame, group_columns)
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
            page_frame, total, total_pages = _window(ordered, page)
            rows = _records(page_frame.loc[:, list(result_columns)])
            spans = []
            group_body = {"mode": "aggregate", "columns": group_columns}
        else:
            raise QueryRejected("invalid_group")

    return {
        "page": page,
        "page_size": PAGE_SIZE,
        "total_rows": total,
        "total_pages": total_pages,
        "columns": result_columns,
        "group": group_body,
        "rows": rows,
        "spans": spans,
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


def _page(body: dict[str, Any]) -> int:
    page = body.get("page", 1)
    if page is None:
        return 1
    return page


def _window(ordered: pd.DataFrame, page: int) -> tuple[pd.DataFrame, int, int]:
    total = len(ordered)
    start, stop, total_pages = page_bounds(total, page)
    return ordered.iloc[start:stop], total, total_pages


def _records(page_frame: pd.DataFrame) -> list[dict[str, Any]]:
    return [row_record(row) for _, row in page_frame.iterrows()]

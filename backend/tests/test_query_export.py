from datetime import datetime, timezone

import pandas as pd
import pytest

from app.domain.query import query_rows
from app.domain.query_errors import QueryRejected
from app.domain.query_export import rows_for_export
from app.domain.types import ColumnInfo, Suggestions
from app.infrastructure.store import StoredDataset


def _column(name: str, role: str) -> ColumnInfo:
    return ColumnInfo(name=name, dtype="object", role=role, unique_count=1)


def _dataset(frame: pd.DataFrame) -> StoredDataset:
    moment = datetime(2026, 9, 30, tzinfo=timezone.utc)
    return StoredDataset(
        dataset_id="ds-export",
        filename="rows.csv",
        content=b"rows",
        size_bytes=4,
        status="ready",
        sheet="Sheet1",
        sheets=["Sheet1"],
        frame=frame,
        columns=[
            _column("Region", "category"),
            _column("Amount", "metric"),
        ],
        suggestions=Suggestions(metric="Amount", category="Region", datetime=None),
        created_at=moment,
        expires_at=moment,
    )


def _keep_filter() -> dict:
    return {
        "combinator": "and",
        "conditions": [
            {"column": "Region", "operator": "eq", "value": "keep"},
        ],
    }


def test_export_returns_every_filtered_row_past_one_page() -> None:
    regions = ["keep"] * 120 + ["drop"] * 30
    frame = pd.DataFrame(
        {"Region": regions, "Amount": [float(index) for index in range(150)]}
    )
    original = frame.copy()
    dataset = _dataset(frame)
    body = {"filter": _keep_filter(), "page": 1}

    exported = rows_for_export(dataset, body)
    paged = query_rows(dataset, body)

    assert len(exported["rows"]) == 120
    assert len(exported["rows"]) > 100
    assert len(paged["rows"]) == 100
    assert paged["total_rows"] == len(exported["rows"])
    assert exported["columns"] == ["Region", "Amount"]
    assert exported["group"] is None
    assert [row["Amount"] for row in exported["rows"]] == [
        float(index) for index in range(120)
    ]
    assert rows_for_export(dataset, {**body, "page": 99})["rows"] == exported["rows"]
    pd.testing.assert_frame_equal(dataset.frame, original)


def test_aggregate_export_is_one_row_per_group() -> None:
    regions = ["A"] * 60 + ["B"] * 40 + ["C"] * 30 + ["D"] * 20
    frame = pd.DataFrame(
        {"Region": regions, "Amount": [float(index) for index in range(150)]}
    )
    dataset = _dataset(frame)
    body = {
        "group": {"mode": "aggregate", "columns": ["Region"]},
        "page": 1,
    }

    exported = rows_for_export(dataset, body)
    paged = query_rows(dataset, body)

    assert exported["group"] == {"mode": "aggregate", "columns": ["Region"]}
    assert exported["columns"] == paged["columns"]
    assert "row_count" in exported["columns"]
    assert "Amount_sum" in exported["columns"]
    assert "Amount_mean" in exported["columns"]
    assert len(exported["rows"]) == 4
    assert len(exported["rows"]) == paged["total_rows"]
    assert len(exported["rows"]) != len(frame)
    assert exported["rows"] == paged["rows"]
    assert [row["Region"] for row in exported["rows"]] == ["A", "B", "C", "D"]
    assert [row["row_count"] for row in exported["rows"]] == [60, 40, 30, 20]


def test_negative_page_does_not_raise() -> None:
    regions = ["keep"] * 120 + ["drop"] * 30
    dataset = _dataset(
        pd.DataFrame(
            {"Region": regions, "Amount": [float(index) for index in range(150)]}
        )
    )
    body = {"filter": _keep_filter(), "page": -1}

    exported = rows_for_export(dataset, body)

    assert len(exported["rows"]) == 120
    with pytest.raises(QueryRejected) as caught:
        query_rows(dataset, body)
    assert caught.value.code == "invalid_page"


def test_unknown_filter_column_raises_invalid_filter() -> None:
    dataset = _dataset(pd.DataFrame({"Region": ["keep"], "Amount": [1.0]}))

    with pytest.raises(QueryRejected) as caught:
        rows_for_export(
            dataset,
            {
                "filter": {
                    "combinator": "and",
                    "conditions": [
                        {"column": "Missing", "operator": "eq", "value": "x"},
                    ],
                },
                "page": 1,
            },
        )

    assert caught.value.code == "invalid_filter"
    assert caught.value.index == 0


def test_empty_match_returns_columns_and_no_rows() -> None:
    frame = pd.DataFrame({"Region": ["keep"], "Amount": [1.0]})
    dataset = _dataset(frame)

    exported = rows_for_export(
        dataset,
        {
            "filter": {
                "combinator": "and",
                "conditions": [
                    {"column": "Region", "operator": "eq", "value": "missing"},
                ],
            }
        },
    )

    assert exported["columns"] == ["Region", "Amount"]
    assert exported["rows"] == []
    assert exported["group"] is None


def test_rowspan_export_keeps_every_detail_row_in_leading_sort() -> None:
    regions = ["B", "A"] * 75
    dataset = _dataset(
        pd.DataFrame(
            {"Region": regions, "Amount": [float(index) for index in range(150)]}
        )
    )
    body = {"group": {"mode": "rowspan", "columns": ["Region"]}, "page": 1}

    exported = rows_for_export(dataset, body)
    paged = query_rows(dataset, body)

    assert exported["columns"] == ["Region", "Amount"]
    assert exported["group"] == {"mode": "rowspan", "columns": ["Region"]}
    assert len(exported["rows"]) == 150
    assert paged["total_rows"] == 150
    assert len(paged["rows"]) == 100
    assert [row["Region"] for row in exported["rows"]] == ["A"] * 75 + ["B"] * 75

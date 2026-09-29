import pandas as pd
import pytest

from app.domain.query_errors import QueryRejected
from app.domain.query_group import (
    PAGE_SIZE,
    aggregate_frame,
    page_bounds,
    spans_for_page,
    validate_group,
)
from app.domain.types import ColumnInfo


def _column(name: str, role: str) -> ColumnInfo:
    return ColumnInfo(name=name, dtype="object", role=role, unique_count=1)


def _sample_columns() -> list[ColumnInfo]:
    return [
        _column("Region", "category"),
        _column("Sold", "datetime"),
        _column("Client", "text"),
        _column("PnL", "metric"),
    ]


def test_validate_group_rejects_unknown_mode() -> None:
    with pytest.raises(QueryRejected) as caught:
        validate_group(
            _sample_columns(),
            {"mode": "pivot", "columns": ["Region"]},
        )

    assert caught.value.code == "invalid_group"
    assert caught.value.index is None


def test_validate_group_rejects_empty_or_missing_columns() -> None:
    columns = _sample_columns()
    groups = (
        {"mode": "rowspan", "columns": []},
        {"mode": "aggregate"},
        {"mode": "rowspan", "columns": "Region"},
    )

    for group in groups:
        with pytest.raises(QueryRejected) as caught:
            validate_group(columns, group)
        assert caught.value.code == "invalid_group"
        assert caught.value.index is None


def test_validate_group_rejects_unknown_column() -> None:
    with pytest.raises(QueryRejected) as caught:
        validate_group(
            _sample_columns(),
            {"mode": "rowspan", "columns": ["Missing"]},
        )

    assert caught.value.code == "invalid_group"
    assert caught.value.index is None


def test_validate_group_rejects_metric_group_key() -> None:
    with pytest.raises(QueryRejected) as caught:
        validate_group(
            _sample_columns(),
            {"mode": "aggregate", "columns": ["PnL"]},
        )

    assert caught.value.code == "invalid_group"
    assert caught.value.index is None


def test_validate_group_accepts_non_metric_columns() -> None:
    columns = _sample_columns()

    assert validate_group(columns, None) is None
    assert validate_group(
        columns, {"mode": "rowspan", "columns": ["Region", "Client"]}
    ) == ("rowspan", ["Region", "Client"])
    assert validate_group(
        columns, {"mode": "aggregate", "columns": ["Sold"]}
    ) == ("aggregate", ["Sold"])


def test_page_bounds() -> None:
    assert PAGE_SIZE == 100

    with pytest.raises(QueryRejected) as caught:
        page_bounds(250, 0)
    assert caught.value.code == "invalid_page"
    assert caught.value.index is None

    assert page_bounds(250, 1) == (0, 100, 3)
    assert page_bounds(250, 3) == (200, 250, 3)

    with pytest.raises(QueryRejected) as caught:
        page_bounds(250, 4)
    assert caught.value.code == "invalid_page"
    assert caught.value.index is None

    assert page_bounds(0, 1) == (0, 0, 0)


def test_spans_for_page_are_local_runs_of_length_at_least_two() -> None:
    page = pd.DataFrame(
        {"Region": ["UAE", "UAE", "UK"]},
        index=[100, 101, 102],
    )
    following = pd.DataFrame({"Region": ["UAE", "UAE"]})

    assert spans_for_page(page, ["Region"]) == [
        {"column": "Region", "start_row": 0, "length": 2},
    ]
    assert spans_for_page(following, ["Region"]) == [
        {"column": "Region", "start_row": 0, "length": 2},
    ]


def test_spans_follow_group_column_order_and_treat_missing_as_equal() -> None:
    page = pd.DataFrame(
        {
            "Region": ["UAE", "UAE", None, None, "UK", "UAE", "UAE"],
            "Desk": ["A", "B", "B", "B", "B", "A", "A"],
        }
    )

    assert spans_for_page(page, ["Region", "Desk"]) == [
        {"column": "Region", "start_row": 0, "length": 2},
        {"column": "Region", "start_row": 2, "length": 2},
        {"column": "Region", "start_row": 5, "length": 2},
        {"column": "Desk", "start_row": 1, "length": 4},
        {"column": "Desk", "start_row": 5, "length": 2},
    ]


def test_aggregate_frame_sums_means_and_keeps_null_metric_rows_in_count() -> None:
    frame = pd.DataFrame(
        {
            "Region": ["UK", "UAE", "UK", "UAE", "UK"],
            "Client": ["a", "b", "c", "d", "e"],
            "PnL": [4.0, 20.0, None, 6.0, 8.0],
            "Qty": [1.0, 10.0, 3.0, None, 5.0],
        }
    )
    columns = [
        _column("Region", "category"),
        _column("Client", "text"),
        _column("Qty", "metric"),
        _column("PnL", "metric"),
    ]
    original = frame.copy()

    result, names = aggregate_frame(frame, columns, ["Region"])

    assert names == [
        "Region",
        "row_count",
        "Qty_sum",
        "Qty_mean",
        "PnL_sum",
        "PnL_mean",
    ]
    assert list(result.columns) == names
    assert result["Region"].tolist() == ["UK", "UAE"]
    assert result["row_count"].tolist() == [3, 2]
    assert result["Qty_sum"].tolist() == [9.0, 10.0]
    assert result["Qty_mean"].tolist() == [3.0, 10.0]
    assert result["PnL_sum"].tolist() == [12.0, 26.0]
    assert result["PnL_mean"].tolist() == [6.0, 13.0]
    assert all(isinstance(value, float) for value in result["PnL_sum"].tolist())
    pd.testing.assert_frame_equal(frame, original)


def test_aggregate_frame_null_metric_is_none_and_null_keys_stay() -> None:
    frame = pd.DataFrame(
        {
            "Region": ["UAE", "UAE", None, None],
            "PnL": [None, None, 3.0, 7.0],
        }
    )
    columns = [
        _column("Region", "category"),
        _column("PnL", "metric"),
    ]

    result, names = aggregate_frame(frame, columns, ["Region"])

    assert names == ["Region", "row_count", "PnL_sum", "PnL_mean"]
    assert len(result) == 2
    present = result.loc[result["Region"].eq("UAE")].iloc[0]
    missing = result.loc[result["Region"].isna()].iloc[0]
    assert present["row_count"] == 2
    assert present["PnL_sum"] is None
    assert present["PnL_mean"] is None
    assert missing["row_count"] == 2
    assert missing["PnL_sum"] == 10.0
    assert missing["PnL_mean"] == 5.0

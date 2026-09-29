import pandas as pd
import pytest

from app.domain.query_errors import QueryRejected
from app.domain.query_sort import apply_sort
from app.domain.types import ColumnInfo


def _columns(*names: str) -> list[ColumnInfo]:
    return [
        ColumnInfo(name=name, dtype="object", role="category", unique_count=1)
        for name in names
    ]


def test_three_sort_keys_keep_order_and_put_nulls_last_on_desc() -> None:
    frame = pd.DataFrame(
        {
            "Region": ["UK", "UAE", "UK", None, "UAE", "UK"],
            "PnL": [1.0, 9.0, 1.0, 0.0, 4.0, 3.0],
            "Qty": [5, 1, 2, 0, 3, 8],
        }
    )
    original = frame.copy()

    result = apply_sort(
        frame,
        _columns("Region", "PnL", "Qty"),
        [
            {"column": "Region", "direction": "desc"},
            {"column": "PnL", "direction": "asc"},
            {"column": "Qty", "direction": "asc"},
        ],
    )

    assert result["Region"].iloc[:5].tolist() == ["UK", "UK", "UK", "UAE", "UAE"]
    assert pd.isna(result["Region"].iloc[5])
    assert result["PnL"].tolist() == [1.0, 1.0, 3.0, 4.0, 9.0, 0.0]
    assert result["Qty"].tolist() == [2, 5, 8, 3, 1, 0]
    assert result is not frame
    pd.testing.assert_frame_equal(frame, original)


def test_fourth_sort_key_is_rejected() -> None:
    frame = pd.DataFrame({"PnL": [1.0]})
    sort = [
        {"column": "PnL", "direction": "asc"},
        {"column": "PnL", "direction": "desc"},
        {"column": "PnL", "direction": "asc"},
        {"column": "PnL", "direction": "desc"},
    ]

    with pytest.raises(QueryRejected) as caught:
        apply_sort(frame, _columns("PnL"), sort)

    assert caught.value.code == "invalid_sort"
    assert caught.value.index is None


def test_unknown_column_is_rejected() -> None:
    frame = pd.DataFrame({"PnL": [1.0]})

    with pytest.raises(QueryRejected) as caught:
        apply_sort(
            frame,
            _columns("PnL"),
            [{"column": "Missing", "direction": "asc"}],
        )

    assert caught.value.code == "invalid_sort"
    assert caught.value.index is None


def test_bad_direction_is_rejected() -> None:
    frame = pd.DataFrame({"PnL": [1.0]})

    with pytest.raises(QueryRejected) as caught:
        apply_sort(
            frame,
            _columns("PnL"),
            [{"column": "PnL", "direction": "up"}],
        )

    assert caught.value.code == "invalid_sort"
    assert caught.value.index is None


def test_leading_keys_sort_before_user_pnl_desc_inside_region() -> None:
    frame = pd.DataFrame(
        {
            "Region": ["UK", "UAE", "UK", "UAE"],
            "PnL": [1.0, 10.0, 8.0, 3.0],
        }
    )

    result = apply_sort(
        frame,
        _columns("Region", "PnL"),
        [{"column": "PnL", "direction": "desc"}],
        leading=[("Region", "asc")],
    )

    assert result["Region"].tolist() == ["UAE", "UAE", "UK", "UK"]
    assert result["PnL"].tolist() == [10.0, 3.0, 8.0, 1.0]


def test_allowed_set_rejects_a_column_outside_the_set() -> None:
    frame = pd.DataFrame({"Region": ["UAE"], "PnL": [1.0], "row_count": [2]})

    with pytest.raises(QueryRejected) as caught:
        apply_sort(
            frame,
            _columns("Region", "PnL"),
            [{"column": "PnL", "direction": "desc"}],
            allowed={"Region", "row_count"},
        )

    assert caught.value.code == "invalid_sort"
    assert caught.value.index is None

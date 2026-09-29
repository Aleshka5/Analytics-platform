from typing import Any

import pandas as pd

from app.domain.descriptive import (
    columns_data,
    dtypes_data,
    missing_data,
    preview_data,
    shape_data,
    summary_data,
)
from app.domain.roles import prepare_table
from app.domain.types import Suggestions


def test_preview_is_first_twenty_rows() -> None:
    frame = pd.DataFrame(
        {
            "n": list(range(25)),
            "when": pd.to_datetime(
                [f"2024-01-{(index % 28) + 1:02d}" for index in range(25)]
            ),
        }
    )

    data = preview_data(frame)

    assert data["row_limit"] == 20
    assert len(data["rows"]) == 20
    assert data["columns"] == ["n", "when"]
    assert data["rows"][0]["n"] == 0
    assert data["rows"][19]["n"] == 19
    assert data["rows"][0]["when"] == "2024-01-01"
    _assert_json_ready(data)


def test_columns_shape_and_dtypes() -> None:
    frame = pd.DataFrame({"only": [f"value-{index}" for index in range(40)]})
    prepared, columns, suggestions = prepare_table(frame)

    described = columns_data(columns, suggestions)
    assert described["suggestions"] == {
        "metric": None,
        "category": None,
        "datetime": None,
    }
    assert described["columns"] == [
        {
            "name": "only",
            "dtype": columns[0].dtype,
            "role": "text",
            "unique_count": 40,
        }
    ]
    assert described["suggestions"]["metric"] is None
    assert shape_data(prepared) == {"row_count": 40, "column_count": 1}
    assert dtypes_data(columns) == {
        "columns": [{"name": "only", "dtype": columns[0].dtype, "role": "text"}]
    }
    _assert_json_ready(described)


def test_missing_pct_is_share_of_rows() -> None:
    frame = pd.DataFrame(
        {
            "score": [1, None, 3, None, 5, 6, 7, 8],
            "region": ["a", "b", "a", "b", "a", "b", "a", "b"],
        }
    )

    data = missing_data(frame)

    assert data["columns"] == [
        {
            "name": "score",
            "missing_count": 2,
            "missing_pct": 25.0,
            "non_null_count": 6,
        },
        {
            "name": "region",
            "missing_count": 0,
            "missing_pct": 0.0,
            "non_null_count": 8,
        },
    ]
    assert type(data["columns"][1]["missing_pct"]) is float
    assert type(data["columns"][0]["missing_count"]) is int
    _assert_json_ready(data)


def test_summary_all_null_metric_and_file_order_tie() -> None:
    frame = pd.DataFrame(
        {
            "score": pd.Series([None, None, None, None], dtype="float64"),
            "region": ["b", "a", "b", "a"],
            "amount": [1, 2, 3, 4],
        }
    )
    prepared, columns, _suggestions = prepare_table(frame)

    data = summary_data(prepared, columns)

    assert data["numeric"][0] == {
        "column": "score",
        "count": 0,
        "mean": None,
        "std": None,
        "min": None,
        "p25": None,
        "p50": None,
        "p75": None,
        "max": None,
    }
    assert data["other"][0]["column"] == "region"
    assert data["other"][0]["role"] == "category"
    assert data["other"][0]["top"] == "b"
    assert data["other"][0]["freq"] == 2
    amount = data["numeric"][1]
    assert amount["count"] == 4
    assert type(amount["count"]) is int
    assert amount["mean"] == 2.5
    assert amount["std"] == pd.Series([1, 2, 3, 4]).std(ddof=1)
    assert amount["min"] == 1.0
    assert amount["p25"] == 1.75
    assert amount["p50"] == 2.5
    assert amount["p75"] == 3.25
    assert amount["max"] == 4.0
    assert type(amount["mean"]) is float
    _assert_json_ready(data)


def test_summary_all_null_other_and_datetime_top() -> None:
    frame = pd.DataFrame(
        {
            "note": pd.Series([None, None], dtype="object"),
            "sold_on": ["2024-03-01", "2024-03-01"],
        }
    )
    prepared, columns, suggestions = prepare_table(frame)

    data = summary_data(prepared, columns)

    assert data["numeric"] == []
    assert data["other"][0] == {
        "column": "note",
        "role": "text",
        "count": 0,
        "unique": 0,
        "top": None,
        "freq": 0,
    }
    assert data["other"][1]["top"] == "2024-03-01"
    assert data["other"][1]["freq"] == 2
    assert data["other"][1]["role"] == "datetime"
    assert type(data["other"][1]["top"]) is str
    assert suggestions == Suggestions(metric=None, category=None, datetime="sold_on")
    _assert_json_ready(data)


def _assert_json_ready(value: Any) -> None:
    if value is None or type(value) in (str, int, float, bool):
        return
    if isinstance(value, list):
        for item in value:
            _assert_json_ready(item)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            assert type(key) is str
            _assert_json_ready(item)
        return
    raise AssertionError(type(value))

from datetime import date, timedelta

import pandas as pd

from app.domain.roles import prepare_table
from app.domain.types import Suggestions


def test_roles_and_suggestions_on_synthetic_frame() -> None:
    row_count = 300
    dates = [
        (date(2024, 1, 1) + timedelta(days=index)).isoformat() for index in range(240)
    ]
    dates += ["not-a-date"] * 60
    frame = pd.DataFrame(
        {
            "year": [2020 + (index % 5) for index in range(row_count)],
            "region": [f"R{index % 7}" for index in range(row_count)],
            "sold_on": dates,
            "amount": list(range(row_count)),
            "client_id": [f"id-{index % 50}" for index in range(row_count)],
            "active": [index % 2 == 0 for index in range(row_count)],
            "booked_on": ["2024-06-01"] * row_count,
        }
    )

    prepared, columns, suggestions = prepare_table(frame)
    by_name = {column.name: column for column in columns}

    assert [column.name for column in columns] == list(frame.columns)
    assert by_name["active"].role == "category"
    assert by_name["year"].role == "metric"
    assert by_name["year"].unique_count == 5
    assert str(prepared["year"].dtype).startswith("int")
    assert by_name["amount"].role == "metric"
    assert by_name["sold_on"].role == "datetime"
    assert str(prepared["sold_on"].dtype) == "datetime64[ns]"
    assert by_name["sold_on"].dtype == "datetime64[ns]"
    assert by_name["sold_on"].unique_count == 240
    assert by_name["client_id"].role == "text"
    assert by_name["client_id"].unique_count == 50
    assert by_name["region"].role == "category"
    assert by_name["region"].unique_count == 7
    assert suggestions == Suggestions(
        metric="year", category="region", datetime="sold_on"
    )
    assert frame["sold_on"].iloc[0] == "2024-01-01"
    assert not pd.api.types.is_datetime64_any_dtype(frame["sold_on"])


def test_suggestions_are_none_when_role_is_absent() -> None:
    frame = pd.DataFrame({"note": [f"note-{index}" for index in range(40)]})

    _, columns, suggestions = prepare_table(frame)

    assert columns[0].role == "text"
    assert suggestions == Suggestions(metric=None, category=None, datetime=None)

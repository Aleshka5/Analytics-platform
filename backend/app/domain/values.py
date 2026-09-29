"""Convert pandas cells into JSON values."""

from datetime import date, datetime
from typing import Any

import pandas as pd


def json_value(value: Any) -> Any:
    if value is None or value is pd.NA:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if isinstance(value, pd.Timestamp):
        return _timestamp(value)
    if isinstance(value, datetime):
        return _timestamp(pd.Timestamp(value))
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bool):
        return value
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        value = value.item()
    if isinstance(value, float):
        return value
    if isinstance(value, int):
        return value
    return value


def row_record(row: pd.Series) -> dict[str, Any]:
    return {str(name): json_value(row[name]) for name in row.index}


def _timestamp(value: pd.Timestamp) -> str:
    if (
        value.hour == 0
        and value.minute == 0
        and value.second == 0
        and value.microsecond == 0
        and value.nanosecond == 0
    ):
        return value.strftime("%Y-%m-%d")
    text = value.isoformat()
    if text.endswith("+00:00"):
        return text[:-6] + "Z"
    return text

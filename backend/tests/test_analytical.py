import pandas as pd
import pytest

from app.domain.analytical import (
    grouping_section,
    insights_section,
    ranking_section,
    timeseries_section,
)
from app.domain.types import ColumnInfo, ColumnRejected, Suggestions


def _info(name: str, role: str) -> ColumnInfo:
    return ColumnInfo(name=name, dtype="object", role=role, unique_count=0)


def _suggestions(
    metric: str | None = None,
    category: str | None = None,
    datetime: str | None = None,
) -> Suggestions:
    return Suggestions(metric=metric, category=category, datetime=datetime)


def test_ranking_top_and_worst_keep_tie_file_order() -> None:
    frame = pd.DataFrame(
        {
            "label": ["a", "b", "c", "d", "e", "f"],
            "qty": [3.0, 10.0, 10.0, 1.0, 2.0, 7.0],
        }
    )
    columns = [_info("label", "text"), _info("qty", "metric")]
    result = ranking_section(frame, columns, _suggestions(metric="qty"), metric="qty")

    assert result.status == "ok"
    assert result.data is not None
    assert result.data["metric"] == "qty"
    assert result.data["higher_is_better"] is True
    assert [item["values"]["label"] for item in result.data["top"]] == ["b", "c", "f", "a", "e"]
    assert [item["rank"] for item in result.data["top"]] == [1, 2, 3, 4, 5]
    assert result.data["top"][0]["values"] == {"label": "b", "qty": 10.0}
    assert [item["values"]["label"] for item in result.data["worst"]] == ["d", "e", "a", "f", "b"]
    assert [item["rank"] for item in result.data["worst"]] == [1, 2, 3, 4, 5]


def test_ranking_all_null_metric_is_unavailable() -> None:
    frame = pd.DataFrame({"qty": [None, None]})
    result = ranking_section(
        frame,
        [_info("qty", "metric")],
        _suggestions(metric="qty"),
        metric="qty",
    )

    assert result.status == "unavailable"
    assert result.code == "metric_all_null"


def test_ranking_omitted_metric_without_suggestion_is_unavailable() -> None:
    frame = pd.DataFrame({"qty": [1.0, 2.0]})
    result = ranking_section(frame, [_info("qty", "metric")], _suggestions(), metric=None)

    assert result.status == "unavailable"
    assert result.code == "no_numeric_column"


def test_ranking_illegal_metric_raises() -> None:
    frame = pd.DataFrame({"label": ["a"], "qty": [1.0]})
    columns = [_info("label", "text"), _info("qty", "metric")]

    with pytest.raises(ColumnRejected):
        ranking_section(frame, columns, _suggestions(), metric="missing")
    with pytest.raises(ColumnRejected):
        ranking_section(frame, columns, _suggestions(metric="qty"), metric="label")


def test_grouping_orders_by_sum_and_keeps_null_category() -> None:
    frame = pd.DataFrame(
        {
            "region": ["b", "a", "b", "c", None, "a"],
            "qty": [10.0, 5.0, 5.0, 15.0, 100.0, 10.0],
        }
    )
    columns = [_info("region", "category"), _info("qty", "metric")]
    result = grouping_section(
        frame,
        columns,
        _suggestions(category="region", metric="qty"),
        category=None,
        metric=None,
    )

    assert result.status == "ok"
    assert result.data is not None
    assert result.data["category"] == "region"
    assert result.data["metric"] == "qty"
    assert result.data["truncated"] is False
    assert result.data["groups"] == [
        {"value": None, "count": 1, "sum": 100.0, "mean": 100.0},
        {"value": "b", "count": 2, "sum": 15.0, "mean": 7.5},
        {"value": "a", "count": 2, "sum": 15.0, "mean": 7.5},
        {"value": "c", "count": 1, "sum": 15.0, "mean": 15.0},
    ]


def test_grouping_text_column_only_when_named() -> None:
    frame = pd.DataFrame({"note": ["x", "x", "y"], "qty": [1.0, 2.0, 3.0]})
    columns = [_info("note", "text"), _info("qty", "metric")]

    named = grouping_section(
        frame,
        columns,
        _suggestions(),
        category="note",
        metric="qty",
    )
    omitted = grouping_section(
        frame,
        columns,
        _suggestions(),
        category=None,
        metric=None,
    )

    assert named.status == "ok"
    assert named.data is not None
    assert [group["value"] for group in named.data["groups"]] == ["x", "y"]
    assert omitted.status == "unavailable"
    assert omitted.code == "no_category_column"


def test_grouping_truncates_after_100_groups() -> None:
    frame = pd.DataFrame(
        {
            "region": [f"c{index:03d}" for index in range(101)],
            "qty": [float(index) for index in range(101)],
        }
    )
    result = grouping_section(
        frame,
        [_info("region", "category"), _info("qty", "metric")],
        _suggestions(),
        category="region",
        metric="qty",
    )

    assert result.status == "ok"
    assert result.data is not None
    assert result.data["truncated"] is True
    assert len(result.data["groups"]) == 100
    assert result.data["groups"][0]["value"] == "c100"
    assert result.data["groups"][-1]["value"] == "c001"


def test_timeseries_89_days_uses_day_grain() -> None:
    start = pd.Timestamp("2025-01-01")
    frame = pd.DataFrame(
        {
            "when": [start, start, start + pd.Timedelta(days=89)],
            "qty": [1.0, 4.0, 2.0],
        }
    )
    result = timeseries_section(
        frame,
        [_info("when", "datetime"), _info("qty", "metric")],
        _suggestions(datetime="when", metric="qty"),
        date_column=None,
        metric=None,
    )

    assert result.status == "ok"
    assert result.data == {
        "date_column": "when",
        "metric": "qty",
        "grain": "day",
        "points": [
            {"bucket": "2025-01-01", "sum": 5.0},
            {"bucket": "2025-03-31", "sum": 2.0},
        ],
    }


def test_timeseries_91_days_uses_month_buckets() -> None:
    start = pd.Timestamp("2025-01-01")
    frame = pd.DataFrame(
        {
            "when": [start, start + pd.Timedelta(days=19), start + pd.Timedelta(days=91)],
            "qty": [1.0, 4.0, 2.0],
        }
    )
    result = timeseries_section(
        frame,
        [_info("when", "datetime"), _info("qty", "metric")],
        _suggestions(),
        date_column="when",
        metric="qty",
    )

    assert result.status == "ok"
    assert result.data is not None
    assert result.data["grain"] == "month"
    assert result.data["points"] == [
        {"bucket": "2025-01-01", "sum": 5.0},
        {"bucket": "2025-04-01", "sum": 2.0},
    ]


def test_timeseries_all_null_dates_have_no_dated_rows() -> None:
    frame = pd.DataFrame({"when": [pd.NaT, pd.NaT], "qty": [1.0, 2.0]})
    result = timeseries_section(
        frame,
        [_info("when", "datetime"), _info("qty", "metric")],
        _suggestions(datetime="when", metric="qty"),
        date_column=None,
        metric="qty",
    )

    assert result.status == "unavailable"
    assert result.code == "no_dated_rows"


def test_timeseries_without_datetime_suggestion_is_unavailable() -> None:
    frame = pd.DataFrame({"when": [pd.Timestamp("2025-01-01")], "qty": [1.0]})
    result = timeseries_section(
        frame,
        [_info("when", "datetime"), _info("qty", "metric")],
        _suggestions(metric="qty"),
        date_column=None,
        metric=None,
    )

    assert result.status == "unavailable"
    assert result.code == "no_datetime_column"


def test_insights_half_period_direction_and_text() -> None:
    frame = pd.DataFrame(
        {
            "when": pd.to_datetime(["2025-01-01", "2025-01-01", "2025-01-11", "2025-01-11"]),
            "steady": [0.0, 0.0, 5.0, 5.0],
            "alpha": [100.0, 0.0, 40.0, 10.0],
            "beta": [10.0, 0.0, 20.0, 10.0],
        }
    )
    columns = [
        _info("when", "datetime"),
        _info("steady", "metric"),
        _info("alpha", "metric"),
        _info("beta", "metric"),
    ]
    suggestions = _suggestions(datetime="when")

    english = insights_section(frame, columns, suggestions, date_column=None, lang="en")
    russian = insights_section(frame, columns, suggestions, date_column="when", lang="ru")

    assert english.status == "ok"
    assert english.data is not None
    assert english.data["kind"] == "half_period"
    assert english.data["period_start"] == "2025-01-01"
    assert english.data["period_end"] == "2025-01-11"
    assert [item["column"] for item in english.data["items"]] == ["beta", "alpha"]
    assert english.data["items"][0]["direction"] == "up"
    assert english.data["items"][0]["change_pct"] == 200.0
    assert english.data["items"][0]["text"] == (
        "beta increased by 200.0% between the first and second half "
        "of the period (2025-01-01–2025-01-11)."
    )
    assert english.data["items"][1]["direction"] == "down"
    assert english.data["items"][1]["change_pct"] == -50.0

    assert russian.status == "ok"
    assert russian.data is not None
    beta = russian.data["items"][0]["text"]
    alpha = russian.data["items"][1]["text"]
    assert "beta" in beta
    assert "200,0" in beta
    assert "вырос" in beta
    assert "alpha" in alpha
    assert "50,0" in alpha
    assert "снизился" in alpha


def test_insights_without_inputs_is_unavailable() -> None:
    frame = pd.DataFrame({"qty": [1.0, 2.0, 3.0]})
    result = insights_section(
        frame,
        [_info("qty", "metric")],
        _suggestions(),
        date_column=None,
        lang="en",
    )

    assert result.status == "unavailable"
    assert result.code == "no_insight_inputs"


def test_insights_distribution_is_missing_share_then_top_category() -> None:
    frame = pd.DataFrame(
        {
            "full": [1, 2, 3, 4],
            "spotty": [1, None, None, 1],
            "region": ["east", "east", "west", None],
        }
    )
    columns = [
        _info("full", "metric"),
        _info("spotty", "metric"),
        _info("region", "category"),
    ]
    result = insights_section(
        frame,
        columns,
        _suggestions(category="region"),
        date_column=None,
        lang="en",
    )

    assert result.status == "ok"
    assert result.data is not None
    assert result.data["kind"] == "distribution"
    assert [item["code"] for item in result.data["items"]] == [
        "missing_share",
        "missing_share",
        "top_category",
    ]
    assert [item["column"] for item in result.data["items"]] == ["spotty", "region", "region"]
    assert result.data["items"][0]["text"] == "spotty is empty in 50.0% of rows."
    assert result.data["items"][2]["text"] == (
        "east is the most frequent value in region (50.0% of rows)."
    )

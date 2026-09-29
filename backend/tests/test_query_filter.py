import pandas as pd
import pytest

from app.domain.query_errors import QueryRejected
from app.domain.query_filter import apply_filter
from app.domain.types import ColumnInfo, Role


def _column(name: str, role: Role) -> ColumnInfo:
    return ColumnInfo(name=name, dtype="object", role=role, unique_count=0)


def _rows() -> tuple[pd.DataFrame, list[ColumnInfo]]:
    frame = pd.DataFrame(
        {
            "region": ["UAE", "UAE", "UK"],
            "pnl": [1.0, -1.0, 5.0],
        },
        index=[5, 6, 7],
    )
    columns = [_column("region", "category"), _column("pnl", "metric")]
    return frame, columns


def test_and_requires_every_condition() -> None:
    frame, columns = _rows()
    original = frame.copy()
    result = apply_filter(
        frame,
        columns,
        "and",
        [
            {"column": "region", "operator": "eq", "value": "UAE"},
            {"column": "pnl", "operator": "gt", "value": 0},
        ],
    )

    assert result["region"].tolist() == ["UAE"]
    assert result["pnl"].tolist() == [1.0]
    assert result.index.tolist() == [5]
    pd.testing.assert_frame_equal(frame, original)
    result.iloc[0, result.columns.get_loc("region")] = "CHANGED"
    assert frame.loc[5, "region"] == "UAE"


def test_missing_combinator_means_and() -> None:
    frame, columns = _rows()
    result = apply_filter(
        frame,
        columns,
        None,
        [
            {"column": "region", "operator": "eq", "value": "UAE"},
            {"column": "pnl", "operator": "gt", "value": 0},
        ],
    )

    assert result.index.tolist() == [5]


def test_or_matches_either_condition() -> None:
    frame, columns = _rows()
    result = apply_filter(
        frame,
        columns,
        "or",
        [
            {"column": "region", "operator": "eq", "value": "UK"},
            {"column": "pnl", "operator": "lt", "value": 0},
        ],
    )

    assert result.index.tolist() == [6, 7]
    assert result["region"].tolist() == ["UAE", "UK"]


@pytest.mark.parametrize("combinator", [None, "and", "or"])
@pytest.mark.parametrize("conditions", [None, []])
def test_empty_conditions_return_every_row(
    combinator: str | None, conditions: list[dict] | None
) -> None:
    frame, columns = _rows()
    result = apply_filter(frame, columns, combinator, conditions)

    assert result is not frame
    pd.testing.assert_frame_equal(result, frame)


def test_contains_on_metric_raises_invalid_filter_at_condition_index() -> None:
    frame, columns = _rows()
    with pytest.raises(QueryRejected) as raised:
        apply_filter(
            frame,
            columns,
            "and",
            [
                {"column": "region", "operator": "eq", "value": "UAE"},
                {"column": "pnl", "operator": "contains", "value": "1"},
            ],
        )

    assert raised.value.code == "invalid_filter"
    assert raised.value.index == 1
    assert str(raised.value) == "invalid_filter:1"


def test_unknown_column_raises_invalid_filter_at_condition_index() -> None:
    frame, columns = _rows()
    with pytest.raises(QueryRejected) as raised:
        apply_filter(
            frame,
            columns,
            "and",
            [
                {"column": "region", "operator": "eq", "value": "UAE"},
                {"column": "Country", "operator": "eq", "value": "UAE"},
            ],
        )

    assert raised.value.code == "invalid_filter"
    assert raised.value.index == 1


def test_filter_matching_nothing_returns_empty_frame_with_same_columns() -> None:
    frame, columns = _rows()
    result = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "region", "operator": "eq", "value": "US"}],
    )

    assert result is not frame
    assert len(result) == 0
    assert result.columns.tolist() == frame.columns.tolist()


def test_empty_and_not_empty() -> None:
    frame = pd.DataFrame(
        {
            "label": ["", pd.NA, None, float("nan"), "x"],
            "when": [
                pd.Timestamp("2025-01-01"),
                pd.NaT,
                pd.Timestamp("2025-01-02"),
                pd.NaT,
                pd.Timestamp("2025-01-03"),
            ],
        }
    )
    columns = [_column("label", "text"), _column("when", "datetime")]

    blanks = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "label", "operator": "empty"}],
    )
    present = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "label", "operator": "not_empty", "value": "ignored"}],
    )
    missing_dates = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "when", "operator": "empty"}],
    )

    assert blanks.index.tolist() == [1, 2, 3]
    assert present["label"].tolist() == ["", "x"]
    assert missing_dates.index.tolist() == [1, 3]


def test_between_on_metric_is_inclusive() -> None:
    frame = pd.DataFrame({"pnl": [0, 1, 2, 3, None]})
    columns = [_column("pnl", "metric")]
    result = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "pnl", "operator": "between", "value": [1, 3]}],
    )

    assert result["pnl"].tolist() == [1, 2, 3]
    assert result.index.tolist() == [1, 2, 3]


def test_metric_eq_treats_one_and_one_point_zero_as_equal() -> None:
    frame = pd.DataFrame({"pnl": [1, 2, None]})
    columns = [_column("pnl", "metric")]
    result = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "pnl", "operator": "eq", "value": 1.0}],
    )

    assert result.index.tolist() == [0]


def test_datetime_eq_date_only_matches_midnight() -> None:
    frame = pd.DataFrame(
        {
            "when": pd.to_datetime(
                ["2025-01-01", "2025-01-01 00:00:01", "2025-01-02", None],
                format="ISO8601",
            )
        }
    )
    columns = [_column("when", "datetime")]
    equal = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "when", "operator": "eq", "value": "2025-01-01"}],
    )
    later = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "when", "operator": "gt", "value": "2025-01-01"}],
    )
    span = apply_filter(
        frame,
        columns,
        "and",
        [
            {
                "column": "when",
                "operator": "between",
                "value": ["2025-01-01", "2025-01-01 00:00:01"],
            }
        ],
    )

    zoned = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "when", "operator": "eq", "value": "2025-01-01T00:00:00Z"}],
    )

    assert equal.index.tolist() == [0]
    assert zoned.index.tolist() == [0]
    assert later.index.tolist() == [1, 2]
    assert span.index.tolist() == [0, 1]

    strings = pd.DataFrame({"when": ["2025-01-01", "2025-01-01 00:00:01"]})
    parsed = apply_filter(
        strings,
        columns,
        "and",
        [{"column": "when", "operator": "eq", "value": "2025-01-01"}],
    )
    assert parsed.index.tolist() == [0]


def test_contains_is_case_insensitive_and_skips_missing() -> None:
    frame = pd.DataFrame({"region": ["UAE", "uk", None, "US"]})
    columns = [_column("region", "category")]
    result = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "region", "operator": "contains", "value": "u"}],
    )

    assert result["region"].tolist() == ["UAE", "uk", "US"]


def test_in_uses_eq_rules_and_empty_list_matches_nothing() -> None:
    frame = pd.DataFrame({"region": ["UAE", "UK", None], "pnl": [1, 2, 3]})
    columns = [_column("region", "category"), _column("pnl", "metric")]
    regions = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "region", "operator": "in", "value": ["UK", "US"]}],
    )
    numbers = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "pnl", "operator": "in", "value": [1.0]}],
    )
    empty = apply_filter(
        frame,
        columns,
        "or",
        [{"column": "region", "operator": "in", "value": []}],
    )

    assert regions["region"].tolist() == ["UK"]
    assert numbers.index.tolist() == [0]
    assert len(empty) == 0
    assert empty.columns.tolist() == frame.columns.tolist()


def test_bad_combinator_raises_without_condition_index() -> None:
    frame, columns = _rows()
    with pytest.raises(QueryRejected) as raised:
        apply_filter(
            frame,
            columns,
            "xor",
            [{"column": "region", "operator": "eq", "value": "UAE"}],
        )

    assert raised.value.code == "invalid_filter"
    assert raised.value.index is None


@pytest.mark.parametrize(
    ("role", "operator", "value"),
    [
        ("text", "gt", 1),
        ("category", "between", [1, 2]),
        ("datetime", "contains", "2025-01-01"),
    ],
)
def test_operator_illegal_for_role(role: Role, operator: str, value: object) -> None:
    frame = pd.DataFrame({"value": ["a", "b"]})
    columns = [_column("value", role)]
    with pytest.raises(QueryRejected) as raised:
        apply_filter(
            frame,
            columns,
            "and",
            [{"column": "value", "operator": operator, "value": value}],
        )

    assert raised.value.code == "invalid_filter"
    assert raised.value.index == 0


def test_bool_equals_a_category_and_is_rejected_for_a_metric() -> None:
    frame = pd.DataFrame({"active": [True, False, None], "pnl": [1.0, 2.0, 3.0]})
    columns = [_column("active", "category"), _column("pnl", "metric")]

    matched = apply_filter(
        frame,
        columns,
        "and",
        [{"column": "active", "operator": "eq", "value": True}],
    )
    assert matched["active"].tolist() == [True]

    with pytest.raises(QueryRejected) as raised:
        apply_filter(
            frame,
            columns,
            "and",
            [{"column": "pnl", "operator": "eq", "value": True}],
        )
    assert raised.value.code == "invalid_filter"
    assert raised.value.index == 0


def test_wrong_value_shape_raises_invalid_filter() -> None:
    frame, columns = _rows()
    cases = [
        {"column": "pnl", "operator": "gt", "value": True},
        {"column": "pnl", "operator": "eq", "value": "1"},
        {"column": "pnl", "operator": "between", "value": [3, 1]},
        {"column": "region", "operator": "eq", "value": ["UAE"]},
        {"column": "pnl", "operator": "in", "value": "1"},
    ]
    for case in cases:
        with pytest.raises(QueryRejected) as raised:
            apply_filter(frame, columns, "and", [case])
        assert raised.value.code == "invalid_filter"
        assert raised.value.index == 0


def test_invalid_iso_date_raises_invalid_filter() -> None:
    frame = pd.DataFrame({"when": pd.to_datetime(["2025-01-01"])})
    columns = [_column("when", "datetime")]
    with pytest.raises(QueryRejected) as raised:
        apply_filter(
            frame,
            columns,
            "and",
            [{"column": "when", "operator": "gte", "value": "yesterday"}],
        )

    assert raised.value.code == "invalid_filter"
    assert raised.value.index == 0

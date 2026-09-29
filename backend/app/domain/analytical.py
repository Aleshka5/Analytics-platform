"""Calculated report blocks. Pure functions over a prepared frame."""

from typing import Any

import pandas as pd

from app.domain.messages import half_period_text, missing_share_text, top_category_text
from app.domain.types import ColumnInfo, ColumnRejected, SectionResult, Suggestions
from app.domain.values import json_value, row_record

_RANK_LIMIT = 5
_GROUP_LIMIT = 100
_INSIGHT_LIMIT = 5
_MISSING_LIMIT = 3
_MONTH_AFTER_DAYS = 90
_NULL = object()


def ranking_section(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    suggestions: Suggestions,
    metric: str | None,
) -> SectionResult:
    name = _metric_name(columns, suggestions, metric)
    if isinstance(name, SectionResult):
        return name
    present = frame.loc[frame[name].notna()]
    if present.empty:
        return _unavailable("metric_all_null")
    top = present.sort_values(name, ascending=False, kind="stable").head(_RANK_LIMIT)
    worst = present.sort_values(name, ascending=True, kind="stable").head(_RANK_LIMIT)
    return _ok(
        {
            "metric": name,
            "higher_is_better": True,
            "top": _ranked(top),
            "worst": _ranked(worst),
        }
    )


def grouping_section(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    suggestions: Suggestions,
    category: str | None,
    metric: str | None,
) -> SectionResult:
    if category is not None:
        _require(columns, category, {"category", "text"})
    if metric is not None:
        _require(columns, metric, {"metric"})
    category_name = _category_name(columns, suggestions, category)
    if isinstance(category_name, SectionResult):
        return category_name
    metric_name = _metric_name(columns, suggestions, metric)
    if isinstance(metric_name, SectionResult):
        return metric_name

    groups: dict[Any, dict[str, Any]] = {}
    order: list[Any] = []
    for raw, metric_value in zip(
        frame[category_name].tolist(),
        frame[metric_name].tolist(),
        strict=True,
    ):
        key: Any = _NULL if _is_null(raw) else raw
        bucket = groups.get(key)
        if bucket is None:
            bucket = {
                "value": None if key is _NULL else json_value(raw),
                "count": 0,
                "total": 0.0,
                "seen": 0,
            }
            groups[key] = bucket
            order.append(key)
        bucket["count"] += 1
        if not _is_null(metric_value):
            bucket["total"] += float(metric_value)
            bucket["seen"] += 1

    ranked = sorted(order, key=lambda key: groups[key]["total"], reverse=True)
    payload = []
    for key in ranked[:_GROUP_LIMIT]:
        bucket = groups[key]
        seen = bucket["seen"]
        total = float(bucket["total"])
        mean = total / seen if seen else 0.0
        payload.append(
            {
                "value": bucket["value"],
                "count": bucket["count"],
                "sum": total,
                "mean": float(mean),
            }
        )
    return _ok(
        {
            "category": category_name,
            "metric": metric_name,
            "truncated": len(ranked) > _GROUP_LIMIT,
            "groups": payload,
        }
    )


def timeseries_section(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    suggestions: Suggestions,
    date_column: str | None,
    metric: str | None,
) -> SectionResult:
    date_name = _explicit_datetime(columns, date_column)
    if metric is not None:
        _require(columns, metric, {"metric"})
    if date_name is None:
        if suggestions.datetime is None:
            return _unavailable("no_datetime_column")
        date_name = suggestions.datetime
    metric_name = _metric_name(columns, suggestions, metric)
    if isinstance(metric_name, SectionResult):
        return metric_name

    dates = frame[date_name]
    values = frame[metric_name]
    kept = [
        (pd.Timestamp(stamp), float(value))
        for stamp, value in zip(dates.tolist(), values.tolist(), strict=True)
        if not _is_null(stamp) and not _is_null(value)
    ]
    if not kept:
        return _unavailable("no_dated_rows")

    earliest = min(stamp for stamp, _ in kept)
    latest = max(stamp for stamp, _ in kept)
    grain = "month" if latest - earliest > pd.Timedelta(days=_MONTH_AFTER_DAYS) else "day"
    totals: dict[pd.Timestamp, float] = {}
    for stamp, value in kept:
        start = _bucket_start(stamp, grain)
        totals[start] = totals.get(start, 0.0) + value
    points = [
        {"bucket": start.strftime("%Y-%m-%d"), "sum": totals[start]}
        for start in sorted(totals)
    ]
    return _ok(
        {
            "date_column": date_name,
            "metric": metric_name,
            "grain": grain,
            "points": points,
        }
    )


def insights_section(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    suggestions: Suggestions,
    date_column: str | None,
    lang: str,
) -> SectionResult:
    date_name = _explicit_datetime(columns, date_column)
    if date_name is None and suggestions.datetime is not None:
        suggested = _find(columns, suggestions.datetime)
        if suggested is not None and suggested.role == "datetime":
            date_name = suggested.name

    if date_name is not None:
        half = _half_period(frame, columns, date_name, lang)
        if half is not None:
            return half

    items = _distribution(frame, columns, suggestions, lang)
    if not items:
        return _unavailable("no_insight_inputs")
    return _ok({"kind": "distribution", "items": items})


def _metric_name(
    columns: list[ColumnInfo],
    suggestions: Suggestions,
    metric: str | None,
) -> str | SectionResult:
    if metric is not None:
        _require(columns, metric, {"metric"})
        return metric
    if suggestions.metric is None:
        return _unavailable("no_numeric_column")
    return suggestions.metric


def _category_name(
    columns: list[ColumnInfo],
    suggestions: Suggestions,
    category: str | None,
) -> str | SectionResult:
    if category is not None:
        _require(columns, category, {"category", "text"})
        return category
    if suggestions.category is None:
        return _unavailable("no_category_column")
    return suggestions.category


def _explicit_datetime(columns: list[ColumnInfo], date_column: str | None) -> str | None:
    if date_column is None:
        return None
    _require(columns, date_column, {"datetime"})
    return date_column


def _require(columns: list[ColumnInfo], name: str, roles: set[str]) -> None:
    column = _find(columns, name)
    if column is None or column.role not in roles:
        raise ColumnRejected


def _find(columns: list[ColumnInfo], name: str) -> ColumnInfo | None:
    for column in columns:
        if column.name == name:
            return column
    return None


def _ranked(rows: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {"rank": rank, "values": row_record(row)}
        for rank, (_, row) in enumerate(rows.iterrows(), start=1)
    ]


def _half_period(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    date_name: str,
    lang: str,
) -> SectionResult | None:
    dates = frame[date_name]
    valid = [pd.Timestamp(value) for value in dates.tolist() if not _is_null(value)]
    if not valid:
        return None
    earliest = min(valid)
    latest = max(valid)
    split = earliest + (latest - earliest) / 2
    period_start = earliest.strftime("%Y-%m-%d")
    period_end = latest.strftime("%Y-%m-%d")
    first_half = []
    second_half = []
    for value in dates.tolist():
        if _is_null(value):
            first_half.append(False)
            second_half.append(False)
            continue
        stamp = pd.Timestamp(value)
        first_half.append(stamp < split)
        second_half.append(stamp >= split)

    ranked: list[tuple[float, int, dict[str, Any]]] = []
    for position, column in enumerate(columns):
        if column.role != "metric":
            continue
        first_sum = _masked_sum(frame[column.name], first_half)
        if first_sum == 0:
            continue
        second_sum = _masked_sum(frame[column.name], second_half)
        change_pct = round((second_sum - first_sum) / abs(first_sum) * 100, 2)
        if change_pct == 0:
            change_pct = 0.0
        direction = "down" if change_pct < 0 else "up"
        ranked.append(
            (
                abs(change_pct),
                position,
                {
                    "code": "half_period_change",
                    "column": column.name,
                    "direction": direction,
                    "change_pct": change_pct,
                    "text": half_period_text(
                        column.name,
                        direction,
                        change_pct,
                        period_start,
                        period_end,
                        lang,
                    ),
                },
            )
        )
    if not ranked:
        return None
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return _ok(
        {
            "kind": "half_period",
            "period_start": period_start,
            "period_end": period_end,
            "items": [item for _, _, item in ranked[:_INSIGHT_LIMIT]],
        }
    )


def _distribution(
    frame: pd.DataFrame,
    columns: list[ColumnInfo],
    suggestions: Suggestions,
    lang: str,
) -> list[dict[str, Any]]:
    row_count = len(frame)
    if row_count == 0:
        return []
    scored: list[tuple[float, int, str]] = []
    for position, column in enumerate(columns):
        missing = sum(1 for value in frame[column.name].tolist() if _is_null(value))
        if missing == 0:
            continue
        scored.append((missing / row_count * 100, position, column.name))
    scored.sort(key=lambda item: (-item[0], item[1]))

    items: list[dict[str, Any]] = []
    for missing_pct, _, name in scored[:_MISSING_LIMIT]:
        items.append(
            {
                "code": "missing_share",
                "column": name,
                "text": missing_share_text(name, missing_pct, lang),
            }
        )
    if len(items) >= _INSIGHT_LIMIT or suggestions.category is None:
        return items
    top = _top_category(frame, suggestions.category, row_count)
    if top is None:
        return items
    value, share_pct = top
    items.append(
        {
            "code": "top_category",
            "column": suggestions.category,
            "text": top_category_text(suggestions.category, value, share_pct, lang),
        }
    )
    return items


def _top_category(
    frame: pd.DataFrame,
    category: str,
    row_count: int,
) -> tuple[str, float] | None:
    if category not in frame.columns:
        return None
    counts: dict[Any, int] = {}
    order: list[Any] = []
    labels: dict[Any, str] = {}
    for raw in frame[category].tolist():
        if _is_null(raw):
            continue
        shown = json_value(raw)
        key = shown if isinstance(shown, (str, int, float, bool)) or shown is None else str(shown)
        if key not in counts:
            counts[key] = 0
            order.append(key)
            labels[key] = shown if isinstance(shown, str) else str(shown)
        counts[key] += 1
    if not order:
        return None
    best = max(order, key=lambda key: counts[key])
    return labels[best], counts[best] / row_count * 100


def _masked_sum(series: pd.Series, keep: list[bool]) -> float:
    total = 0.0
    for value, included in zip(series.tolist(), keep, strict=True):
        if included and not _is_null(value):
            total += float(value)
    return total


def _bucket_start(value: pd.Timestamp, grain: str) -> pd.Timestamp:
    if grain == "month":
        return pd.Timestamp(year=value.year, month=value.month, day=1)
    return pd.Timestamp(year=value.year, month=value.month, day=value.day)


def _is_null(value: Any) -> bool:
    if value is None or value is pd.NA:
        return True
    try:
        return bool(pd.isna(value))
    except TypeError:
        return False


def _ok(data: dict[str, Any]) -> SectionResult:
    return SectionResult(status="ok", data=data)


def _unavailable(code: str) -> SectionResult:
    return SectionResult(status="unavailable", code=code)

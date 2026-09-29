import io
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.domain.messages import query_error_message
from app.domain.values import json_value
from app.infrastructure.readers import read_table
from app.infrastructure.store import DatasetStore, set_store
from app.main import app

client = TestClient(app)


def _sample_workbook() -> Path:
    container = Path("/data/global_brokerage_dataset.xlsx")
    if container.exists():
        return container
    return Path(__file__).resolve().parents[2] / "data" / "global_brokerage_dataset.xlsx"


class _Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture(autouse=True)
def clock():
    holder = _Clock(datetime.now(timezone.utc).replace(microsecond=0))
    set_store(DatasetStore(ttl=timedelta(minutes=60), clock=holder))
    yield holder
    set_store(None)


def _rows(dataset_id: str, body: dict | None = None, **kwargs):
    return client.post(
        f"/api/v1/datasets/{dataset_id}/rows",
        json={} if body is None else body,
        **kwargs,
    )


def _upload_sample() -> tuple[str, pd.DataFrame]:
    workbook = _sample_workbook()
    content = workbook.read_bytes()
    response = client.post(
        "/api/v1/datasets",
        files={"file": (workbook.name, content)},
    )
    assert response.status_code == 201
    created = response.json()
    assert created["status"] == "ready"
    frame = read_table(content, workbook.name, created["sheet"])
    return created["dataset_id"], frame


def _region_label(value: object) -> object:
    return json_value(value)


def _spans_fit(spans: list[dict], row_count: int) -> None:
    for span in spans:
        start = span["start_row"]
        length = span["length"]
        assert 0 <= start < row_count
        assert start + length <= row_count


def test_query_error_message_uses_the_condition_index_and_falls_back() -> None:
    assert query_error_message("invalid_filter", "en", 0) == "Condition 0 is invalid."
    assert query_error_message("invalid_filter", "ru", 1) == "Условие 1 некорректно."
    assert query_error_message("invalid_filter", "en") == "The filter is invalid."
    assert query_error_message("invalid_filter", "ru") == "Фильтр некорректен."
    assert query_error_message("invalid_sort", "en") == "The sort is invalid."
    assert query_error_message("invalid_sort", "ru") == "Сортировка некорректна."
    assert query_error_message("invalid_group", "en") == "The grouping is invalid."
    assert query_error_message("invalid_group", "ru") == "Группировка некорректна."
    assert query_error_message("invalid_page", "de") == "The page is invalid."
    assert query_error_message("invalid_page", "ru") == "Страница некорректна."


def test_unknown_dataset_is_not_found() -> None:
    response = _rows(str(uuid.uuid4()), {})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "dataset_not_found"


def test_sheet_required_before_rows() -> None:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame({"n": [1, 2]}).to_excel(writer, sheet_name="Trades", index=False)
        pd.DataFrame({"n": [3]}).to_excel(writer, sheet_name="Clients", index=False)
    uploaded = client.post(
        "/api/v1/datasets",
        files={"file": ("book.xlsx", buffer.getvalue())},
    )
    assert uploaded.status_code == 201
    dataset_id = uploaded.json()["dataset_id"]

    response = _rows(dataset_id, {})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "sheet_required"


def test_and_filter_keeps_positive_pnl_in_uae_or_uk() -> None:
    dataset_id, frame = _upload_sample()
    response = _rows(
        dataset_id,
        {
            "filter": {
                "combinator": "and",
                "conditions": [
                    {"column": "Region", "operator": "in", "value": ["UAE", "UK"]},
                    {"column": "PnL", "operator": "gt", "value": 0},
                ],
            },
            "page": 1,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "status" not in body
    assert body["page"] == 1
    assert body["page_size"] == 100
    rows = body["rows"]
    assert len(rows) <= 100
    if body["total_rows"] > 100:
        assert len(rows) == 100
    for row in rows:
        assert row["Region"] in {"UAE", "UK"}
        assert row["PnL"] is not None
        assert row["PnL"] > 0

    labels = frame["Region"].map(_region_label)
    pnl = pd.to_numeric(frame["PnL"], errors="coerce")
    expected = int((labels.isin(["UAE", "UK"]) & (pnl > 0)).sum())
    assert body["total_rows"] == expected


def test_or_filter_matches_either_region() -> None:
    dataset_id, frame = _upload_sample()
    query = {
        "filter": {
            "combinator": "or",
            "conditions": [
                {"column": "Region", "operator": "eq", "value": "UAE"},
                {"column": "Region", "operator": "eq", "value": "UK"},
            ],
        }
    }
    response = _rows(dataset_id, query)
    assert response.status_code == 200
    body = response.json()
    labels = frame["Region"].map(_region_label)
    uae = int((labels == "UAE").sum())
    uk = int((labels == "UK").sum())
    assert uae > 0
    assert uk > 0
    assert body["total_rows"] == uae + uk

    seen: set[object] = set()
    for page in range(1, body["total_pages"] + 1):
        if page == 1:
            page_body = body
        else:
            page_body = _rows(dataset_id, {**query, "page": page}).json()
        for row in page_body["rows"]:
            seen.add(row["Region"])
    assert seen == {"UAE", "UK"}


def test_three_sort_keys_are_accepted_and_a_fourth_is_rejected() -> None:
    dataset_id, _frame = _upload_sample()
    accepted = _rows(
        dataset_id,
        {
            "sort": [
                {"column": "Region", "direction": "asc"},
                {"column": "PnL", "direction": "desc"},
                {"column": "Quantity", "direction": "asc"},
            ]
        },
    )
    assert accepted.status_code == 200
    assert accepted.json()["page_size"] == 100

    rejected = _rows(
        dataset_id,
        {
            "sort": [
                {"column": "Region", "direction": "asc"},
                {"column": "PnL", "direction": "desc"},
                {"column": "Quantity", "direction": "asc"},
                {"column": "Transaction_Date", "direction": "desc"},
            ]
        },
    )
    assert rejected.status_code == 422
    assert rejected.json()["error"] == {
        "code": "invalid_sort",
        "message": "The sort is invalid.",
    }


def test_rowspan_orders_region_and_keeps_spans_inside_the_page() -> None:
    dataset_id, _frame = _upload_sample()
    group = {"mode": "rowspan", "columns": ["Region"]}
    first = _rows(dataset_id, {"group": group, "page": 1})
    assert first.status_code == 200
    page1 = first.json()
    rows = page1["rows"]
    assert page1["group"] == {"mode": "rowspan", "columns": ["Region"]}
    assert page1["page_size"] == 100
    assert len(rows) == 100
    values = [row["Region"] for row in rows]
    head = [value for value in values if value is not None]
    tail = values[len(head) :]
    assert all(value is None for value in tail)
    assert head == sorted(head)
    _spans_fit(page1["spans"], len(rows))
    assert any(span["length"] >= 2 for span in page1["spans"])

    second = _rows(dataset_id, {"group": group, "page": 2})
    assert second.status_code == 200
    page2 = second.json()
    _spans_fit(page2["spans"], len(page2["rows"]))
    assert all(span["start_row"] < len(page2["rows"]) for span in page2["spans"])


def test_rowspan_group_restarts_at_the_top_of_the_next_page() -> None:
    dataset_id, frame = _upload_sample()
    group = {"mode": "rowspan", "columns": ["Region"]}
    page1 = _rows(dataset_id, {"group": group, "page": 1}).json()
    rows = page1["rows"]
    region = rows[-1]["Region"]
    on_page = 0
    for value in reversed(rows):
        if value["Region"] != region:
            break
        on_page += 1
    full = sum(1 for value in frame["Region"] if _region_label(value) == region)
    assert full > on_page

    page2 = _rows(dataset_id, {"group": group, "page": 2}).json()
    next_rows = page2["rows"]
    assert next_rows[0]["Region"] == region
    run = 0
    for row in next_rows:
        if row["Region"] != region:
            break
        run += 1
    assert run >= 1
    if run >= 2:
        opening = [
            span
            for span in page2["spans"]
            if span["column"] == "Region" and span["start_row"] == 0
        ]
        assert opening
        assert opening[0]["start_row"] == 0
        assert opening[0]["length"] >= 2
        assert opening[0]["start_row"] + opening[0]["length"] <= len(next_rows)


def test_aggregate_region_totals_match_the_sheet() -> None:
    dataset_id, frame = _upload_sample()
    response = _rows(
        dataset_id,
        {"group": {"mode": "aggregate", "columns": ["Region"]}},
    )
    assert response.status_code == 200
    body = response.json()
    groups = int(frame.groupby("Region", dropna=False).ngroups)
    assert body["total_rows"] == groups
    assert body["total_rows"] != 300
    assert body["total_rows"] != len(frame)
    assert body["spans"] == []
    assert body["group"] == {"mode": "aggregate", "columns": ["Region"]}
    assert "row_count" in body["columns"]
    assert "PnL_sum" in body["columns"]
    assert "PnL_mean" in body["columns"]
    assert body["page_size"] == 100
    for row in body["rows"]:
        assert "row_count" in row
        assert "PnL_sum" in row
        assert "PnL_mean" in row

    chosen = "UAE"
    if not (frame["Region"] == chosen).any():
        present = frame["Region"].dropna()
        assert not present.empty
        chosen = _region_label(present.iloc[0])
    part = frame.loc[frame["Region"].map(_region_label) == chosen]
    numbers = part["PnL"].dropna()
    matched = [row for row in body["rows"] if row["Region"] == chosen]
    assert len(matched) == 1
    assert matched[0]["row_count"] == len(part)
    assert matched[0]["PnL_sum"] == pytest.approx(float(numbers.sum()))
    assert matched[0]["PnL_mean"] == pytest.approx(float(numbers.mean()))


def test_empty_filter_returns_an_empty_page() -> None:
    dataset_id, _frame = _upload_sample()
    response = _rows(
        dataset_id,
        {
            "filter": {
                "combinator": "and",
                "conditions": [
                    {"column": "Region", "operator": "eq", "value": "__none__"},
                ],
            }
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["rows"] == []
    assert body["total_rows"] == 0
    assert body["total_pages"] == 0
    assert body["page_size"] == 100


def test_invalid_filter_names_the_condition_and_page_zero_is_rejected() -> None:
    dataset_id, _frame = _upload_sample()
    unknown = _rows(
        dataset_id,
        {
            "filter": {
                "combinator": "and",
                "conditions": [
                    {"column": "Missing_Column", "operator": "eq", "value": "x"},
                ],
            }
        },
        params={"lang": "ru"},
    )
    assert unknown.status_code == 422
    assert unknown.json()["error"]["code"] == "invalid_filter"
    assert "0" in unknown.json()["error"]["message"]
    assert unknown.json()["error"]["message"] == "Условие 0 некорректно."

    contains = _rows(
        dataset_id,
        {
            "filter": {
                "combinator": "and",
                "conditions": [
                    {"column": "Region", "operator": "eq", "value": "UAE"},
                    {"column": "PnL", "operator": "contains", "value": "1"},
                ],
            }
        },
    )
    assert contains.status_code == 422
    assert contains.json()["error"]["code"] == "invalid_filter"
    assert "1" in contains.json()["error"]["message"]
    assert contains.json()["error"]["message"] == "Condition 1 is invalid."

    page = _rows(dataset_id, {"page": 0})
    assert page.status_code == 422
    assert page.json()["error"] == {
        "code": "invalid_page",
        "message": "The page is invalid.",
    }


def test_page_past_the_end_is_invalid() -> None:
    dataset_id, _frame = _upload_sample()
    response = _rows(dataset_id, {"page": 99})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_page"


def test_rows_query_does_not_change_summary() -> None:
    dataset_id, _frame = _upload_sample()
    before = client.get(f"/api/v1/datasets/{dataset_id}/summary")
    assert before.status_code == 200
    queried = _rows(
        dataset_id,
        {
            "filter": {
                "combinator": "and",
                "conditions": [
                    {"column": "Region", "operator": "eq", "value": "UAE"},
                ],
            },
            "sort": [{"column": "PnL", "direction": "desc"}],
            "group": {"mode": "rowspan", "columns": ["Region"]},
        },
    )
    assert queried.status_code == 200
    after = client.get(f"/api/v1/datasets/{dataset_id}/summary")
    assert after.status_code == 200
    assert before.json() == after.json()


def test_page_size_in_the_body_is_ignored() -> None:
    dataset_id, _frame = _upload_sample()
    response = _rows(dataset_id, {"page_size": 5, "page": 1})
    assert response.status_code == 200
    body = response.json()
    assert body["page_size"] == 100
    assert body["total_rows"] > 5
    assert len(body["rows"]) == 100

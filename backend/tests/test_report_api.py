import io
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.api.language import LanguageRejected, resolve_lang
from app.domain.messages import message
from app.infrastructure.store import DatasetStore, set_store
from app.main import app

client = TestClient(app)

_EXPIRES = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
_SECTIONS = (
    "preview",
    "columns",
    "shape",
    "dtypes",
    "missing",
    "summary",
    "ranking",
    "grouping",
    "timeseries",
    "insights",
)


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


def _upload(name: str, content: bytes, sheet: str | None = None, **kwargs):
    files = {"file": (name, content)}
    data = None if sheet is None else {"sheet": sheet}
    return client.post("/api/v1/datasets", files=files, data=data, **kwargs)


def _two_sheet_workbook() -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame({"n": [1, 2]}).to_excel(writer, sheet_name="Trades", index=False)
        pd.DataFrame({"n": [3]}).to_excel(writer, sheet_name="Clients", index=False)
    return buffer.getvalue()


def test_resolve_lang_scans_accept_language_left_to_right() -> None:
    assert resolve_lang(None, None) == "en"
    assert resolve_lang(None, "fr-FR,ru-RU;q=0.1,en;q=0.9") == "ru"
    assert resolve_lang("en", "ru-RU") == "en"
    with pytest.raises(LanguageRejected):
        resolve_lang("de", None)
    with pytest.raises(LanguageRejected):
        resolve_lang("ru-RU", None)


def test_sample_upload_and_report_sections() -> None:
    workbook = _sample_workbook()
    response = _upload(workbook.name, workbook.read_bytes())

    assert response.status_code == 201
    created = response.json()
    assert created["status"] == "ready"
    assert created["sheet"] == "Brokerage_Data"
    assert created["sheets"] == ["Brokerage_Data"]
    assert created["filename"] == workbook.name
    assert created["size_bytes"] == workbook.stat().st_size
    assert _EXPIRES.fullmatch(created["expires_at"])
    uuid.UUID(created["dataset_id"])
    dataset_id = created["dataset_id"]

    bodies = []
    for section in _SECTIONS:
        section_response = client.get(f"/api/v1/datasets/{dataset_id}/{section}")
        assert section_response.status_code == 200
        body = section_response.json()
        assert body["status"] == "ok"
        bodies.append(body)

    suggestions = bodies[1]["data"]["suggestions"]
    assert suggestions == {
        "metric": "Quantity",
        "category": "Region",
        "datetime": "Transaction_Date",
    }
    preview = bodies[0]["data"]
    assert preview["row_limit"] == 20
    assert len(preview["rows"]) == 20
    assert bodies[8]["data"]["grain"] == "day"

    insight = bodies[9]["data"]["items"][0]
    assert insight["column"] == "PnL"
    assert insight["direction"] == "down"
    assert -31 < insight["change_pct"] < -29
    assert "decreased" in insight["text"]

    russian = client.get(
        f"/api/v1/datasets/{dataset_id}/insights",
        params={"lang": "ru"},
    )
    assert russian.status_code == 200
    russian_item = russian.json()["data"]["items"][0]
    assert russian_item["column"] == "PnL"
    assert "снизился" in russian_item["text"]
    assert "PnL" in russian_item["text"]

    english = client.get(
        f"/api/v1/datasets/{dataset_id}/insights",
        params={"lang": "en"},
    )
    assert "decreased" in english.json()["data"]["items"][0]["text"]


def test_missing_datetime_column_is_unavailable_and_preview_stays_ok() -> None:
    response = _upload("plain.csv", b"name,amount\nalice,10\nbob,20\n")
    assert response.status_code == 201
    dataset_id = response.json()["dataset_id"]

    preview = client.get(f"/api/v1/datasets/{dataset_id}/preview")
    assert preview.status_code == 200
    assert preview.json()["status"] == "ok"

    dynamics = client.get(
        f"/api/v1/datasets/{dataset_id}/timeseries",
        params={"lang": "ru"},
    )
    assert dynamics.status_code == 200
    assert dynamics.json() == {
        "status": "unavailable",
        "error": {
            "code": "no_datetime_column",
            "message": "Для этого блока нет колонки с датой.",
        },
    }


def test_two_sheet_workbook_waits_for_a_sheet() -> None:
    response = _upload("book.xlsx", _two_sheet_workbook())
    assert response.status_code == 201
    created = response.json()
    assert created["status"] == "sheet_required"
    assert created["sheet"] is None
    assert created["sheets"] == ["Trades", "Clients"]
    dataset_id = created["dataset_id"]

    preview = client.get(f"/api/v1/datasets/{dataset_id}/preview")
    assert preview.status_code == 409
    assert preview.json()["error"]["code"] == "sheet_required"

    missing = client.put(
        f"/api/v1/datasets/{dataset_id}/sheet",
        json={"sheet": "Nope"},
        params={"lang": "ru"},
    )
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "sheet_not_found"
    assert missing.json()["error"]["message"] == message("sheet_not_found", "ru")

    chosen = client.put(
        f"/api/v1/datasets/{dataset_id}/sheet",
        json={"sheet": "Trades"},
    )
    assert chosen.status_code == 200
    assert chosen.json() == {
        "dataset_id": dataset_id,
        "status": "ready",
        "sheet": "Trades",
    }

    ready = client.get(f"/api/v1/datasets/{dataset_id}/preview")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ok"

    again = client.put(
        f"/api/v1/datasets/{dataset_id}/sheet",
        json={"sheet": "Clients"},
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "already_ready"


def test_upload_rejects_bad_extension_empty_file_and_header_only() -> None:
    notes = _upload("notes.txt", b"hello")
    assert notes.status_code == 415
    assert notes.json()["error"]["code"] == "unsupported_format"

    empty = _upload("empty.csv", b"")
    assert empty.status_code == 422
    assert empty.json()["error"]["code"] == "empty_file"

    header = _upload("header.csv", b"a,b\n")
    assert header.status_code == 422
    assert header.json()["error"]["code"] == "no_data_rows"


def test_upload_rejects_a_missing_file() -> None:
    response = client.post("/api/v1/datasets")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "missing_file"


def test_file_too_large(monkeypatch) -> None:
    monkeypatch.setenv("UPLOAD_LIMIT_BYTES", "8")
    response = _upload("big.csv", b"name,amount\nalice,10\n")
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


def test_delete_forgets_the_dataset() -> None:
    response = _upload("rows.csv", b"n\n1\n")
    dataset_id = response.json()["dataset_id"]

    deleted = client.delete(f"/api/v1/datasets/{dataset_id}")
    assert deleted.status_code == 204
    assert deleted.content == b""

    preview = client.get(f"/api/v1/datasets/{dataset_id}/preview")
    assert preview.status_code == 404
    assert preview.json()["error"]["code"] == "dataset_not_found"

    second = client.delete(f"/api/v1/datasets/{dataset_id}")
    assert second.status_code == 404
    assert second.json()["error"]["code"] == "dataset_not_found"

    unknown = client.delete(f"/api/v1/datasets/{uuid.uuid4()}")
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "dataset_not_found"


def test_russian_not_found_message() -> None:
    response = client.get(
        f"/api/v1/datasets/{uuid.uuid4()}/preview",
        params={"lang": "ru"},
    )
    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "dataset_not_found",
        "message": message("dataset_not_found", "ru"),
    }


def test_accept_language_uses_the_first_supported_tag() -> None:
    response = client.get(
        f"/api/v1/datasets/{uuid.uuid4()}/columns",
        headers={"Accept-Language": "de, ru-RU;q=0.2, en;q=0.9"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["message"] == message("dataset_not_found", "ru")


def test_dataset_expires_when_the_clock_reaches_expires_at(clock: _Clock) -> None:
    response = _upload("rows.csv", b"n\n1\n")
    assert response.status_code == 201
    dataset_id = response.json()["dataset_id"]
    expires_at = datetime.fromisoformat(
        response.json()["expires_at"].replace("Z", "+00:00")
    )

    clock.now = expires_at
    preview = client.get(f"/api/v1/datasets/{dataset_id}/preview")
    assert preview.status_code == 404
    assert preview.json()["error"]["code"] == "dataset_not_found"


def test_explicit_unsupported_language() -> None:
    response = _upload("rows.csv", b"n\n1\n")
    dataset_id = response.json()["dataset_id"]
    rejected = client.get(
        f"/api/v1/datasets/{dataset_id}/preview",
        params={"lang": "de"},
    )
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "invalid_language"


def test_unhandled_exception_is_a_localized_internal_error(monkeypatch) -> None:
    response = _upload("rows.csv", b"n\n1\n")
    dataset_id = response.json()["dataset_id"]

    def explode(_frame):
        raise RuntimeError("secret-trace")

    monkeypatch.setattr("app.services.datasets.preview_data", explode)
    quiet = TestClient(app, raise_server_exceptions=False)
    failed = quiet.get(
        f"/api/v1/datasets/{dataset_id}/preview",
        params={"lang": "ru"},
    )
    assert failed.status_code == 500
    assert failed.json() == {
        "error": {
            "code": "internal_error",
            "message": message("internal_error", "ru"),
        }
    }
    assert "secret-trace" not in failed.text
    assert "Traceback" not in failed.text

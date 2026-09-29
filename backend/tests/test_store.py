from datetime import datetime, timedelta, timezone

import pandas as pd

from app.domain.types import ColumnInfo, Suggestions
from app.infrastructure.store import DatasetStore, StoredDataset, get_store, set_store


class _Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


def _dataset(
    dataset_id: str,
    created_at: datetime,
    expires_at: datetime,
    frame: pd.DataFrame | None,
) -> StoredDataset:
    return StoredDataset(
        dataset_id=dataset_id,
        filename="sample.csv",
        content=b"n\n1\n",
        size_bytes=4,
        status="ready" if frame is not None else "sheet_required",
        sheet="Sheet1" if frame is not None else None,
        sheets=["Sheet1"],
        frame=frame,
        columns=[ColumnInfo(name="n", dtype="int64", role="metric", unique_count=1)],
        suggestions=Suggestions(metric="n", category=None, datetime=None),
        created_at=created_at,
        expires_at=expires_at,
    )


def test_add_get_and_delete() -> None:
    start = datetime(2026, 9, 29, tzinfo=timezone.utc)
    store = DatasetStore(ttl=timedelta(minutes=60), clock=_Clock(start))
    frame = pd.DataFrame({"n": [1]})
    dataset = _dataset("ds-1", start, start + timedelta(minutes=60), frame)

    store.add(dataset)

    loaded = store.get("ds-1")
    assert loaded is dataset
    assert loaded.frame.equals(frame)
    assert store.delete("ds-1") is True
    assert store.get("ds-1") is None


def test_second_delete_is_false() -> None:
    start = datetime(2026, 9, 29, tzinfo=timezone.utc)
    store = DatasetStore(ttl=timedelta(minutes=60), clock=_Clock(start))
    store.add(_dataset("ds-1", start, start + timedelta(minutes=60), None))

    assert store.delete("ds-1") is True
    assert store.delete("ds-1") is False


def test_unknown_id_is_none() -> None:
    start = datetime(2026, 9, 29, tzinfo=timezone.utc)
    store = DatasetStore(ttl=timedelta(minutes=60), clock=_Clock(start))

    assert store.get("missing") is None
    assert store.delete("missing") is False


def test_exact_expiry_removes_entry() -> None:
    start = datetime(2026, 9, 29, tzinfo=timezone.utc)
    clock = _Clock(start)
    store = DatasetStore(ttl=timedelta(minutes=60), clock=clock)
    expires_at = start + timedelta(minutes=60)
    store.add(_dataset("by-get", start, expires_at, pd.DataFrame({"n": [1]})))
    store.add(_dataset("by-delete", start, expires_at, None))

    clock.now = expires_at

    assert store.get("by-get") is None
    assert store.delete("by-get") is False
    assert store.delete("by-delete") is False
    assert store.get("by-delete") is None


def test_update_replaces_record_and_keeps_caller_times() -> None:
    start = datetime(2026, 9, 29, tzinfo=timezone.utc)
    store = DatasetStore(ttl=timedelta(minutes=60), clock=_Clock(start))
    created_at = start
    expires_at = start + timedelta(minutes=60)
    original = _dataset("ds-1", created_at, expires_at, None)
    store.add(original)

    frame = pd.DataFrame({"n": [1]})
    replacement = StoredDataset(
        dataset_id="ds-1",
        filename=original.filename,
        content=original.content,
        size_bytes=original.size_bytes,
        status="ready",
        sheet="Sheet1",
        sheets=["Sheet1"],
        frame=frame,
        columns=original.columns,
        suggestions=original.suggestions,
        created_at=created_at,
        expires_at=expires_at,
    )
    store.update(replacement)

    loaded = store.get("ds-1")
    assert loaded is replacement
    assert loaded.created_at == created_at
    assert loaded.expires_at == expires_at
    assert loaded.status == "ready"


def test_get_store_singleton(monkeypatch) -> None:
    monkeypatch.setattr("app.infrastructure.store._store", None)
    try:
        first = get_store()
        second = get_store()
        assert first is second
        assert first.ttl == timedelta(minutes=60)

        injected = DatasetStore(ttl=timedelta(minutes=1), clock=lambda: datetime.now(timezone.utc))
        set_store(injected)
        assert get_store() is injected

        set_store(None)
        assert get_store() is not injected
    finally:
        set_store(None)

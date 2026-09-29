"""In-memory dataset store for one API process."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Literal

import pandas as pd

from app.domain.types import ColumnInfo, Suggestions


@dataclass
class StoredDataset:
    dataset_id: str
    filename: str
    content: bytes
    size_bytes: int
    status: Literal["ready", "sheet_required"]
    sheet: str | None
    sheets: list[str]
    frame: pd.DataFrame | None
    columns: list[ColumnInfo]
    suggestions: Suggestions
    created_at: datetime
    expires_at: datetime


class DatasetStore:
    """One dict of datasets. A single worker; expiry is checked on read and delete."""

    def __init__(self, *, ttl: timedelta, clock: Callable[[], datetime]) -> None:
        self.ttl = ttl
        self._clock = clock
        self._items: dict[str, StoredDataset] = {}

    def add(self, dataset: StoredDataset) -> None:
        self._items[dataset.dataset_id] = dataset

    def get(self, dataset_id: str) -> StoredDataset | None:
        """If the id is unknown, or clock() >= expires_at, delete it if present and return None."""
        dataset = self._items.get(dataset_id)
        if dataset is None:
            return None
        if self._expired(dataset):
            del self._items[dataset_id]
            return None
        return dataset

    def update(self, dataset: StoredDataset) -> None:
        """Replace the record with the same dataset_id. The caller keeps the original created_at and expires_at."""
        self._items[dataset.dataset_id] = dataset

    def delete(self, dataset_id: str) -> bool:
        """True only when a live (not expired) entry was removed. Expired or unknown -> False, and an expired entry is removed."""
        dataset = self._items.get(dataset_id)
        if dataset is None:
            return False
        del self._items[dataset_id]
        return not self._expired(dataset)

    def _expired(self, dataset: StoredDataset) -> bool:
        return self._clock() >= dataset.expires_at


_store: DatasetStore | None = None


def get_store() -> DatasetStore:
    """Create once with ttl=timedelta(minutes=Settings().dataset_ttl_minutes) and clock=lambda: datetime.now(timezone.utc)."""
    global _store
    if _store is None:
        from app.config.settings import Settings

        _store = DatasetStore(
            ttl=timedelta(minutes=Settings().dataset_ttl_minutes),
            clock=lambda: datetime.now(timezone.utc),
        )
    return _store


def set_store(store: DatasetStore | None) -> None:
    """Tests inject a store. None clears the singleton."""
    global _store
    _store = store

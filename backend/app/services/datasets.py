"""Upload, sheet selection, and report sections. Math and parsing live elsewhere."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd

from app.config.settings import Settings
from app.domain.analytical import (
    grouping_section,
    insights_section,
    ranking_section,
    timeseries_section,
)
from app.domain.descriptive import (
    columns_data,
    dtypes_data,
    missing_data,
    preview_data,
    shape_data,
    summary_data,
)
from app.domain.roles import prepare_table
from app.domain.types import ColumnInfo, SectionResult, Suggestions
from app.infrastructure.readers import ReadRejected, read_table, sheet_names
from app.infrastructure.store import DatasetStore, StoredDataset, get_store

_EXCEL = frozenset({"xlsx", "xls"})
_ALLOWED = frozenset({"csv", "tsv", "xlsx", "xls", "json", "parquet"})


class DatasetFailure(Exception):
    """A request failure the HTTP layer turns into an error body."""

    def __init__(self, status_code: int, code: str) -> None:
        self.status_code = status_code
        self.code = code
        super().__init__(code)


def create_dataset(
    *,
    filename: str | None,
    content: bytes | None,
    sheet: str | None,
    content_length: int | None,
) -> StoredDataset:
    settings = Settings()
    if content is None:
        raise DatasetFailure(400, "missing_file")
    basename = _basename(filename)
    extension = _extension(basename)
    if extension not in _ALLOWED:
        raise DatasetFailure(415, "unsupported_format")
    if len(content) == 0:
        raise DatasetFailure(422, "empty_file")
    limit = settings.upload_limit_bytes
    if (content_length is not None and content_length > limit) or len(content) > limit:
        raise DatasetFailure(413, "file_too_large")

    chosen: str | None = None
    names: list[str] = []
    if extension in _EXCEL:
        names = _sheet_names(content, basename)
        if sheet is not None and sheet not in names:
            raise DatasetFailure(422, "sheet_not_found")
        if len(names) > 1 and sheet is None:
            return _save_unparsed(basename, content, names, settings)
        chosen = sheet if sheet is not None else (names[0] if names else None)

    frame = _read(content, basename, chosen if extension in _EXCEL else None)
    prepared_frame, columns, suggestions = _prepare(frame)
    now, expires_at = _lifetime(settings)
    dataset = StoredDataset(
        dataset_id=str(uuid.uuid4()),
        filename=basename,
        content=content,
        size_bytes=len(content),
        status="ready",
        sheet=chosen if extension in _EXCEL else None,
        sheets=names if extension in _EXCEL else [],
        frame=prepared_frame,
        columns=columns,
        suggestions=suggestions,
        created_at=now,
        expires_at=expires_at,
    )
    get_store().add(dataset)
    return dataset


def select_sheet(dataset_id: str, sheet: str) -> StoredDataset:
    dataset = _live(dataset_id)
    if dataset.status == "ready":
        raise DatasetFailure(409, "already_ready")
    if sheet not in dataset.sheets:
        raise DatasetFailure(422, "sheet_not_found")
    frame = _read(dataset.content, dataset.filename, sheet)
    prepared_frame, columns, suggestions = _prepare(frame)
    updated = StoredDataset(
        dataset_id=dataset.dataset_id,
        filename=dataset.filename,
        content=dataset.content,
        size_bytes=dataset.size_bytes,
        status="ready",
        sheet=sheet,
        sheets=list(dataset.sheets),
        frame=prepared_frame,
        columns=columns,
        suggestions=suggestions,
        created_at=dataset.created_at,
        expires_at=dataset.expires_at,
    )
    get_store().update(updated)
    return updated


def remove_dataset(dataset_id: str) -> None:
    if not get_store().delete(dataset_id):
        raise DatasetFailure(404, "dataset_not_found")


def load_ready(dataset_id: str) -> StoredDataset:
    dataset = _live(dataset_id)
    if dataset.status == "sheet_required":
        raise DatasetFailure(409, "sheet_required")
    return dataset


def preview_section(dataset: StoredDataset) -> dict[str, Any]:
    return preview_data(_frame(dataset))


def columns_section(dataset: StoredDataset) -> dict[str, Any]:
    return columns_data(dataset.columns, dataset.suggestions)


def shape_section(dataset: StoredDataset) -> dict[str, Any]:
    return shape_data(_frame(dataset))


def dtypes_section(dataset: StoredDataset) -> dict[str, Any]:
    return dtypes_data(dataset.columns)


def missing_section(dataset: StoredDataset) -> dict[str, Any]:
    return missing_data(_frame(dataset))


def summary_section(dataset: StoredDataset) -> dict[str, Any]:
    return summary_data(_frame(dataset), dataset.columns)


def ranking(dataset: StoredDataset, metric: str | None) -> SectionResult:
    return ranking_section(_frame(dataset), dataset.columns, dataset.suggestions, metric)


def grouping(
    dataset: StoredDataset,
    category: str | None,
    metric: str | None,
) -> SectionResult:
    return grouping_section(
        _frame(dataset),
        dataset.columns,
        dataset.suggestions,
        category,
        metric,
    )


def timeseries(
    dataset: StoredDataset,
    date_column: str | None,
    metric: str | None,
) -> SectionResult:
    return timeseries_section(
        _frame(dataset),
        dataset.columns,
        dataset.suggestions,
        date_column,
        metric,
    )


def insights(
    dataset: StoredDataset,
    date_column: str | None,
    lang: str,
) -> SectionResult:
    return insights_section(
        _frame(dataset),
        dataset.columns,
        dataset.suggestions,
        date_column,
        lang,
    )


def _live(dataset_id: str) -> StoredDataset:
    dataset = get_store().get(dataset_id)
    if dataset is None:
        raise DatasetFailure(404, "dataset_not_found")
    return dataset


def _save_unparsed(
    filename: str,
    content: bytes,
    sheets: list[str],
    settings: Settings,
) -> StoredDataset:
    now, expires_at = _lifetime(settings)
    dataset = StoredDataset(
        dataset_id=str(uuid.uuid4()),
        filename=filename,
        content=content,
        size_bytes=len(content),
        status="sheet_required",
        sheet=None,
        sheets=list(sheets),
        frame=None,
        columns=[],
        suggestions=Suggestions(metric=None, category=None, datetime=None),
        created_at=now,
        expires_at=expires_at,
    )
    get_store().add(dataset)
    return dataset


def _lifetime(settings: Settings) -> tuple[datetime, datetime]:
    now = _now(get_store())
    expires_at = now + timedelta(minutes=settings.dataset_ttl_minutes)
    return now, expires_at


def _now(store: DatasetStore) -> datetime:
    """Timezone-aware UTC second used for created_at and expires_at.

    The store expires an entry when its clock reaches expires_at, so this
    timestamp comes from that same clock.
    """

    clock = getattr(store, "_clock", None)
    current = clock() if clock is not None else datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc).replace(microsecond=0)


def _sheet_names(content: bytes, filename: str) -> list[str]:
    try:
        return list(sheet_names(content, filename))
    except ReadRejected as exc:
        raise DatasetFailure(422, exc.code) from exc


def _frame(dataset: StoredDataset) -> pd.DataFrame:
    if dataset.frame is None:
        raise RuntimeError("A ready dataset has no table.")
    return dataset.frame


def _read(content: bytes, filename: str, sheet: str | None) -> pd.DataFrame:
    try:
        return read_table(content, filename, sheet)
    except ReadRejected as exc:
        raise DatasetFailure(422, exc.code) from exc


def _prepare(frame: pd.DataFrame) -> tuple[pd.DataFrame, list[ColumnInfo], Suggestions]:
    try:
        table, columns, suggestions = prepare_table(frame)
    except ReadRejected as exc:
        raise DatasetFailure(422, exc.code) from exc
    return table, list(columns), suggestions


def _basename(filename: str | None) -> str:
    if not filename:
        return ""
    return filename.replace("\\", "/").rsplit("/", 1)[-1]


def _extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()

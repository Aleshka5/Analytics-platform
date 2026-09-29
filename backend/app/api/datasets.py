"""Dataset upload and the ten base-report routes."""

from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from starlette.datastructures import UploadFile

from app.api.language import LanguageRejected, resolve_lang
from app.domain.messages import message
from app.domain.types import ColumnRejected, SectionResult
from app.services.datasets import (
    DatasetFailure,
    columns_section,
    create_dataset,
    dtypes_section,
    grouping,
    insights,
    load_ready,
    missing_section,
    preview_section,
    ranking,
    remove_dataset,
    select_sheet,
    shape_section,
    summary_section,
    timeseries,
)
from app.infrastructure.store import StoredDataset

router = APIRouter(prefix="/api/v1")


def _error(status_code: int, code: str, lang: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message(code, lang)}},
    )


def _language(lang: str | None, request: Request) -> str | JSONResponse:
    try:
        return resolve_lang(lang, request.headers.get("accept-language"))
    except LanguageRejected:
        return _error(422, "invalid_language", "en")


def _failure(exc: DatasetFailure, lang: str) -> JSONResponse:
    return _error(exc.status_code, exc.code, lang)


class SheetBody(BaseModel):
    sheet: str


def _created(dataset: StoredDataset) -> dict[str, Any]:
    return {
        "dataset_id": dataset.dataset_id,
        "filename": dataset.filename,
        "status": dataset.status,
        "sheet": dataset.sheet,
        "sheets": dataset.sheets,
        "size_bytes": dataset.size_bytes,
        "expires_at": dataset.expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _content_length(request: Request) -> int | None:
    header = request.headers.get("content-length")
    if header is None or header.strip() == "":
        return None
    try:
        return int(header)
    except ValueError:
        return None


def _ok(data: dict[str, Any]) -> dict[str, Any]:
    return {"status": "ok", "data": data}


def _envelope(result: SectionResult, lang: str) -> dict[str, Any]:
    if result.status == "unavailable":
        code = result.code or "internal_error"
        return {
            "status": "unavailable",
            "error": {"code": code, "message": message(code, lang)},
        }
    return {"status": "ok", "data": result.data}


def _ready(dataset_id: str, lang: str | None, request: Request) -> tuple[str, Any] | JSONResponse:
    resolved = _language(lang, request)
    if isinstance(resolved, JSONResponse):
        return resolved
    try:
        dataset = load_ready(dataset_id)
    except DatasetFailure as exc:
        return _failure(exc, resolved)
    return resolved, dataset


@router.post("/datasets")
async def upload_dataset(
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    resolved = _language(lang, request)
    if isinstance(resolved, JSONResponse):
        return resolved
    form = await request.form()
    uploaded = form.get("file")
    sheet_value = form.get("sheet")
    sheet = sheet_value if isinstance(sheet_value, str) else None
    if not isinstance(uploaded, UploadFile):
        return _error(400, "missing_file", resolved)
    content = await uploaded.read()
    try:
        dataset = create_dataset(
            filename=uploaded.filename,
            content=content,
            sheet=sheet,
            content_length=_content_length(request),
        )
    except DatasetFailure as exc:
        return _failure(exc, resolved)
    return JSONResponse(status_code=201, content=_created(dataset))


@router.put("/datasets/{dataset_id}/sheet")
def choose_sheet(
    dataset_id: str,
    body: SheetBody,
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    resolved = _language(lang, request)
    if isinstance(resolved, JSONResponse):
        return resolved
    try:
        dataset = select_sheet(dataset_id, body.sheet)
    except DatasetFailure as exc:
        return _failure(exc, resolved)
    return {
        "dataset_id": dataset.dataset_id,
        "status": dataset.status,
        "sheet": dataset.sheet,
    }


@router.delete("/datasets/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    resolved = _language(lang, request)
    if isinstance(resolved, JSONResponse):
        return resolved
    try:
        remove_dataset(dataset_id)
    except DatasetFailure as exc:
        return _failure(exc, resolved)
    return Response(status_code=204)


@router.get("/datasets/{dataset_id}/preview")
def get_preview(
    dataset_id: str,
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    return _ok(preview_section(dataset))


@router.get("/datasets/{dataset_id}/columns")
def get_columns(
    dataset_id: str,
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    return _ok(columns_section(dataset))


@router.get("/datasets/{dataset_id}/shape")
def get_shape(
    dataset_id: str,
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    return _ok(shape_section(dataset))


@router.get("/datasets/{dataset_id}/dtypes")
def get_dtypes(
    dataset_id: str,
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    return _ok(dtypes_section(dataset))


@router.get("/datasets/{dataset_id}/missing")
def get_missing(
    dataset_id: str,
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    return _ok(missing_section(dataset))


@router.get("/datasets/{dataset_id}/summary")
def get_summary(
    dataset_id: str,
    request: Request,
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    return _ok(summary_section(dataset))


@router.get("/datasets/{dataset_id}/ranking")
def get_ranking(
    dataset_id: str,
    request: Request,
    metric: str | None = Query(default=None),
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    try:
        result = ranking(dataset, metric)
    except ColumnRejected:
        return _error(422, "invalid_column", resolved)
    return _envelope(result, resolved)


@router.get("/datasets/{dataset_id}/grouping")
def get_grouping(
    dataset_id: str,
    request: Request,
    category: str | None = Query(default=None),
    metric: str | None = Query(default=None),
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    try:
        result = grouping(dataset, category, metric)
    except ColumnRejected:
        return _error(422, "invalid_column", resolved)
    return _envelope(result, resolved)


@router.get("/datasets/{dataset_id}/timeseries")
def get_timeseries(
    dataset_id: str,
    request: Request,
    date_column: str | None = Query(default=None),
    metric: str | None = Query(default=None),
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    try:
        result = timeseries(dataset, date_column, metric)
    except ColumnRejected:
        return _error(422, "invalid_column", resolved)
    return _envelope(result, resolved)


@router.get("/datasets/{dataset_id}/insights")
def get_insights(
    dataset_id: str,
    request: Request,
    date_column: str | None = Query(default=None),
    lang: str | None = Query(default=None),
) -> Response:
    loaded = _ready(dataset_id, lang, request)
    if isinstance(loaded, JSONResponse):
        return loaded
    resolved, dataset = loaded
    try:
        result = insights(dataset, date_column, resolved)
    except ColumnRejected:
        return _error(422, "invalid_column", resolved)
    return _envelope(result, resolved)

"""Report file and table file downloads."""

from datetime import date
from pathlib import Path

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response

from app.api.language import LanguageRejected, resolve_lang
from app.api.rows import RowsBody
from app.domain.messages import message, query_error_message
from app.domain.query_errors import QueryRejected
from app.domain.query_export import rows_for_export
from app.domain.report_pdf import report_pdf
from app.domain.report_xlsx import report_xlsx
from app.domain.table_files import write_table
from app.services.datasets import DatasetFailure, load_ready
from app.services.report_blocks import build_report, report_title

router = APIRouter(prefix="/api/v1")

_TABLE_FORMATS = {"xlsx", "csv", "json"}
_REPORT_FORMATS = {"xlsx", "pdf"}
_MEDIA = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
    "json": "application/json; charset=utf-8",
    "pdf": "application/pdf",
}


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


def _attachment(filename: str, extension: str) -> str:
    stem = Path(filename).stem or "export"
    safe = stem.replace('"', "")
    return f'attachment; filename="{safe}.{extension}"'


def _download(content: bytes, filename: str, extension: str) -> Response:
    return Response(
        content=content,
        media_type=_MEDIA[extension],
        headers={"Content-Disposition": _attachment(filename, extension)},
    )


@router.get("/datasets/{dataset_id}/report")
def get_report(
    dataset_id: str,
    request: Request,
    export_format: str | None = Query(default=None, alias="format"),
    lang: str | None = Query(default=None),
) -> Response:
    resolved = _language(lang, request)
    if isinstance(resolved, JSONResponse):
        return resolved
    if export_format not in _REPORT_FORMATS:
        return _error(422, "unsupported_export_format", resolved)
    try:
        dataset = load_ready(dataset_id)
    except DatasetFailure as exc:
        return _failure(exc, resolved)
    blocks = build_report(dataset, resolved)
    if export_format == "pdf":
        payload = report_pdf(
            blocks,
            title=report_title(resolved),
            subtitle=f"{dataset.filename} · {date.today().isoformat()}",
            lang=resolved,
        )
    else:
        payload = report_xlsx(blocks)
    return _download(payload, dataset.filename, export_format)


@router.post("/datasets/{dataset_id}/rows/export")
def post_rows_export(
    dataset_id: str,
    request: Request,
    body: RowsBody | None = None,
    export_format: str | None = Query(default=None, alias="format"),
    lang: str | None = Query(default=None),
) -> Response:
    resolved = _language(lang, request)
    if isinstance(resolved, JSONResponse):
        return resolved
    if export_format not in _TABLE_FORMATS:
        return _error(422, "unsupported_export_format", resolved)
    try:
        dataset = load_ready(dataset_id)
    except DatasetFailure as exc:
        return _failure(exc, resolved)
    payload = RowsBody() if body is None else body
    try:
        table = rows_for_export(dataset, payload.model_dump(exclude={"page_size"}))
    except QueryRejected as exc:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": exc.code,
                    "message": query_error_message(exc.code, resolved, exc.index),
                }
            },
        )
    content = write_table(table["columns"], table["rows"], export_format)
    return _download(content, dataset.filename, export_format)

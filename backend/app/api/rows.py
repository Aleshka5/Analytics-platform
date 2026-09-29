"""Row query route. The success body is the page object itself."""

from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict

from app.api.language import LanguageRejected, resolve_lang
from app.domain.messages import message, query_error_message
from app.domain.query import query_rows
from app.domain.query_errors import QueryRejected
from app.services.datasets import DatasetFailure, load_ready

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


class RowsBody(BaseModel):
    """Accepted row query. `page_size` is accepted and not applied."""

    model_config = ConfigDict(extra="ignore")

    filter: dict[str, Any] | None = None
    sort: list[dict[str, Any]] | None = None
    group: dict[str, Any] | None = None
    page: int = 1
    page_size: Any = None


@router.post("/datasets/{dataset_id}/rows")
def post_rows(
    dataset_id: str,
    request: Request,
    body: RowsBody | None = None,
    lang: str | None = Query(default=None),
) -> Response:
    resolved = _language(lang, request)
    if isinstance(resolved, JSONResponse):
        return resolved
    try:
        dataset = load_ready(dataset_id)
    except DatasetFailure as exc:
        return _failure(exc, resolved)
    payload = RowsBody() if body is None else body
    try:
        page = query_rows(dataset, payload.model_dump(exclude={"page_size"}))
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
    return page

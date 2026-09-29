from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.datasets import router as datasets_router
from app.api.exports import router as exports_router
from app.api.health import router as health_router
from app.api.language import LanguageRejected, resolve_lang
from app.api.rows import router as rows_router
from app.domain.messages import message

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(health_router)
app.include_router(datasets_router)
app.include_router(rows_router)
app.include_router(exports_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    del exc
    lang = "en"
    try:
        lang = resolve_lang(
            request.query_params.get("lang"),
            request.headers.get("accept-language"),
        )
    except LanguageRejected:
        lang = "en"
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": message("internal_error", lang),
            }
        },
    )

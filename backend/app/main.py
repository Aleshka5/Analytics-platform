from fastapi import FastAPI

from app.api.health import router as health_router

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(health_router)

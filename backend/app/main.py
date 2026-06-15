from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.logging import setup_logging
from app.metrics import app_info, http_request_duration_seconds, registry

VERSION = "dev"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    app_info.info({"version": VERSION})
    logger.info("esp-web-flasher starting up, firmware_dir={}", settings.firmware_dir)
    # Catalog is loaded in Phase 2; placeholder here.
    yield
    logger.info("esp-web-flasher shut down")


app = FastAPI(
    title="ESP Web Flasher",
    version=VERSION,
    description="Self-hosted browser-based ESP firmware flasher",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    import time

    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    http_request_duration_seconds.labels(
        method=request.method,
        path=request.url.path,
        status=str(response.status_code),
    ).observe(duration)
    return response


@app.get("/health", tags=["system"])
async def health() -> dict[str, object]:
    return {"status": "ok", "version": VERSION, "products": 0, "versions": 0}


@app.get("/metrics", tags=["system"], include_in_schema=False)
async def metrics() -> Response:
    return Response(content=generate_latest(registry), media_type=CONTENT_TYPE_LATEST)


# Mount SPA — must come last so API routes take priority.
# In development the frontend is served by Vite; in production the built
# static files are copied here by the Dockerfile.
try:
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="spa")
except RuntimeError:
    logger.warning("Static dir '{}' not found — SPA not mounted", settings.static_dir)


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=False)


if __name__ == "__main__":
    main()

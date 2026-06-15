from contextlib import asynccontextmanager
from typing import AsyncGenerator

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from loguru import logger
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.requests import Request
from starlette.responses import Response

from app.api.v1.router import router as api_v1_router
from app.catalog.loader import load_catalog
from app.catalog.store import catalog_stats, set_catalog
from app.core.config import settings
from app.core.logging import setup_logging
from app.metrics import (
    app_info,
    catalog_products_total,
    catalog_versions_total,
    http_request_duration_seconds,
    registry,
)

VERSION = "dev"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    app_info.info({"version": VERSION})
    logger.info("esp-web-flasher starting up, firmware_dir={}", settings.firmware_dir)
    try:
        products = load_catalog(settings.firmware_dir, fail_on_empty=settings.fail_on_empty)
        set_catalog(products)
        stats = catalog_stats()
        catalog_products_total.set(stats["products"])
        catalog_versions_total.set(stats["versions"])
    except (FileNotFoundError, RuntimeError) as exc:
        logger.error("Catalogue load failed: {}", exc)
        raise
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
    stats = catalog_stats()
    return {"status": "ok", "version": VERSION, **stats}


@app.get("/metrics", tags=["system"], include_in_schema=False)
async def metrics() -> Response:
    return Response(content=generate_latest(registry), media_type=CONTENT_TYPE_LATEST)


app.include_router(api_v1_router)


# SPA catch-all — must come after all API routes.
# Serves real static files (JS/CSS/assets) by exact path; falls back to
# index.html for any path that doesn't match a file, so that react-router
# handles client-side navigation correctly on page refresh.
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str) -> Response:
    # Never serve index.html for API paths; let FastAPI return its own 404.
    # This also prevents %2F-encoded slashes from bypassing route matching.
    if full_path.startswith("api/") or full_path == "api":
        return Response(status_code=404)

    static_root = Path(settings.static_dir)
    candidate = (static_root / full_path).resolve()
    # Ensure the resolved path stays inside static_dir (no traversal).
    try:
        candidate.relative_to(static_root.resolve())
    except ValueError:
        return Response(status_code=404)
    if candidate.is_file():
        return FileResponse(str(candidate))
    index = static_root / "index.html"
    if index.is_file():
        return FileResponse(str(index))
    return Response(status_code=404, content="SPA not built yet")


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=False)  # nosec B104


if __name__ == "__main__":
    main()

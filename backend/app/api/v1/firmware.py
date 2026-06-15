"""
Firmware part (.bin) and product image serving.

Security: slug, version, and file are always validated against the in-memory
catalog before a filesystem path is constructed.  Raw user input is never used
to build a path directly, which prevents path traversal attacks.

Caching: part URLs are versioned (slug/version/file), so we serve them as
immutable with a one-year max-age.  ETags allow conditional GETs.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse

from app.catalog.store import get_product
from app.core.config import settings
from app.metrics import part_downloads_total

router = APIRouter()

# ESP Web Tools uses these chip family strings.
_ESP_WEB_TOOLS_CHIP: dict[str, str] = {
    "esp32":   "ESP32",
    "esp32c3": "ESP32-C3",
    "esp32s3": "ESP32-S3",
    "esp32c6": "ESP32-C6",
    "esp32s2": "ESP32-S2",
    "esp32h2": "ESP32-H2",
    "esp8266": "ESP8266",
}

_ONE_YEAR = 60 * 60 * 24 * 365


def _part_path(slug: str, version: str, filename: str) -> Path:
    """Resolve and validate a part file path from catalog-confirmed components."""
    return Path(settings.firmware_dir) / slug / version / filename


def _etag(path: Path) -> str:
    stat = path.stat()
    raw = f"{path}:{stat.st_size}:{stat.st_mtime_ns}"
    return hashlib.md5(raw.encode()).hexdigest()  # noqa: S324 — ETag, not crypto


@router.get(
    "/products/{slug}/versions/{version}/parts/{file}",
    summary="Download a firmware part binary",
    response_class=FileResponse,
)
async def serve_part(slug: str, version: str, file: str, request: Request) -> FileResponse:
    product = get_product(slug)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {slug!r} not found")

    fw = next((v for v in product.versions if v.version == version), None)
    if fw is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version!r} not found for product {slug!r}",
        )

    # Whitelist check — the requested file must be declared in the manifest.
    if not any(p.file == file for p in fw.parts):
        raise HTTPException(
            status_code=404,
            detail=f"File {file!r} not in manifest for {slug} {version}",
        )

    path = _part_path(slug, version, file)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Part file missing from disk")

    etag = _etag(path)
    if request.headers.get("if-none-match") == etag:
        from starlette.responses import Response
        return Response(status_code=304)  # type: ignore[return-value]

    part_downloads_total.labels(product=slug, version=version, file=file).inc()

    return FileResponse(
        path=str(path),
        media_type="application/octet-stream",
        headers={
            "Cache-Control": f"public, max-age={_ONE_YEAR}, immutable",
            "ETag": etag,
        },
    )


@router.get(
    "/products/{slug}/images/{file:path}",
    summary="Serve a product image",
    response_class=FileResponse,
)
async def serve_image(slug: str, file: str) -> FileResponse:
    product = get_product(slug)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {slug!r} not found")

    # Whitelist: requested path must appear in product.images list.
    if file not in product.images:
        raise HTTPException(
            status_code=404,
            detail=f"Image {file!r} not listed for product {slug!r}",
        )

    path = Path(settings.firmware_dir) / slug / file
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    suffix = path.suffix.lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }
    media_type = media_types.get(suffix, "application/octet-stream")

    return FileResponse(
        path=str(path),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get(
    "/products/{slug}/versions/{version}/esp-web-tools.json",
    summary="ESP Web Tools–compatible install manifest",
)
async def esp_web_tools_manifest(slug: str, version: str, request: Request) -> JSONResponse:
    product = get_product(slug)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {slug!r} not found")

    fw = next((v for v in product.versions if v.version == version), None)
    if fw is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version!r} not found for product {slug!r}",
        )

    base_url = str(request.base_url).rstrip("/")
    parts_base = f"{base_url}/api/v1/products/{slug}/versions/{version}/parts"

    chip_label = _ESP_WEB_TOOLS_CHIP.get(fw.chip_family.value, fw.chip_family.value.upper())

    manifest = {
        "name": product.name,
        "version": fw.version,
        "new_install_prompt_erase": fw.flash.erase_before,
        "builds": [
            {
                "chipFamily": chip_label,
                "parts": [
                    {"path": f"{parts_base}/{p.file}", "offset": p.offset}
                    for p in fw.parts
                ],
            }
        ],
    }
    return JSONResponse(content=manifest)

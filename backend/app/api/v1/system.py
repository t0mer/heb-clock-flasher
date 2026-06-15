from fastapi import APIRouter, HTTPException, Request

from app.catalog.loader import load_catalog
from app.catalog.store import catalog_stats, set_catalog
from app.core.config import settings
from app.metrics import catalog_products_total, catalog_versions_total

router = APIRouter()


@router.post(
    "/admin/reload",
    summary="Re-scan FIRMWARE_DIR and refresh the in-memory catalogue",
)
async def reload_catalog(request: Request) -> dict[str, object]:
    if not settings.admin_token:
        raise HTTPException(status_code=403, detail="Admin reload is disabled (no ADMIN_TOKEN set)")

    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer ") or auth.removeprefix("Bearer ") != settings.admin_token:
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token")

    try:
        products = load_catalog(settings.firmware_dir, fail_on_empty=False)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    set_catalog(products)
    stats = catalog_stats()
    catalog_products_total.set(stats["products"])
    catalog_versions_total.set(stats["versions"])

    return {"status": "reloaded", **stats}

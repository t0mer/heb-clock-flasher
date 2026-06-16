from datetime import datetime, timezone

from fastapi import APIRouter
from starlette.responses import Response

from app.catalog.store import get_catalog
from app.core.config import settings

router = APIRouter()


def _base_url() -> str:
    url = settings.site_url.rstrip("/")
    return url or "https://example.com"


@router.get("/robots.txt", include_in_schema=False)
async def robots_txt() -> Response:
    base = _base_url()
    content = "\n".join([
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "",
        f"Sitemap: {base}/sitemap.xml",
        "",
    ])
    return Response(content=content, media_type="text/plain")


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml() -> Response:
    base = _base_url()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    products = get_catalog()

    urls: list[tuple[str, str, str]] = [
        (f"{base}/", now, "daily"),
    ]
    for product in products:
        urls.append((f"{base}/products/{product.slug}", now, "weekly"))
        urls.append((f"{base}/products/{product.slug}/flash", now, "monthly"))

    loc_tags = "\n".join(
        f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>{freq}</changefreq>
  </url>"""
        for loc, lastmod, freq in urls
    )

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{loc_tags}
</urlset>"""
    return Response(content=xml, media_type="application/xml")


@router.get("/api/v1/config")
async def public_config() -> dict[str, str]:
    return {
        "google_tag_id": settings.google_tag_id,
        "site_url": settings.site_url,
    }

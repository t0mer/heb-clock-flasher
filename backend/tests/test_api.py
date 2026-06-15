"""
API integration tests.

Uses the `client` fixture from conftest.py which pre-loads a catalog without
running the FastAPI lifespan, so tests stay fast and hermetic.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.catalog.store import set_catalog
from app.core.config import settings
from app.main import app


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


def test_health_ok(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert body["products"] == 1
    assert body["versions"] == 2


def test_health_empty_catalog(client: TestClient) -> None:
    set_catalog([])
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["products"] == 0


# ---------------------------------------------------------------------------
# GET /metrics
# ---------------------------------------------------------------------------


def test_metrics_returns_prometheus_format(client: TestClient) -> None:
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "text/plain" in r.headers["content-type"]
    # Prometheus exposition format always starts with a comment or metric line.
    assert r.text.startswith("#") or r.text.strip() == ""


def test_metrics_contains_catalog_gauge(client: TestClient) -> None:
    r = client.get("/metrics")
    assert "esp_flasher_catalog_products_total" in r.text


# ---------------------------------------------------------------------------
# GET /api/v1/products
# ---------------------------------------------------------------------------


def test_list_products_returns_one(client: TestClient) -> None:
    r = client.get("/api/v1/products")
    assert r.status_code == 200
    products = r.json()
    assert len(products) == 1
    assert products[0]["slug"] == "test-device"
    assert products[0]["name"] == "Test Device"


def test_list_products_latest_version(client: TestClient) -> None:
    r = client.get("/api/v1/products")
    p = r.json()[0]
    # Latest must be the highest version numerically.
    assert p["latest_version"] == "2026.9.0"
    assert p["latest_chip_family"] == "esp32c3"


def test_list_products_empty(client: TestClient) -> None:
    set_catalog([])
    r = client.get("/api/v1/products")
    assert r.status_code == 200
    assert r.json() == []


# ---------------------------------------------------------------------------
# GET /api/v1/products/{slug}
# ---------------------------------------------------------------------------


def test_product_detail_ok(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device")
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "test-device"
    assert body["summary"] == "Full summary here."
    assert body["repo"] == "https://github.com/t0mer/test-device"
    assert body["links"]["setup_guide"] == "https://example.com/setup"
    assert "Feature A" in body["features"]
    assert "XIAO ESP32-C3" in body["hardware"]


def test_product_detail_versions_sorted_newest_first(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device")
    versions = r.json()["versions"]
    assert versions[0]["version"] == "2026.9.0"
    assert versions[1]["version"] == "2026.6.0"


def test_product_detail_not_found(client: TestClient) -> None:
    r = client.get("/api/v1/products/does-not-exist")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/v1/products/{slug}/versions
# ---------------------------------------------------------------------------


def test_list_versions(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions")
    assert r.status_code == 200
    versions = r.json()
    assert len(versions) == 2
    assert versions[0]["version"] == "2026.9.0"


def test_list_versions_product_not_found(client: TestClient) -> None:
    r = client.get("/api/v1/products/ghost/versions")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/v1/products/{slug}/versions/{version}
# ---------------------------------------------------------------------------


def test_get_version_detail(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/2026.6.0")
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == "2026.6.0"
    assert body["chip_family"] == "esp32c3"
    assert body["console"]["baud"] == 115200
    assert body["flash"]["baud"] == 921600
    assert body["notes"] == "Hold BOOT to enter download mode."


def test_get_version_parts_have_hex_offsets(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/2026.6.0")
    parts = r.json()["parts"]
    offsets = {p["file"]: p["offset"] for p in parts}
    assert offsets["bootloader.bin"] == "0x0"
    assert offsets["partitions.bin"] == "0x8000"
    assert offsets["boot_app0.bin"] == "0xe000"
    assert offsets["app.bin"] == "0x10000"


def test_get_version_not_found(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/1999.1.0")
    assert r.status_code == 404


def test_get_version_product_not_found(client: TestClient) -> None:
    r = client.get("/api/v1/products/ghost/versions/2026.6.0")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/v1/products/{slug}/versions/{version}/parts/{file}
# ---------------------------------------------------------------------------


def test_serve_part_ok(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/2026.6.0/parts/app.bin")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/octet-stream"
    assert len(r.content) == 256  # our dummy files are 256 bytes


def test_serve_part_caching_headers(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/2026.6.0/parts/app.bin")
    assert r.status_code == 200
    cc = r.headers["cache-control"]
    assert "immutable" in cc
    assert "max-age=31536000" in cc
    assert "ETag" in r.headers or "etag" in r.headers


def test_serve_part_conditional_get(client: TestClient) -> None:
    r1 = client.get("/api/v1/products/test-device/versions/2026.6.0/parts/app.bin")
    etag = r1.headers.get("etag") or r1.headers.get("ETag")
    assert etag is not None

    r2 = client.get(
        "/api/v1/products/test-device/versions/2026.6.0/parts/app.bin",
        headers={"if-none-match": etag},
    )
    assert r2.status_code == 304


def test_serve_part_product_not_found(client: TestClient) -> None:
    r = client.get("/api/v1/products/ghost/versions/2026.6.0/parts/app.bin")
    assert r.status_code == 404


def test_serve_part_version_not_found(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/1999.1.0/parts/app.bin")
    assert r.status_code == 404


def test_serve_part_file_not_in_manifest(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/2026.6.0/parts/secret.bin")
    assert r.status_code == 404


def test_serve_part_traversal_rejected(client: TestClient) -> None:
    """Path traversal attempts are blocked at the catalog whitelist check."""
    r = client.get(
        "/api/v1/products/test-device/versions/2026.6.0/parts/..%2F..%2Fetc%2Fpasswd"
    )
    assert r.status_code == 404


def test_serve_part_traversal_dotdot_rejected(client: TestClient) -> None:
    r = client.get(
        "/api/v1/products/test-device/versions/2026.6.0/parts/../../product.yaml"
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/v1/products/{slug}/images/{file:path}
# ---------------------------------------------------------------------------


def test_serve_image_ok(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/images/assets/hero.jpeg")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"


def test_serve_image_not_in_product_list(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/images/assets/secret.png")
    assert r.status_code == 404


def test_serve_image_product_not_found(client: TestClient) -> None:
    r = client.get("/api/v1/products/ghost/images/hero.jpeg")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/v1/products/{slug}/versions/{version}/esp-web-tools.json
# ---------------------------------------------------------------------------


def test_esp_web_tools_manifest_structure(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/2026.6.0/esp-web-tools.json")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Test Device"
    assert body["version"] == "2026.6.0"
    assert "builds" in body
    assert len(body["builds"]) == 1
    build = body["builds"][0]
    assert build["chipFamily"] == "ESP32-C3"
    assert any(p["path"].endswith("app.bin") for p in build["parts"])


def test_esp_web_tools_manifest_part_offsets_are_integers(client: TestClient) -> None:
    r = client.get("/api/v1/products/test-device/versions/2026.6.0/esp-web-tools.json")
    parts = r.json()["builds"][0]["parts"]
    offsets = {p["path"].split("/")[-1]: p["offset"] for p in parts}
    assert offsets["bootloader.bin"] == 0x00000
    assert offsets["app.bin"] == 0x10000


def test_esp_web_tools_not_found(client: TestClient) -> None:
    r = client.get("/api/v1/products/ghost/versions/2026.6.0/esp-web-tools.json")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/v1/admin/reload
# ---------------------------------------------------------------------------


def test_admin_reload_disabled_when_no_token(client: TestClient) -> None:
    r = client.post("/api/v1/admin/reload")
    assert r.status_code == 403


def test_admin_reload_wrong_token(
    firmware_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "admin_token", "correct-token")
    monkeypatch.setattr(settings, "firmware_dir", str(firmware_root))
    from app.catalog.loader import load_catalog as lc
    from app.catalog.store import set_catalog as sc
    sc(lc(firmware_root))

    c = TestClient(app)
    r = c.post("/api/v1/admin/reload", headers={"Authorization": "Bearer wrong-token"})
    assert r.status_code == 401


def test_admin_reload_success(
    firmware_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "admin_token", "secret")
    monkeypatch.setattr(settings, "firmware_dir", str(firmware_root))
    from app.catalog.loader import load_catalog as lc
    from app.catalog.store import set_catalog as sc
    sc(lc(firmware_root))

    c = TestClient(app)
    r = c.post("/api/v1/admin/reload", headers={"Authorization": "Bearer secret"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "reloaded"
    assert body["products"] == 1

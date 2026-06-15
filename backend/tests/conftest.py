"""
Shared test fixtures for API tests.

The `client` fixture sets up:
  1. A temporary firmware directory with one valid product + two versions.
  2. Patches settings.firmware_dir to point there.
  3. Pre-loads the catalog into the in-memory store (bypasses lifespan).
  4. Returns a Starlette TestClient wrapping the FastAPI app.

Fixtures that need the raw firmware path use `firmware_root` directly.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from app.catalog.loader import load_catalog
from app.catalog.store import set_catalog
from app.core.config import settings
from app.main import app

# ---------------------------------------------------------------------------
# Canonical fixture data
# ---------------------------------------------------------------------------

PRODUCT_META = {
    "slug": "test-device",
    "name": "Test Device",
    "tagline": "A test ESP32-C3 gadget",
    "summary": "Full summary here.",
    "repo": "https://github.com/t0mer/test-device",
    "license": "Apache-2.0",
    "chip_families": ["esp32c3"],
    "hardware": ["XIAO ESP32-C3"],
    "images": ["assets/hero.jpeg"],
    "features": ["Feature A"],
    "links": {"setup_guide": "https://example.com/setup"},
    "order": 1,
}

MANIFEST_V1 = {
    "version": "2026.6.0",
    "chip_family": "esp32c3",
    "released": "2026-06-01",
    "changelog": "First release",
    "console": {"baud": 115200},
    "flash": {"erase_before": False, "baud": 921600},
    "parts": [
        {"file": "bootloader.bin", "offset": "0x0"},
        {"file": "partitions.bin", "offset": "0x8000"},
        {"file": "boot_app0.bin",  "offset": "0xe000"},
        {"file": "app.bin",        "offset": "0x10000"},
    ],
    "notes": "Hold BOOT to enter download mode.",
}

MANIFEST_V2 = {**MANIFEST_V1, "version": "2026.9.0", "changelog": "Second release"}

BIN_FILES = ["bootloader.bin", "partitions.bin", "boot_app0.bin", "app.bin"]


def _write(path: Path, data: object) -> None:
    path.write_text(yaml.dump(data), encoding="utf-8")


@pytest.fixture()
def firmware_root(tmp_path: Path) -> Path:
    """Populate a temporary FIRMWARE_DIR with one product and two versions."""
    prod = tmp_path / "test-device"
    prod.mkdir()
    _write(prod / "product.yaml", PRODUCT_META)

    # Hero image
    assets = prod / "assets"
    assets.mkdir()
    (assets / "hero.jpeg").write_bytes(b"\xff\xd8\xff")  # minimal JPEG header

    for manifest in (MANIFEST_V1, MANIFEST_V2):
        ver_dir = prod / manifest["version"]
        ver_dir.mkdir()
        _write(ver_dir / "manifest.yaml", manifest)
        for f in BIN_FILES:
            (ver_dir / f).write_bytes(b"\xff" * 256)

    return tmp_path


@pytest.fixture()
def client(firmware_root: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """TestClient with the catalog pre-loaded from firmware_root."""
    monkeypatch.setattr(settings, "firmware_dir", str(firmware_root))
    monkeypatch.setattr(settings, "admin_token", "")
    products = load_catalog(firmware_root)
    set_catalog(products)
    return TestClient(app, raise_server_exceptions=True)

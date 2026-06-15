"""
Tests for the filesystem-backed catalogue loader.

Covers: valid load, malformed YAML, missing part file, offset collision,
numeric version sorting, empty firmware dir, and product with no valid versions.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from app.catalog.loader import load_catalog
from app.catalog.models import ChipFamily, Part, Product, FirmwareVersion

# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------

VALID_PRODUCT_META = {
    "slug": "test-device",
    "name": "Test Device",
    "tagline": "A test ESP device",
    "chip_families": ["esp32c3"],
    "order": 1,
}

VALID_MANIFEST = {
    "version": "2026.6.0",
    "chip_family": "esp32c3",
    "released": "2026-06-10",
    "changelog": "Initial release",
    "console": {"baud": 115200},
    "flash": {"erase_before": False, "baud": 921600},
    "parts": [
        {"file": "bootloader.bin", "offset": "0x0"},
        {"file": "partitions.bin", "offset": "0x8000"},
        {"file": "boot_app0.bin", "offset": "0xe000"},
        {"file": "app.bin", "offset": "0x10000"},
    ],
}

BIN_FILES = ["bootloader.bin", "partitions.bin", "boot_app0.bin", "app.bin"]


def _write_yaml(path: Path, data: object) -> None:
    path.write_text(yaml.dump(data), encoding="utf-8")


def _make_product_dir(
    firmware_root: Path,
    slug: str = "test-device",
    product_meta: dict | None = None,  # type: ignore[type-arg]
) -> Path:
    d = firmware_root / slug
    d.mkdir(parents=True)
    _write_yaml(d / "product.yaml", product_meta or {**VALID_PRODUCT_META, "slug": slug})
    return d


def _make_version_dir(
    product_dir: Path,
    version: str = "2026.6.0",
    manifest: dict | None = None,  # type: ignore[type-arg]
    bins: list[str] | None = None,
) -> Path:
    d = product_dir / version
    d.mkdir(parents=True)
    m = {**VALID_MANIFEST, "version": version} if manifest is None else manifest
    _write_yaml(d / "manifest.yaml", m)
    for f in (bins if bins is not None else BIN_FILES):
        (d / f).write_bytes(b"\xff" * 16)
    return d


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


def test_load_single_valid_product(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    _make_version_dir(pd)

    products = load_catalog(tmp_path, fail_on_empty=True)

    assert len(products) == 1
    p = products[0]
    assert p.slug == "test-device"
    assert p.name == "Test Device"
    assert len(p.versions) == 1
    assert p.latest is not None
    assert p.latest.version == "2026.6.0"
    assert p.latest.chip_family == ChipFamily.esp32c3


def test_version_parts_offsets_parsed(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    _make_version_dir(pd)

    products = load_catalog(tmp_path)
    parts = products[0].latest.parts  # type: ignore[union-attr]

    assert parts[0].file == "bootloader.bin"
    assert parts[0].offset == 0x00000
    assert parts[1].offset == 0x08000
    assert parts[2].offset == 0x0E000
    assert parts[3].offset == 0x10000


def test_hex_offset_as_integer_in_yaml(tmp_path: Path) -> None:
    """PyYAML parses unquoted 0x... as integers — both forms must work."""
    pd = _make_product_dir(tmp_path)
    manifest = {
        **VALID_MANIFEST,
        "parts": [
            {"file": "app.bin", "offset": 0x10000},  # int, not string
        ],
    }
    _make_version_dir(pd, manifest=manifest, bins=["app.bin"])

    products = load_catalog(tmp_path)
    assert products[0].latest.parts[0].offset == 0x10000  # type: ignore[union-attr]


def test_latest_points_to_newest_version(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    _make_version_dir(pd, "2026.6.0")
    _make_version_dir(pd, "2026.9.0")

    products = load_catalog(tmp_path)
    assert products[0].latest is not None
    assert products[0].latest.version == "2026.9.0"


def test_version_sort_is_numeric_not_lexical(tmp_path: Path) -> None:
    """2026.10.0 > 2026.9.0 numerically, but '2026.10.0' < '2026.9.0' lexically."""
    pd = _make_product_dir(tmp_path)
    for v in ["2026.1.0", "2026.9.0", "2026.10.0", "2025.12.0"]:
        _make_version_dir(pd, v)

    products = load_catalog(tmp_path)
    order = [v.version for v in products[0].versions]
    assert order == ["2026.10.0", "2026.9.0", "2026.1.0", "2025.12.0"]


def test_multiple_products_sorted_by_order(tmp_path: Path) -> None:
    for slug, order in [("beta", 2), ("alpha", 1)]:
        pd = _make_product_dir(tmp_path, slug, {**VALID_PRODUCT_META, "slug": slug, "order": order})
        _make_version_dir(pd)

    products = load_catalog(tmp_path)
    assert [p.slug for p in products] == ["alpha", "beta"]


# ---------------------------------------------------------------------------
# Error-handling tests — bad versions are skipped, product survives
# ---------------------------------------------------------------------------


def test_malformed_manifest_yaml_skips_version(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    ver_dir = pd / "2026.6.0"
    ver_dir.mkdir()
    (ver_dir / "manifest.yaml").write_text(": : invalid yaml {{", encoding="utf-8")
    # Second valid version
    _make_version_dir(pd, "2026.5.0")

    products = load_catalog(tmp_path)
    assert len(products) == 1
    assert len(products[0].versions) == 1
    assert products[0].versions[0].version == "2026.5.0"


def test_missing_required_manifest_field_skips_version(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    bad = {**VALID_MANIFEST}
    del bad["chip_family"]  # required field
    _make_version_dir(pd, manifest=bad)

    # Product loads but has zero versions.
    products = load_catalog(tmp_path, fail_on_empty=False)
    assert products[0].versions == []


def test_missing_part_file_skips_version(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    # Declare four parts but only write three to disk.
    _make_version_dir(pd, bins=["bootloader.bin", "partitions.bin", "app.bin"])

    products = load_catalog(tmp_path, fail_on_empty=False)
    assert products[0].versions == []


def test_offset_collision_skips_version(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    manifest = {
        **VALID_MANIFEST,
        "parts": [
            {"file": "bootloader.bin", "offset": "0x0"},
            {"file": "app.bin",        "offset": "0x0"},  # duplicate!
        ],
    }
    _make_version_dir(pd, manifest=manifest, bins=["bootloader.bin", "app.bin"])

    products = load_catalog(tmp_path, fail_on_empty=False)
    assert products[0].versions == []


def test_no_manifest_yaml_skips_version_dir(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    stray = pd / "2026.6.0"
    stray.mkdir()
    # No manifest.yaml — just a stray directory.

    products = load_catalog(tmp_path, fail_on_empty=False)
    assert products[0].versions == []


def test_invalid_version_string_skips_version(tmp_path: Path) -> None:
    pd = _make_product_dir(tmp_path)
    bad = {**VALID_MANIFEST, "version": "v1.2.3"}  # wrong format
    _make_version_dir(pd, manifest=bad)

    products = load_catalog(tmp_path, fail_on_empty=False)
    assert products[0].versions == []


# ---------------------------------------------------------------------------
# Error-handling tests — bad product.yaml
# ---------------------------------------------------------------------------


def test_malformed_product_yaml_skips_product(tmp_path: Path) -> None:
    pd = tmp_path / "bad-product"
    pd.mkdir()
    (pd / "product.yaml").write_text(": {{bad yaml", encoding="utf-8")
    _make_version_dir(pd)

    products = load_catalog(tmp_path, fail_on_empty=False)
    assert products == []


def test_no_product_yaml_skips_directory(tmp_path: Path) -> None:
    stray = tmp_path / "not-a-product"
    stray.mkdir()
    (stray / "some_file.txt").write_text("hello")

    products = load_catalog(tmp_path, fail_on_empty=False)
    assert products == []


# ---------------------------------------------------------------------------
# Empty / missing FIRMWARE_DIR
# ---------------------------------------------------------------------------


def test_empty_firmware_dir_fail_on_empty_true(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="No valid products"):
        load_catalog(tmp_path, fail_on_empty=True)


def test_empty_firmware_dir_fail_on_empty_false(tmp_path: Path) -> None:
    products = load_catalog(tmp_path, fail_on_empty=False)
    assert products == []


def test_missing_firmware_dir_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_catalog(tmp_path / "does-not-exist")


# ---------------------------------------------------------------------------
# Model unit tests
# ---------------------------------------------------------------------------


def test_part_parses_hex_string() -> None:
    p = Part(file="app.bin", offset="0x10000")  # type: ignore[arg-type]
    assert p.offset == 0x10000


def test_part_parses_decimal_string() -> None:
    p = Part(file="app.bin", offset="65536")  # type: ignore[arg-type]
    assert p.offset == 65536


def test_part_rejects_negative_offset() -> None:
    with pytest.raises(Exception):
        Part(file="app.bin", offset=-1)  # type: ignore[arg-type]


def test_firmware_version_rejects_bad_version_string() -> None:
    with pytest.raises(Exception):
        FirmwareVersion(
            version="v1.0",
            chip_family=ChipFamily.esp32c3,
            parts=[Part(file="app.bin", offset=0x10000)],
        )


def test_firmware_version_detects_offset_collision() -> None:
    with pytest.raises(Exception):
        FirmwareVersion(
            version="2026.6.0",
            chip_family=ChipFamily.esp32c3,
            parts=[
                Part(file="bootloader.bin", offset=0x0),
                Part(file="app.bin", offset=0x0),  # collision
            ],
        )


def test_slug_override_from_directory_name(tmp_path: Path) -> None:
    """If product.yaml slug != dir name, loader uses the directory name."""
    pd = _make_product_dir(tmp_path, "real-slug", {**VALID_PRODUCT_META, "slug": "wrong-slug"})
    _make_version_dir(pd)

    products = load_catalog(tmp_path)
    assert products[0].slug == "real-slug"

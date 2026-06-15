"""
Round-trip tests for scripts/import_firmware.py.

Strategy: build a fake Arduino build directory with dummy .bin files, call
run_import() directly, then validate the result by loading it through the
server's Pydantic models (loader.load_catalog).  This guarantees that whatever
the import script produces, the server will accept.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

# Make the scripts/ directory importable.
_SCRIPTS = Path(__file__).resolve().parent.parent.parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from import_firmware import (  # noqa: E402
    find_arduino_bins,
    find_boot_app0,
    run_import,
)
from app.catalog.loader import load_catalog  # noqa: E402

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PRODUCT_META = {
    "slug": "test-device",
    "name": "Test Device",
    "tagline": "Testing",
    "chip_families": ["esp32c3"],
    "order": 1,
}


def _make_build_dir(
    tmp_path: Path,
    *,
    sketch: str = "Sketch",
    include_boot_app0: bool = True,
) -> Path:
    """Create a fake Arduino build directory with dummy .bin files."""
    build = tmp_path / "build"
    build.mkdir()
    (build / f"{sketch}.bin").write_bytes(b"\xAA" * 1024)
    (build / f"{sketch}.bootloader.bin").write_bytes(b"\xBB" * 512)
    (build / f"{sketch}.partitions.bin").write_bytes(b"\xCC" * 256)
    if include_boot_app0:
        (build / "boot_app0.bin").write_bytes(b"\xDD" * 128)
    # Noise files that must be ignored.
    (build / f"{sketch}.elf").write_bytes(b"\x00")
    (build / f"{sketch}.map").write_bytes(b"\x00")
    return build


def _make_firmware_dir(tmp_path: Path, slug: str = "test-device") -> Path:
    fw = tmp_path / "firmware"
    fw.mkdir()
    prod = fw / slug
    prod.mkdir()
    (prod / "product.yaml").write_text(yaml.dump({**_PRODUCT_META, "slug": slug}))
    return fw


# ---------------------------------------------------------------------------
# find_arduino_bins tests
# ---------------------------------------------------------------------------


def test_find_bins_happy_path(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path)
    bins = find_arduino_bins(build)
    assert set(bins.keys()) == {"bootloader", "partitions", "app"}
    assert bins["app"].name == "Sketch.bin"
    assert bins["bootloader"].name == "Sketch.bootloader.bin"
    assert bins["partitions"].name == "Sketch.partitions.bin"


def test_find_bins_ignores_elf_and_map(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path)
    bins = find_arduino_bins(build)
    names = {p.name for p in bins.values()}
    assert not any(n.endswith((".elf", ".map")) for n in names)


def test_find_bins_ignores_boot_app0_and_merged(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path)
    (build / "merged.bin").write_bytes(b"\xff")
    bins = find_arduino_bins(build)
    assert "merged" not in bins
    assert "boot_app0" not in bins


def test_find_bins_missing_bootloader_raises(tmp_path: Path) -> None:
    build = tmp_path / "build"
    build.mkdir()
    (build / "app.bin").write_bytes(b"x")
    (build / "app.partitions.bin").write_bytes(b"x")
    with pytest.raises(FileNotFoundError, match="bootloader"):
        find_arduino_bins(build)


def test_find_bins_missing_app_raises(tmp_path: Path) -> None:
    build = tmp_path / "build"
    build.mkdir()
    (build / "sketch.bootloader.bin").write_bytes(b"x")
    (build / "sketch.partitions.bin").write_bytes(b"x")
    with pytest.raises(FileNotFoundError, match="application"):
        find_arduino_bins(build)


def test_find_bins_ambiguous_app_raises(tmp_path: Path) -> None:
    build = tmp_path / "build"
    build.mkdir()
    (build / "a.bin").write_bytes(b"x")
    (build / "b.bin").write_bytes(b"x")
    (build / "x.bootloader.bin").write_bytes(b"x")
    (build / "x.partitions.bin").write_bytes(b"x")
    with pytest.raises(ValueError, match="Ambiguous"):
        find_arduino_bins(build)


# ---------------------------------------------------------------------------
# find_boot_app0 tests
# ---------------------------------------------------------------------------


def test_find_boot_app0_in_build_dir(tmp_path: Path) -> None:
    build = tmp_path / "build"
    build.mkdir()
    b0 = build / "boot_app0.bin"
    b0.write_bytes(b"\xDD")
    result = find_boot_app0(build, None, None)
    assert result == b0


def test_find_boot_app0_explicit_path(tmp_path: Path) -> None:
    explicit = tmp_path / "boot_app0.bin"
    explicit.write_bytes(b"\xDD")
    result = find_boot_app0(tmp_path / "build", None, explicit)
    assert result == explicit


def test_find_boot_app0_arduino_core(tmp_path: Path) -> None:
    core = tmp_path / "core"
    b0 = core / "tools" / "partitions" / "boot_app0.bin"
    b0.parent.mkdir(parents=True)
    b0.write_bytes(b"\xDD")
    result = find_boot_app0(tmp_path / "build", core, None)
    assert result == b0


def test_find_boot_app0_not_found_raises(tmp_path: Path) -> None:
    build = tmp_path / "build"
    build.mkdir()
    with pytest.raises(FileNotFoundError):
        find_boot_app0(build, None, None)


def test_find_boot_app0_explicit_missing_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="--boot-app0"):
        find_boot_app0(tmp_path, None, tmp_path / "nonexistent.bin")


# ---------------------------------------------------------------------------
# run_import round-trip tests
# ---------------------------------------------------------------------------


def test_round_trip_basic(tmp_path: Path) -> None:
    """Full import → server validation round trip."""
    build = _make_build_dir(tmp_path)
    fw_dir = _make_firmware_dir(tmp_path)

    out_dir = run_import(
        product="test-device",
        version="2026.6.0",
        chip="esp32c3",
        build_dir=build,
        firmware_dir=fw_dir,
        released="2026-06-10",
        changelog="First release",
    )

    assert out_dir.is_dir()
    assert (out_dir / "manifest.yaml").exists()
    assert (out_dir / "bootloader.bin").exists()
    assert (out_dir / "partitions.bin").exists()
    assert (out_dir / "boot_app0.bin").exists()
    assert (out_dir / "app.bin").exists()

    # Load through the server's catalog loader.
    products = load_catalog(fw_dir, fail_on_empty=True)
    assert len(products) == 1
    assert len(products[0].versions) == 1
    v = products[0].versions[0]
    assert v.version == "2026.6.0"
    assert v.chip_family.value == "esp32c3"
    assert len(v.parts) == 4


def test_round_trip_offsets_match_table(tmp_path: Path) -> None:
    """Offsets written in manifest must match the shared offset table."""
    build = _make_build_dir(tmp_path)
    fw_dir = _make_firmware_dir(tmp_path)

    run_import(
        product="test-device",
        version="2026.6.0",
        chip="esp32c3",
        build_dir=build,
        firmware_dir=fw_dir,
    )

    manifest = yaml.safe_load(
        (fw_dir / "test-device" / "2026.6.0" / "manifest.yaml").read_text()
    )
    offsets = {p["file"]: p["offset"] for p in manifest["parts"]}
    assert offsets["bootloader.bin"] == "0x0"
    assert offsets["partitions.bin"] == "0x8000"
    assert offsets["boot_app0.bin"] == "0xe000"
    assert offsets["app.bin"] == "0x10000"


def test_round_trip_esp32_classic_bootloader_offset(tmp_path: Path) -> None:
    """Classic ESP32 bootloader must land at 0x1000, not 0x0."""
    build = _make_build_dir(tmp_path)
    fw_dir = _make_firmware_dir(tmp_path)

    run_import(
        product="test-device",
        version="2026.6.0",
        chip="esp32",
        build_dir=build,
        firmware_dir=fw_dir,
    )

    manifest = yaml.safe_load(
        (fw_dir / "test-device" / "2026.6.0" / "manifest.yaml").read_text()
    )
    offsets = {p["file"]: p["offset"] for p in manifest["parts"]}
    assert offsets["bootloader.bin"] == "0x1000"


def test_round_trip_flash_and_console_baud(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path)
    fw_dir = _make_firmware_dir(tmp_path)

    run_import(
        product="test-device",
        version="2026.6.0",
        chip="esp32c3",
        build_dir=build,
        firmware_dir=fw_dir,
        flash_baud=460800,
        console_baud=9600,
    )

    manifest = yaml.safe_load(
        (fw_dir / "test-device" / "2026.6.0" / "manifest.yaml").read_text()
    )
    assert manifest["flash"]["baud"] == 460800
    assert manifest["console"]["baud"] == 9600


def test_round_trip_released_date_defaults_to_today(tmp_path: Path) -> None:
    from datetime import date

    build = _make_build_dir(tmp_path)
    fw_dir = _make_firmware_dir(tmp_path)
    run_import(
        product="test-device",
        version="2026.6.0",
        chip="esp32c3",
        build_dir=build,
        firmware_dir=fw_dir,
    )

    manifest = yaml.safe_load(
        (fw_dir / "test-device" / "2026.6.0" / "manifest.yaml").read_text()
    )
    assert manifest["released"] == date.today().isoformat()


def test_round_trip_force_overwrites(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path)
    fw_dir = _make_firmware_dir(tmp_path)

    run_import(product="test-device", version="2026.6.0", chip="esp32c3",
               build_dir=build, firmware_dir=fw_dir)

    # Second import without --force should fail.
    with pytest.raises(FileExistsError):
        run_import(product="test-device", version="2026.6.0", chip="esp32c3",
                   build_dir=build, firmware_dir=fw_dir)

    # With --force it must succeed.
    run_import(product="test-device", version="2026.6.0", chip="esp32c3",
               build_dir=build, firmware_dir=fw_dir, force=True)


def test_round_trip_boot_app0_from_explicit_path(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path, include_boot_app0=False)
    fw_dir = _make_firmware_dir(tmp_path)
    explicit_b0 = tmp_path / "boot_app0.bin"
    explicit_b0.write_bytes(b"\xDD" * 64)

    out_dir = run_import(
        product="test-device",
        version="2026.6.0",
        chip="esp32c3",
        build_dir=build,
        firmware_dir=fw_dir,
        boot_app0=explicit_b0,
    )
    assert (out_dir / "boot_app0.bin").exists()


def test_round_trip_multiple_versions(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path)
    fw_dir = _make_firmware_dir(tmp_path)

    run_import(product="test-device", version="2026.6.0", chip="esp32c3",
               build_dir=build, firmware_dir=fw_dir)
    run_import(product="test-device", version="2026.9.0", chip="esp32c3",
               build_dir=build, firmware_dir=fw_dir)

    products = load_catalog(fw_dir, fail_on_empty=True)
    assert len(products[0].versions) == 2
    assert products[0].latest is not None
    assert products[0].latest.version == "2026.9.0"


# ---------------------------------------------------------------------------
# Error path tests
# ---------------------------------------------------------------------------


def test_unknown_chip_raises(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path)
    fw_dir = _make_firmware_dir(tmp_path)
    with pytest.raises(ValueError, match="Unknown chip"):
        run_import(product="test-device", version="2026.6.0", chip="esp32x99",
                   build_dir=build, firmware_dir=fw_dir)


def test_missing_product_dir_raises(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path)
    fw_dir = tmp_path / "firmware"
    fw_dir.mkdir()
    with pytest.raises(FileNotFoundError, match="Product directory"):
        run_import(product="ghost", version="2026.6.0", chip="esp32c3",
                   build_dir=build, firmware_dir=fw_dir)


def test_missing_boot_app0_raises(tmp_path: Path) -> None:
    build = _make_build_dir(tmp_path, include_boot_app0=False)
    fw_dir = _make_firmware_dir(tmp_path)
    with pytest.raises(FileNotFoundError, match="boot_app0"):
        run_import(product="test-device", version="2026.6.0", chip="esp32c3",
                   build_dir=build, firmware_dir=fw_dir)

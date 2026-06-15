#!/usr/bin/env python3
"""
import_firmware.py — import an Arduino firmware build into the flasher catalogue.

Usage
-----
    python scripts/import_firmware.py \\
        --product hebrew-clock \\
        --version 2026.6.0 \\
        --chip esp32c3 \\
        --build-dir /path/to/arduino/build/dir \\
        [--arduino-core /path/to/esp32/hardware/esp32/<version>] \\
        [--boot-app0  /path/to/boot_app0.bin] \\
        [--firmware-dir ./firmware] \\
        [--merge] \\
        [--force] \\
        [--baud 921600] \\
        [--console-baud 115200] \\
        [--released 2026-06-10] \\
        [--changelog "Release notes"]

What it does
------------
1.  Finds Arduino output files in --build-dir by pattern:
      *.bootloader.bin  → bootloader
      *.partitions.bin  → partition table
      *.bin             → application  (any .bin not matching the above)
    Ignores *.elf, *.map, boot_app0.bin, merged.bin.

2.  Locates boot_app0.bin from (in order):
      a. --boot-app0 <path>
      b. --build-dir itself
      c. --arduino-core <core>/tools/partitions/boot_app0.bin

3.  Reads per-chip offsets from backend/app/catalog/offsets.py (the single
    source of truth shared with the server).

4.  Copies & renames files into firmware/<product>/<version>/ and writes a
    validated manifest.yaml.

5.  With --merge: invokes `python -m esptool merge_bin` to produce a single
    merged.bin at 0x0 and writes a one-part manifest instead.

6.  Validates the produced version directory by loading it through the same
    Pydantic models the server uses — guaranteeing the server will accept it.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

import yaml

# ---------------------------------------------------------------------------
# Make backend importable when script is run from the project root.
# ---------------------------------------------------------------------------
_HERE = Path(__file__).resolve().parent
_BACKEND = _HERE.parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.catalog.loader import _load_version  # noqa: E402 — after sys.path setup
from app.catalog.models import ChipFamily  # noqa: E402
from app.catalog.offsets import CHIP_PART_TEMPLATES  # noqa: E402

# Canonical output file names (server / loader expect these).
_CANONICAL = {
    "bootloader": "bootloader.bin",
    "partitions": "partitions.bin",
    "boot_app0":  "boot_app0.bin",
    "app":        "app.bin",
    "merged":     "merged.bin",
}


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------

def find_arduino_bins(build_dir: Path) -> dict[str, Path]:
    """
    Scan build_dir for Arduino output binaries.

    Returns a dict with keys 'bootloader', 'partitions', 'app'.
    Raises FileNotFoundError if any are missing or ambiguous.
    """
    all_bins = [
        f for f in build_dir.glob("*.bin")
        if f.name not in {"boot_app0.bin", "merged.bin"}
    ]

    bootloaders = [f for f in all_bins if f.name.endswith(".bootloader.bin")]
    partitions  = [f for f in all_bins if f.name.endswith(".partitions.bin")]
    apps = [
        f for f in all_bins
        if not f.name.endswith((".bootloader.bin", ".partitions.bin"))
    ]

    def _one(label: str, found: list[Path]) -> Path:
        if not found:
            raise FileNotFoundError(f"No {label} binary found in {build_dir}")
        if len(found) > 1:
            raise ValueError(
                f"Ambiguous {label} — found multiple candidates: "
                + ", ".join(f.name for f in found)
                + f". Remove duplicates from {build_dir}."
            )
        return found[0]

    return {
        "bootloader": _one("bootloader (*.bootloader.bin)", bootloaders),
        "partitions":  _one("partition table (*.partitions.bin)", partitions),
        "app":         _one("application (*.bin)", apps),
    }


def find_boot_app0(
    build_dir: Path,
    arduino_core: Path | None,
    explicit: Path | None,
) -> Path:
    """
    Locate boot_app0.bin. Search order:
      1. --boot-app0 <explicit path>
      2. <build_dir>/boot_app0.bin
      3. <arduino_core>/tools/partitions/boot_app0.bin
    """
    if explicit is not None:
        if not explicit.is_file():
            raise FileNotFoundError(f"--boot-app0 path not found: {explicit}")
        return explicit

    in_build = build_dir / "boot_app0.bin"
    if in_build.is_file():
        return in_build

    if arduino_core is not None:
        in_core = arduino_core / "tools" / "partitions" / "boot_app0.bin"
        if in_core.is_file():
            return in_core
        raise FileNotFoundError(
            f"boot_app0.bin not found in Arduino core at {in_core}. "
            "Check --arduino-core points to the esp32 hardware directory "
            "(e.g. ~/.arduino15/packages/esp32/hardware/esp32/2.0.14)."
        )

    raise FileNotFoundError(
        "boot_app0.bin not found. Provide one of:\n"
        "  --boot-app0 <path>            direct path\n"
        "  --arduino-core <core-path>    path to Arduino ESP32 core\n"
        "  (or place boot_app0.bin in --build-dir)"
    )


# ---------------------------------------------------------------------------
# Manifest generation
# ---------------------------------------------------------------------------

def _build_parts_data(
    chip: str,
    out_dir: Path,
    *,
    merged: bool = False,
) -> list[dict[str, str]]:
    """Return the parts list for manifest.yaml (offsets as hex strings)."""
    if merged:
        return [{"file": _CANONICAL["merged"], "offset": "0x0"}]

    templates = CHIP_PART_TEMPLATES.get(chip)
    if not templates:
        raise ValueError(f"No offset table for chip {chip!r}")

    parts = []
    for tpl in templates:
        fname = _CANONICAL.get(tpl.name)
        if fname is None:
            fname = f"{tpl.name}.bin"
        if not (out_dir / fname).is_file():
            raise FileNotFoundError(f"Expected part file {fname!r} not found in {out_dir}")
        parts.append({"file": fname, "offset": hex(tpl.offset)})
    return parts


def write_manifest(
    out_dir: Path,
    *,
    version: str,
    chip: str,
    parts: list[dict[str, str]],
    flash_baud: int,
    console_baud: int,
    released: str,
    changelog: str,
    notes: str,
) -> Path:
    data = {
        "version": version,
        "chip_family": chip,
        "released": released,
        "changelog": changelog,
        "console": {"baud": console_baud},
        "flash": {"erase_before": False, "baud": flash_baud},
        "parts": parts,
        "notes": notes,
    }
    manifest_path = out_dir / "manifest.yaml"
    manifest_path.write_text(yaml.dump(data, allow_unicode=True), encoding="utf-8")
    return manifest_path


# ---------------------------------------------------------------------------
# Merge (optional, requires esptool)
# ---------------------------------------------------------------------------

def merge_bins(
    out_dir: Path,
    chip: str,
    parts: list[dict[str, str]],
) -> Path:
    """
    Invoke esptool merge_bin to produce merged.bin from the 4-part layout.
    Returns path to merged.bin.
    """
    try:
        subprocess.run(
            [sys.executable, "-m", "esptool", "--version"],
            check=True, capture_output=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        raise RuntimeError(
            "esptool is not installed. Install it with:\n"
            "  pip install esptool\n"
            "or provide pre-merged binaries."
        )

    merged = out_dir / _CANONICAL["merged"]
    cmd = [
        sys.executable, "-m", "esptool",
        "--chip", chip,
        "merge_bin",
        "-o", str(merged),
        "--flash_mode", "keep",
        "--flash_freq", "keep",
        "--flash_size", "keep",
    ]
    for part in parts:
        cmd += [part["offset"], str(out_dir / part["file"])]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"esptool merge_bin failed:\n{result.stderr}")

    return merged


# ---------------------------------------------------------------------------
# Main import logic (callable from tests)
# ---------------------------------------------------------------------------

def run_import(
    *,
    product: str,
    version: str,
    chip: str,
    build_dir: Path,
    firmware_dir: Path,
    arduino_core: Path | None = None,
    boot_app0: Path | None = None,
    merge: bool = False,
    force: bool = False,
    flash_baud: int = 921600,
    console_baud: int = 115200,
    released: str = "",
    changelog: str = "",
    notes: str = "",
) -> Path:
    """
    Core import logic.  Returns the populated version directory.

    Raises:
        ValueError       — bad arguments (unknown chip, duplicate files, etc.)
        FileNotFoundError — missing source files
        RuntimeError     — validation failure or merge failure
    """
    # Validate chip family against the enum.
    try:
        ChipFamily(chip)
    except ValueError:
        raise ValueError(
            f"Unknown chip family {chip!r}. "
            f"Supported: {[c.value for c in ChipFamily]}"
        )

    if not released:
        released = date.today().isoformat()

    # Ensure product directory exists in firmware_dir.
    product_dir = firmware_dir / product
    if not product_dir.is_dir():
        raise FileNotFoundError(
            f"Product directory {product_dir!r} does not exist. "
            "Create it with a product.yaml before importing firmware."
        )

    # Target version directory.
    out_dir = product_dir / version
    if out_dir.exists() and not force:
        raise FileExistsError(
            f"Version {version!r} already exists at {out_dir}. "
            "Use --force to overwrite."
        )
    out_dir.mkdir(parents=True, exist_ok=True)

    # Discover source files.
    bins = find_arduino_bins(build_dir)

    # For chips that need boot_app0 (all except esp8266 merged-only flows).
    chip_templates = CHIP_PART_TEMPLATES.get(chip, [])
    needs_boot_app0 = any(t.name == "boot_app0" for t in chip_templates)

    if needs_boot_app0 and not merge:
        b0 = find_boot_app0(build_dir, arduino_core, boot_app0)
        bins["boot_app0"] = b0

    # Copy files with canonical names.
    for name, src in bins.items():
        dst = out_dir / _CANONICAL[name]
        shutil.copy2(src, dst)
        print(f"  copied {src.name} → {dst.name}")

    # Merge path: produce merged.bin, then remove the 4 individual parts.
    if merge:
        four_part_parts = _build_parts_data(chip, out_dir, merged=False)
        # Temporarily ensure individual parts exist for esptool.
        merge_bins(out_dir, chip, four_part_parts)
        # Remove the 4-part files; keep only merged.bin.
        for part in four_part_parts:
            (out_dir / part["file"]).unlink(missing_ok=True)
        parts_data = _build_parts_data(chip, out_dir, merged=True)
    else:
        parts_data = _build_parts_data(chip, out_dir)

    manifest_path = write_manifest(
        out_dir,
        version=version,
        chip=chip,
        parts=parts_data,
        flash_baud=flash_baud,
        console_baud=console_baud,
        released=released,
        changelog=changelog,
        notes=notes,
    )
    print(f"  wrote {manifest_path}")

    # Validate: load the version directory through the server's Pydantic models.
    fw = _load_version(out_dir)
    if fw is None:
        raise RuntimeError(
            f"Validation failed — the produced manifest did not pass server validation. "
            f"Check {manifest_path} for errors."
        )

    print(f"\n✓ Imported {product} {version} ({chip}) — {len(fw.parts)} part(s)")
    print(f"  Output: {out_dir}")
    return out_dir


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Import an Arduino firmware build into the ESP Web Flasher catalogue."
    )
    p.add_argument("--product",      required=True, help="Product slug (must match firmware/<slug>/ dir)")
    p.add_argument("--version",      required=True, help="Version string YYYY.M.PATCH, e.g. 2026.6.0")
    p.add_argument("--chip",         required=True, help="Chip family: esp32c3, esp32, esp32s3, …")
    p.add_argument("--build-dir",    required=True, type=Path, help="Arduino build output directory")
    p.add_argument("--arduino-core", type=Path, default=None,
                   help="Arduino ESP32 core directory (to locate boot_app0.bin)")
    p.add_argument("--boot-app0",    type=Path, default=None,
                   help="Explicit path to boot_app0.bin (overrides --arduino-core)")
    p.add_argument("--firmware-dir", type=Path, default=Path("./firmware"),
                   help="Catalogue root directory (default: ./firmware)")
    p.add_argument("--merge",        action="store_true",
                   help="Produce a single merged.bin via esptool merge_bin")
    p.add_argument("--force",        action="store_true",
                   help="Overwrite an existing version directory")
    p.add_argument("--baud",         type=int, default=921600, help="Flash baud rate (default: 921600)")
    p.add_argument("--console-baud", type=int, default=115200, help="Serial console baud (default: 115200)")
    p.add_argument("--released",     default="", help="Release date YYYY-MM-DD (default: today)")
    p.add_argument("--changelog",    default="", help="Release notes / changelog text")
    p.add_argument("--notes",        default="", help="User-facing notes (shown on flash page)")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    try:
        run_import(
            product=args.product,
            version=args.version,
            chip=args.chip,
            build_dir=args.build_dir,
            firmware_dir=args.firmware_dir,
            arduino_core=args.arduino_core,
            boot_app0=args.boot_app0,
            merge=args.merge,
            force=args.force,
            flash_baud=args.baud,
            console_baud=args.console_baud,
            released=args.released,
            changelog=args.changelog,
            notes=args.notes,
        )
    except (ValueError, FileNotFoundError, FileExistsError, RuntimeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

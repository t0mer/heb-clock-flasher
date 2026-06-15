"""
Canonical flash offset table, shared by the loader (validation) and the
import script (manifest generation).  Update this file — not both separately.

ESP32-C3 / S3 / C6 / H2: bootloader lives at 0x0 (ROM bootloader loads it).
Classic ESP32 / S2:        bootloader lives at 0x1000 (different ROM layout).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PartTemplate:
    name: str      # logical name used by the import script for file naming
    offset: int    # flash offset in bytes


# Part templates per chip family.
# Key matches ChipFamily enum values (string form) — kept as plain strings
# here to avoid a circular import with models.py.
CHIP_PART_TEMPLATES: dict[str, list[PartTemplate]] = {
    "esp32c3": [
        PartTemplate("bootloader", 0x00000),
        PartTemplate("partitions", 0x08000),
        PartTemplate("boot_app0", 0x0E000),
        PartTemplate("app",       0x10000),
    ],
    "esp32s3": [
        PartTemplate("bootloader", 0x00000),
        PartTemplate("partitions", 0x08000),
        PartTemplate("boot_app0", 0x0E000),
        PartTemplate("app",       0x10000),
    ],
    "esp32c6": [
        PartTemplate("bootloader", 0x00000),
        PartTemplate("partitions", 0x08000),
        PartTemplate("boot_app0", 0x0E000),
        PartTemplate("app",       0x10000),
    ],
    "esp32h2": [
        PartTemplate("bootloader", 0x00000),
        PartTemplate("partitions", 0x08000),
        PartTemplate("boot_app0", 0x0E000),
        PartTemplate("app",       0x10000),
    ],
    # Classic ESP32 and S2 use 0x1000 for the bootloader.
    "esp32": [
        PartTemplate("bootloader", 0x01000),
        PartTemplate("partitions", 0x08000),
        PartTemplate("boot_app0", 0x0E000),
        PartTemplate("app",       0x10000),
    ],
    "esp32s2": [
        PartTemplate("bootloader", 0x01000),
        PartTemplate("partitions", 0x08000),
        PartTemplate("boot_app0", 0x0E000),
        PartTemplate("app",       0x10000),
    ],
    # ESP8266 uses a single merged image at 0x0.
    "esp8266": [
        PartTemplate("app", 0x00000),
    ],
}


def get_templates(chip_family: str) -> list[PartTemplate]:
    """Return the part templates for a chip family, or empty list if unknown."""
    return CHIP_PART_TEMPLATES.get(chip_family, [])

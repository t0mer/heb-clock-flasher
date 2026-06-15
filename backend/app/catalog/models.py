from __future__ import annotations

import re
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class ChipFamily(str, Enum):
    esp32 = "esp32"
    esp32c3 = "esp32c3"
    esp32s3 = "esp32s3"
    esp32c6 = "esp32c6"
    esp32s2 = "esp32s2"
    esp32h2 = "esp32h2"
    esp8266 = "esp8266"


class Part(BaseModel):
    file: str
    offset: int  # bytes; parsed from hex strings in YAML

    @field_validator("offset", mode="before")
    @classmethod
    def parse_hex_offset(cls, v: Any) -> int:
        if isinstance(v, str):
            try:
                return int(v, 16) if v.startswith(("0x", "0X")) else int(v)
            except ValueError:
                raise ValueError(f"Cannot parse offset {v!r} as integer")
        if isinstance(v, int):
            return v
        raise ValueError(f"Offset must be a string or int, got {type(v).__name__}")

    @field_validator("offset")
    @classmethod
    def offset_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError(f"Offset must be >= 0, got {v}")
        return v


class ConsoleConfig(BaseModel):
    baud: int = 115200


class FlashConfig(BaseModel):
    erase_before: bool = False
    baud: int = 921600


_VERSION_RE = re.compile(r"^\d{4}\.\d+\.\d+$")


def _version_sort_key(version_str: str) -> tuple[int, int, int]:
    """Numeric sort key for YYYY.M.PATCH strings (prevents lexical mis-ordering)."""
    y, m, p = version_str.split(".")
    return int(y), int(m), int(p)


class FirmwareVersion(BaseModel):
    version: str
    chip_family: ChipFamily
    released: str = ""
    changelog: str = ""
    console: ConsoleConfig = Field(default_factory=ConsoleConfig)
    flash: FlashConfig = Field(default_factory=FlashConfig)
    parts: list[Part]
    notes: str = ""

    @field_validator("version")
    @classmethod
    def validate_version_format(cls, v: str) -> str:
        if not _VERSION_RE.match(v):
            raise ValueError(
                f"Version must match YYYY.M.PATCH (e.g. 2026.6.0), got {v!r}"
            )
        return v

    @model_validator(mode="after")
    def check_no_offset_collision(self) -> "FirmwareVersion":
        offsets = [p.offset for p in self.parts]
        if len(offsets) != len(set(offsets)):
            seen: set[int] = set()
            dupes = [o for o in offsets if o in seen or seen.add(o)]  # type: ignore[func-returns-value]
            raise ValueError(
                f"Duplicate flash offsets in parts: {[hex(o) for o in dupes]}"
            )
        return self


class ProductLinks(BaseModel):
    setup_guide: str = ""


class Product(BaseModel):
    slug: str
    name: str
    tagline: str = ""
    summary: str = ""
    repo: str = ""
    license: str = "Apache-2.0"
    chip_families: list[ChipFamily] = Field(default_factory=list)
    hardware: list[str] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    links: ProductLinks = Field(default_factory=ProductLinks)
    order: int = 0
    versions: list[FirmwareVersion] = Field(default_factory=list)

    @property
    def latest(self) -> FirmwareVersion | None:
        return self.versions[0] if self.versions else None

    def sorted_versions(self) -> list[FirmwareVersion]:
        """Return versions sorted newest-first using numeric YYYY.M.PATCH ordering."""
        return sorted(self.versions, key=lambda v: _version_sort_key(v.version), reverse=True)

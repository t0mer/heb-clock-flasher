from __future__ import annotations

from pydantic import BaseModel, field_serializer

from app.catalog.models import (
    ChipFamily,
    FirmwareVersion,
    Part,
    Product,
)


class PartOut(BaseModel):
    file: str
    offset: str  # hex string, e.g. "0x10000"

    @classmethod
    def from_model(cls, part: Part) -> "PartOut":
        return cls(file=part.file, offset=hex(part.offset))


class ConsoleConfigOut(BaseModel):
    baud: int


class FlashConfigOut(BaseModel):
    erase_before: bool
    baud: int


class FirmwareVersionSummaryOut(BaseModel):
    version: str
    chip_family: str
    released: str
    changelog: str


class FirmwareVersionOut(BaseModel):
    version: str
    chip_family: str
    released: str
    changelog: str
    console: ConsoleConfigOut
    flash: FlashConfigOut
    parts: list[PartOut]
    notes: str

    @classmethod
    def from_model(cls, fw: FirmwareVersion) -> "FirmwareVersionOut":
        return cls(
            version=fw.version,
            chip_family=fw.chip_family.value,
            released=fw.released,
            changelog=fw.changelog,
            console=ConsoleConfigOut(baud=fw.console.baud),
            flash=FlashConfigOut(erase_before=fw.flash.erase_before, baud=fw.flash.baud),
            parts=[PartOut.from_model(p) for p in fw.parts],
            notes=fw.notes,
        )


class ProductLinksOut(BaseModel):
    setup_guide: str


class ProductSummaryOut(BaseModel):
    slug: str
    name: str
    tagline: str
    chip_families: list[str]
    order: int
    latest_version: str | None
    latest_chip_family: str | None

    @classmethod
    def from_model(cls, product: Product) -> "ProductSummaryOut":
        latest = product.latest
        return cls(
            slug=product.slug,
            name=product.name,
            tagline=product.tagline,
            chip_families=[cf.value for cf in product.chip_families],
            order=product.order,
            latest_version=latest.version if latest else None,
            latest_chip_family=latest.chip_family.value if latest else None,
        )


class ProductOut(BaseModel):
    slug: str
    name: str
    tagline: str
    summary: str
    repo: str
    license: str
    chip_families: list[str]
    hardware: list[str]
    images: list[str]
    features: list[str]
    links: ProductLinksOut
    order: int
    versions: list[FirmwareVersionSummaryOut]

    @classmethod
    def from_model(cls, product: Product) -> "ProductOut":
        return cls(
            slug=product.slug,
            name=product.name,
            tagline=product.tagline,
            summary=product.summary,
            repo=product.repo,
            license=product.license,
            chip_families=[cf.value for cf in product.chip_families],
            hardware=product.hardware,
            images=product.images,
            features=product.features,
            links=ProductLinksOut(setup_guide=product.links.setup_guide),
            order=product.order,
            versions=[
                FirmwareVersionSummaryOut(
                    version=v.version,
                    chip_family=v.chip_family.value,
                    released=v.released,
                    changelog=v.changelog,
                )
                for v in product.versions
            ],
        )

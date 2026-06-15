from fastapi import APIRouter, HTTPException

from app.api.v1.schemas import (
    FirmwareVersionOut,
    FirmwareVersionSummaryOut,
    ProductOut,
    ProductSummaryOut,
)
from app.catalog.store import get_catalog, get_product

router = APIRouter()


@router.get(
    "/products",
    response_model=list[ProductSummaryOut],
    summary="List all products",
)
async def list_products() -> list[ProductSummaryOut]:
    return [ProductSummaryOut.from_model(p) for p in get_catalog()]


@router.get(
    "/products/{slug}",
    response_model=ProductOut,
    summary="Product detail with version list",
)
async def get_product_detail(slug: str) -> ProductOut:
    product = get_product(slug)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {slug!r} not found")
    return ProductOut.from_model(product)


@router.get(
    "/products/{slug}/versions",
    response_model=list[FirmwareVersionSummaryOut],
    summary="List versions for a product",
)
async def list_versions(slug: str) -> list[FirmwareVersionSummaryOut]:
    product = get_product(slug)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {slug!r} not found")
    return [
        FirmwareVersionSummaryOut(
            version=v.version,
            chip_family=v.chip_family.value,
            released=v.released,
            changelog=v.changelog,
        )
        for v in product.versions
    ]


@router.get(
    "/products/{slug}/versions/{version}",
    response_model=FirmwareVersionOut,
    summary="Single firmware version with parts and flash config",
)
async def get_version(slug: str, version: str) -> FirmwareVersionOut:
    product = get_product(slug)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {slug!r} not found")
    fw = next((v for v in product.versions if v.version == version), None)
    if fw is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version!r} not found for product {slug!r}",
        )
    return FirmwareVersionOut.from_model(fw)

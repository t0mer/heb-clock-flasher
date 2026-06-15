"""
Filesystem-backed catalogue loader.

Layout expected under FIRMWARE_DIR:
  <product-slug>/
    product.yaml
    <YYYY.M.PATCH>/
      manifest.yaml
      *.bin

Rules:
- A malformed product.yaml skips the whole product (logged as error).
- A malformed manifest.yaml or missing part file skips that version only (logged as warning).
- Versions are sorted newest-first using numeric YYYY.M.PATCH ordering.
- If no valid products are found and fail_on_empty=True, raises RuntimeError.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from loguru import logger
from pydantic import ValidationError

from app.catalog.models import (
    ChipFamily,
    FirmwareVersion,
    Product,
    ProductLinks,
    _version_sort_key,
)


def _load_yaml(path: Path) -> dict:  # type: ignore[type-arg]
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        if not isinstance(data, dict):
            raise ValueError(f"Expected a YAML mapping, got {type(data).__name__}")
        return data
    except yaml.YAMLError as exc:
        raise ValueError(f"YAML parse error: {exc}") from exc


def _load_version(version_dir: Path) -> FirmwareVersion | None:
    """Parse and validate one version directory. Returns None on any error."""
    manifest_path = version_dir / "manifest.yaml"
    if not manifest_path.exists():
        logger.warning("No manifest.yaml in {}, skipping version", version_dir)
        return None

    try:
        data = _load_yaml(manifest_path)
    except ValueError as exc:
        logger.warning("Bad manifest.yaml in {}: {}", version_dir, exc)
        return None

    try:
        fw = FirmwareVersion.model_validate(data)
    except ValidationError as exc:
        logger.warning("Invalid manifest in {}: {}", version_dir, exc)
        return None

    # Verify every declared part file exists on disk.
    missing = [p.file for p in fw.parts if not (version_dir / p.file).exists()]
    if missing:
        logger.warning(
            "Missing part file(s) {} in {}, skipping version", missing, version_dir
        )
        return None

    return fw


def _load_product(product_dir: Path) -> Product | None:
    """Parse a product directory. Returns None if product.yaml is invalid."""
    product_yaml = product_dir / "product.yaml"
    if not product_yaml.exists():
        logger.debug("No product.yaml in {}, skipping", product_dir)
        return None

    try:
        data = _load_yaml(product_yaml)
    except ValueError as exc:
        logger.error("Bad product.yaml in {}: {}", product_dir, exc)
        return None

    # Normalise nested links dict → ProductLinks
    if "links" in data and isinstance(data["links"], dict):
        data["links"] = ProductLinks(**data["links"])

    # Normalise chip_families strings → ChipFamily enum values
    if "chip_families" in data and isinstance(data["chip_families"], list):
        try:
            data["chip_families"] = [ChipFamily(cf) for cf in data["chip_families"]]
        except ValueError as exc:
            logger.error("Unknown chip_family in {}: {}", product_yaml, exc)
            return None

    try:
        # Build without versions first; we load them separately below.
        product = Product.model_validate({**data, "versions": []})
    except ValidationError as exc:
        logger.error("Invalid product.yaml in {}: {}", product_dir, exc)
        return None

    # Enforce slug == directory name so URLs are consistent.
    if product.slug != product_dir.name:
        logger.warning(
            "slug {!r} in product.yaml doesn't match directory name {!r}; using directory name",
            product.slug,
            product_dir.name,
        )
        product = product.model_copy(update={"slug": product_dir.name})

    versions: list[FirmwareVersion] = []
    for child in sorted(product_dir.iterdir()):
        if not child.is_dir():
            continue
        fw = _load_version(child)
        if fw is not None:
            versions.append(fw)

    # Sort newest-first by numeric YYYY.M.PATCH key.
    versions.sort(key=lambda v: _version_sort_key(v.version), reverse=True)

    return product.model_copy(update={"versions": versions})


def load_catalog(firmware_dir: str | Path, *, fail_on_empty: bool = True) -> list[Product]:
    """
    Scan firmware_dir and return a list of Products sorted by their `order` field.

    Raises:
        FileNotFoundError: if firmware_dir does not exist.
        RuntimeError:      if fail_on_empty=True and no valid products are found.
    """
    root = Path(firmware_dir)
    if not root.exists():
        raise FileNotFoundError(f"FIRMWARE_DIR {root!r} does not exist")

    products: list[Product] = []
    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue
        product = _load_product(entry)
        if product is not None:
            products.append(product)

    products.sort(key=lambda p: (p.order, p.slug))

    if not products and fail_on_empty:
        raise RuntimeError(
            f"No valid products found in {root!r}. "
            "Add at least one product directory with a product.yaml, "
            "or set FAIL_ON_EMPTY=false to allow an empty catalogue."
        )

    logger.info(
        "Catalogue loaded: {} product(s), {} total version(s)",
        len(products),
        sum(len(p.versions) for p in products),
    )
    return products

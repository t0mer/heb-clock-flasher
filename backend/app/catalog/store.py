"""
In-memory catalogue store with a thread-safe swap.

The store is populated once during application startup (lifespan) and can be
refreshed at runtime via POST /api/v1/admin/reload without restarting the server.
"""

from __future__ import annotations

from threading import Lock

from app.catalog.models import Product

_lock = Lock()
_catalog: list[Product] = []


def set_catalog(products: list[Product]) -> None:
    with _lock:
        global _catalog
        _catalog = list(products)


def get_catalog() -> list[Product]:
    with _lock:
        return list(_catalog)


def get_product(slug: str) -> Product | None:
    with _lock:
        for p in _catalog:
            if p.slug == slug:
                return p
    return None


def catalog_stats() -> dict[str, int]:
    with _lock:
        return {
            "products": len(_catalog),
            "versions": sum(len(p.versions) for p in _catalog),
        }

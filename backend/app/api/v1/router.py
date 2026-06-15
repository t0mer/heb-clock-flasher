from fastapi import APIRouter

from app.api.v1 import firmware, products, system

router = APIRouter(prefix="/api/v1")

router.include_router(products.router, tags=["products"])
router.include_router(firmware.router, tags=["firmware"])
router.include_router(system.router, tags=["admin"])

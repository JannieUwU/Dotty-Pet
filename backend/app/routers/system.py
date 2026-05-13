"""System resource router."""
from fastapi import APIRouter
from app.services.system_service import get_resources
from app.services.ws_server import router as ws_router

router = APIRouter()
router.include_router(ws_router)


@router.get("/resources")
async def resources():
    return get_resources()

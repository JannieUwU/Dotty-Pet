"""Git monitoring router."""
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.git_service import get_repo_status

router = APIRouter()


@router.get("/status")
async def git_status(path: str = "."):
    return get_repo_status(path)

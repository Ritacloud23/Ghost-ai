from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    project_id: str
    message: str


class ChatResponse(BaseModel):
    task_id: str
    status: str


@router.post("", response_model=ChatResponse)
async def send_chat_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: Create Celery task for AI processing
    # For now, return a placeholder
    import uuid

    return ChatResponse(task_id=str(uuid.uuid4()), status="pending")

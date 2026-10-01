from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.snapshot import Snapshot

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


class SnapshotCreate(BaseModel):
    project_id: str
    blob_url: str


class SnapshotResponse(BaseModel):
    id: str
    project_id: str
    blob_url: str
    created_at: str

    class Config:
        from_attributes = True


@router.get("/{project_id}", response_model=list[SnapshotResponse])
async def list_snapshots(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Snapshot).where(Snapshot.project_id == project_id).order_by(Snapshot.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=SnapshotResponse, status_code=status.HTTP_201_CREATED)
async def create_snapshot(
    body: SnapshotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify project access
    result = await db.execute(select(Project).where(Project.id == body.project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    snapshot = Snapshot(project_id=body.project_id, blob_url=body.blob_url)
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)
    return snapshot
